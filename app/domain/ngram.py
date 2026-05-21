"""N-gram overlap — trigram shingles vs last served material (AC-D4 #5).

AC-CD14, CODE_SPEC §14. The integrity layer that catches "copy the
served learning material back as the retest response" without paying
for a stylistic AI-detection pass (which would carry unacceptable
false-positive risk per AC-D4 v1.1 amendment rationale).

The algorithm is deliberately simple — character trigrams + Jaccard
overlap — because per AC-D4 v1.6 the comparison base is restricted to
``LearningMaterial.served_text`` rows with ``source = ai_generated``.
The signal is high (the Testee was literally served this exact text
seconds-to-hours ago) and the false-positive surface is low (admin-
uploaded references and curated external links are out of scope).

Slice 1 ships pure functions only:

- :func:`trigram_shingles` — produce the trigram set from a string
- :func:`jaccard_overlap`  — set-overlap ratio
- :func:`compute_overlap`  — composition (the public entry point)
- :func:`is_flagged`       — threshold check

Slice 2 wires :func:`compute_overlap` into ``submit_attempt`` against
the last :class:`LearningMaterial.served_text` for ``(testee, pill)``.
"""

from __future__ import annotations

# Trigram size = 3. AC-CD14 specifies "trigram shingles" — three-character
# windows. Larger windows over-fit (need exact runs) and smaller windows
# under-fit (every two-letter pair matches against any prose). The size
# could become a ``system_settings`` column in v1.x if operational
# tuning needs it — for now it lives as a code constant per the user's
# explicit direction.
_TRIGRAM_SIZE = 3

# Flag at >= 60% overlap. AC-D4 v1.6 / AC-CD14 default: "Overlap above a
# configured threshold (default 60% trigram overlap)". Could become a
# system_settings column in v1.x; code constant for now.
_OVERLAP_THRESHOLD = 0.60


def _normalise(text: str) -> str:
    """Lowercase + collapse internal whitespace runs to a single space
    + strip leading/trailing whitespace.

    Why normalise: a Testee who copy-pastes the served explainer may
    re-indent, recase, or re-wrap it. The trigram window must see
    "Hello World" and "hello   world" as the same content; otherwise
    trivial reformatting defeats the integrity check that AC-D4 #5
    exists to provide.
    """
    return " ".join(text.split()).lower()


def trigram_shingles(text: str) -> frozenset[str]:
    """Produce the character-trigram set of ``text`` after normalisation.

    Empty input, ``None``-equivalent, and strings shorter than the
    trigram size return an empty set rather than crashing. A response
    of two characters has no trigrams to compare and is silently
    skipped by the downstream Jaccard math (overlap = 0.0, not flagged).
    """
    if not text:
        return frozenset()
    normalised = _normalise(text)
    if len(normalised) < _TRIGRAM_SIZE:
        return frozenset()
    return frozenset(
        normalised[i : i + _TRIGRAM_SIZE]
        for i in range(len(normalised) - _TRIGRAM_SIZE + 1)
    )


def jaccard_overlap(a: frozenset[str], b: frozenset[str]) -> float:
    """Jaccard-style overlap ratio: ``|a ∩ b| / |a ∪ b|``.

    Both sets empty → 0.0 (defensive — not a flag-trigger). One side
    empty → 0.0. Identical non-empty sets → 1.0. The "Jaccard-style"
    framing in CODE_SPEC §14 is literally Jaccard — intersection over
    union — no smoothing, no IDF.
    """
    if not a and not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def compute_overlap(candidate_text: str, served_text: str) -> float:
    """Public entry point: trigram-shingle both sides and return the
    Jaccard ratio.

    Returns 0.0 if either side has no trigrams (empty, too short, or
    pure whitespace) — the n-gram check is silently skipped at that
    point and ``is_flagged`` will not fire. This matches AC-D4 #5
    ("Skip silently when nothing was served" — extended here to "or
    when there's nothing to compare against").
    """
    return jaccard_overlap(
        trigram_shingles(candidate_text),
        trigram_shingles(served_text),
    )


def is_flagged(overlap_pct: float, *, threshold: float = _OVERLAP_THRESHOLD) -> bool:
    """Threshold check for the ``Grade.overlap_flagged`` column.

    Boundary is **inclusive** at the threshold (``>=``) — a response at
    exactly 60% trigram overlap flags. The threshold default is
    ``_OVERLAP_THRESHOLD = 0.60`` per AC-D4 v1.6 / AC-CD14. Callers may
    pass a different threshold for tests or for an operational-tuning
    override (when ``system_settings.overlap_threshold`` lands in v1.x).
    """
    return overlap_pct >= threshold
