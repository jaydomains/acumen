"""P5 prompt registry — every Anthropic-side operation has a registered
prompt with a non-empty template + valid semver version (AC-CD8).

The version on the file is what's persisted on every produced entity's
:attr:`app.models.AIProvenanceMixin.ai_prompt_version` column. Bumping a
prompt's text bumps the file's ``VERSION`` constant — these tests are
the floor that catches a silent prompt change without a version bump.
"""

from __future__ import annotations

import re

import pytest

from app.ai.prompts import get_prompt, registered_operations, render_prompt
from app.ai.provider import Operation

# The 5 Anthropic-side operations P5 ships prompts for.
_P5_OPERATIONS: list[Operation] = [
    Operation.generation,
    Operation.grading,
    Operation.weakness,
    Operation.learning_material,
    Operation.pill_proposal,
]

# Operations whose prompts are deferred to a later phase.
_DEFERRED_OPERATIONS: list[Operation] = [
    Operation.grade_review,  # P6
    Operation.anchor_self_review,  # P8 / P11
    Operation.embed,  # P9 (no prompt — embedding has no template)
]

_SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$")


def test_registry_holds_exactly_the_five_anthropic_ops() -> None:
    """The registry must hold the 5 Anthropic-side operations and only
    them. Adding grade_review/anchor_self_review/embed before P6/P9 would
    silently let production code call an unimplemented review() or embed()
    path."""
    assert registered_operations() == frozenset(_P5_OPERATIONS)


@pytest.mark.parametrize("op", _P5_OPERATIONS)
def test_every_p5_op_has_a_non_empty_template(op: Operation) -> None:
    """Every registered prompt has a substantive template (>= 100 chars
    of meaningful content). A trivially short template usually indicates
    the file was created as a placeholder and never filled in."""
    template, _ = get_prompt(op)
    assert len(template) >= 100, (
        f"prompt for {op.value!r} is suspiciously short "
        f"({len(template)} chars); did the file stay a placeholder?"
    )


@pytest.mark.parametrize("op", _P5_OPERATIONS)
def test_every_p5_op_has_a_valid_semver_version(op: Operation) -> None:
    """The ``VERSION`` constant on each prompt file must be a valid
    semver string so the value persisted on every produced entity is
    sortable and comparable across deployments."""
    _, version = get_prompt(op)
    assert _SEMVER_RE.match(
        version
    ), f"prompt VERSION for {op.value!r} = {version!r} is not valid semver"


@pytest.mark.parametrize("op", _P5_OPERATIONS)
def test_every_p5_template_documents_a_json_output_contract(
    op: Operation,
) -> None:
    """Every Anthropic op returns a structured JSON object — the prompt
    must instruct the model to emit JSON only. Catches the easy mistake
    of leaving prose framing in a prompt that the JSON parser then
    fails to decode."""
    template, _ = get_prompt(op)
    assert "JSON" in template, (
        f"prompt for {op.value!r} does not mention JSON — the model "
        "will return prose and the parser will fail."
    )


@pytest.mark.parametrize("op", _DEFERRED_OPERATIONS)
def test_deferred_op_lookup_raises_with_phase_pointer(op: Operation) -> None:
    """Calling :func:`get_prompt` for a deferred op raises ``KeyError``
    with a clear "P6/P9" pointer in the message — a defensive guard so
    a later-phase wiring failure points at the right phase to fix."""
    with pytest.raises(KeyError, match=r"P[689]"):
        get_prompt(op)


# --- render_prompt — contextual-error wrapper (Gitar PR-#16 #1) ------


def test_render_prompt_substitutes_keys() -> None:
    """Happy path: every ``{placeholder}`` in the template is replaced
    with the matching payload value."""
    rendered = render_prompt(
        "Subject: {subject_name}, difficulty: {target_difficulty}",
        {"subject_name": "Lifting", "target_difficulty": 7},
        operation=Operation.generation,
    )
    assert rendered == "Subject: Lifting, difficulty: 7"


def test_render_prompt_missing_key_raises_value_error_with_context() -> None:
    """A missing key surfaces as :class:`ValueError` carrying the
    operation name, the missing key, and the sorted list of available
    keys — not an opaque ``KeyError`` (Gitar PR-#16 finding #1)."""
    with pytest.raises(ValueError) as exc_info:
        render_prompt(
            "Subject: {subject_name}",
            {"unrelated_key": "value"},
            operation=Operation.generation,
        )
    msg = str(exc_info.value)
    assert "generation" in msg
    assert "subject_name" in msg
    assert "unrelated_key" in msg


def test_render_prompt_passes_through_braces_in_values() -> None:
    """A value containing ``{`` / ``}`` is interpolated verbatim —
    :meth:`str.format` does not re-interpret value content, so a
    user-supplied description like ``"Use {brackets} here"`` is safe
    (Gitar's overstated #1 sub-concern)."""
    rendered = render_prompt(
        "Description: {description}",
        {"description": "Use {brackets} here"},
        operation=Operation.pill_proposal,
    )
    assert rendered == "Description: Use {brackets} here"


def test_render_prompt_unmatched_brace_raises_with_context() -> None:
    """A malformed template (unmatched brace from a prompt-author typo)
    is surfaced as :class:`ValueError` with the operation name + the
    available payload keys — would otherwise be an opaque ValueError
    bubbling up from inside the format-spec parser."""
    with pytest.raises(ValueError) as exc_info:
        render_prompt(
            "Subject: {subject_name",  # unclosed brace
            {"subject_name": "Lifting"},
            operation=Operation.generation,
        )
    assert "generation" in str(exc_info.value)
