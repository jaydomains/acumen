"""Versioned prompt registry (CODE_SPEC §7 / AC-CD8).

The seven AI operation prompts (SPEC §6) live in version control, not in
the database. Each prompt is a module exporting ``TEMPLATE`` (the prompt
text) and ``VERSION`` (a semver string). The version used on any AI call
is persisted on the producing entity's
:class:`app.models.AIProvenanceMixin` columns — never global.

P5 ships the five Anthropic-side prompts (generation / grading /
weakness / learning_material / pill_proposal). P6 adds the cross-family
``grade_review`` prompt for the OpenAI-side review pass (AC-D19 /
AC-CD11 v1.7). ``anchor_self_review`` lands with P8; ``embed`` has no
template (P9 Drive RAG).

Bumping a prompt's text bumps its file's ``VERSION`` constant manually;
the registry has no auto-derivation in v1. Prompt changes are reviewed
like code changes (SPEC §6 "Prompt management").
"""

from __future__ import annotations

from app.ai.prompts import (
    generation,
    grade_review,
    grading,
    learning_material,
    pill_proposal,
    weakness,
)
from app.ai.provider import Operation

_REGISTRY: dict[Operation, tuple[str, str]] = {
    Operation.generation: (generation.TEMPLATE, generation.VERSION),
    Operation.grading: (grading.TEMPLATE, grading.VERSION),
    Operation.weakness: (weakness.TEMPLATE, weakness.VERSION),
    Operation.learning_material: (
        learning_material.TEMPLATE,
        learning_material.VERSION,
    ),
    Operation.pill_proposal: (pill_proposal.TEMPLATE, pill_proposal.VERSION),
    Operation.grade_review: (grade_review.TEMPLATE, grade_review.VERSION),
}


def get_prompt(operation: Operation) -> tuple[str, str]:
    """Return ``(template, version)`` for ``operation``.

    Raises :class:`KeyError` for operations whose prompts are deferred
    to a later phase (anchor_self_review → P8, embed → P9).
    """
    try:
        return _REGISTRY[operation]
    except KeyError as exc:
        raise KeyError(
            f"No prompt registered for {operation.value!r}. "
            "anchor_self_review prompt lands in P8; embed has no prompt "
            "template (P9 Drive RAG)."
        ) from exc


def render_prompt(
    template: str, payload: dict[str, object], *, operation: Operation
) -> str:
    """Substitute ``payload`` keys into ``template`` and surface a clear
    error if anything is missing or malformed.

    Domain code and prompt templates evolve independently — a missing
    payload key surfaced as a raw ``KeyError("subject_name")`` would
    leave the operator guessing which call, which prompt, and which
    field. Re-raising as :class:`ValueError` with the op name + the
    missing key + the available keys is the operator-friendly form.
    Also catches the rare malformed-template :class:`ValueError` (e.g.
    a stray ``{`` left over from a prompt edit) by wrapping with the
    same context (Gitar PR-#16 finding on Slice 1).
    """
    try:
        return template.format(**payload)
    except KeyError as exc:
        # ``exc.args[0]`` is the missing key name; ``str(exc)`` would
        # render it with surrounding quotes which is noisier in the
        # error message.
        missing = exc.args[0] if exc.args else "<unknown>"
        raise ValueError(
            f"Prompt template for {operation.value!r} requires key "
            f"{missing!r} which is missing from the payload. Available "
            f"keys: {sorted(payload)}."
        ) from exc
    except (ValueError, IndexError) as exc:
        # ValueError: malformed template (unmatched brace, bad format
        # spec); IndexError: positional placeholders ({0}) with no args.
        # Both are author-time mistakes worth surfacing with context.
        raise ValueError(
            f"Prompt template for {operation.value!r} could not be "
            f"rendered: {exc}. Available payload keys: {sorted(payload)}."
        ) from exc


def registered_operations() -> frozenset[Operation]:
    """Snapshot of which operations have a registered prompt — used by
    :mod:`tests.unit.test_p5_prompts` to assert the full Anthropic set."""
    return frozenset(_REGISTRY)
