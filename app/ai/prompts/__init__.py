"""Versioned prompt registry (CODE_SPEC §7 / AC-CD8).

The seven AI operation prompts (SPEC §6) live in version control, not in
the database. Each prompt is a module exporting ``TEMPLATE`` (the prompt
text) and ``VERSION`` (a semver string). The version used on any AI call
is persisted on the producing entity's
:class:`app.models.AIProvenanceMixin` columns — never global.

P5 ships the five Anthropic-side prompts (generation / grading /
weakness / learning_material / pill_proposal). The cross-family review
prompts (grade_review, anchor_self_review) and the embedding "prompt"
(no template required) are P6 / P8 / P9.

Bumping a prompt's text bumps its file's ``VERSION`` constant manually;
the registry has no auto-derivation in v1. Prompt changes are reviewed
like code changes (SPEC §6 "Prompt management").
"""

from __future__ import annotations

from app.ai.prompts import (
    generation,
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
}


def get_prompt(operation: Operation) -> tuple[str, str]:
    """Return ``(template, version)`` for ``operation``.

    Raises :class:`KeyError` for operations whose prompts are deferred
    to a later phase (grade_review / anchor_self_review → P6, embed → P9).
    """
    try:
        return _REGISTRY[operation]
    except KeyError as exc:
        raise KeyError(
            f"No prompt registered for {operation.value!r}. "
            "grade_review and anchor_self_review prompts land in P6; "
            "embed has no prompt template (P9 Drive RAG)."
        ) from exc


def registered_operations() -> frozenset[Operation]:
    """Snapshot of which operations have a registered prompt — used by
    :mod:`tests.unit.test_p5_prompts` to assert the full Anthropic set."""
    return frozenset(_REGISTRY)
