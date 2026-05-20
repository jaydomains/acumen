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

from app.ai.prompts import get_prompt, registered_operations
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
