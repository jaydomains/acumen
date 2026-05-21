"""P7 n-gram overlap — pure-function tests for ``app.domain.ngram``
(AC-D4 v1.6 #5 / AC-CD14).

CODE_SPEC §14: "trigram-shingle the Testee's free-text responses and
compare against the last learning material served to that Testee for
that pill. Jaccard-style overlap ratio; flag at default >= 60%
(configurable). Skip silently when nothing was served."

The base of comparison per AC-D4 v1.6 is ``LearningMaterial.served_text``
on AI-generated rows. Admin-uploaded references and curated external
links are out of scope. No DB, no network — pure functions only.
"""

from __future__ import annotations

from app.domain.ngram import (
    compute_overlap,
    is_flagged,
    jaccard_overlap,
    trigram_shingles,
)

# --- trigram_shingles --------------------------------------------------


class TestTrigramShingles:
    """Trigram size = 3 per AC-CD14. Lowercase + whitespace-normalised
    before shingling so trivial reformatting doesn't defeat the check.
    """

    def test_empty_string_returns_empty_set(self) -> None:
        assert trigram_shingles("") == frozenset()

    def test_one_character(self) -> None:
        # Below trigram size — empty set, not a crash.
        assert trigram_shingles("a") == frozenset()

    def test_two_characters(self) -> None:
        # Still below trigram size.
        assert trigram_shingles("ab") == frozenset()

    def test_exactly_trigram_size(self) -> None:
        assert trigram_shingles("abc") == frozenset({"abc"})

    def test_four_characters_two_shingles(self) -> None:
        assert trigram_shingles("abcd") == frozenset({"abc", "bcd"})

    def test_normalises_case(self) -> None:
        # "HELLO" must shingle identically to "hello" — otherwise a
        # Testee who only re-cases the served text defeats the check.
        assert trigram_shingles("HELLO") == trigram_shingles("hello")

    def test_normalises_whitespace(self) -> None:
        # Internal whitespace runs collapse to a single space and
        # leading/trailing trim — "  hello   world  " == "hello world".
        assert trigram_shingles("  hello   world  ") == trigram_shingles("hello world")

    def test_normalises_mixed_case_and_whitespace(self) -> None:
        # Combined: "  Hello\tWorld  " == "hello world".
        assert trigram_shingles("  Hello\tWorld  ") == trigram_shingles("hello world")

    def test_short_after_normalise_returns_empty(self) -> None:
        # "  a b " → "a b" → length 3 → one trigram ``"a b"``.
        assert trigram_shingles("  a b ") == frozenset({"a b"})
        # "  a  " → "a" → length 1 → empty set.
        assert trigram_shingles("  a  ") == frozenset()

    def test_explicit_hello_world_shingles(self) -> None:
        # "hello world" — 11 chars → 9 trigrams.
        # Sanity-check the exact set so we know future refactors
        # haven't subtly changed the window.
        expected = frozenset(
            {
                "hel",
                "ell",
                "llo",
                "lo ",
                "o w",
                " wo",
                "wor",
                "orl",
                "rld",
            }
        )
        assert trigram_shingles("hello world") == expected


# --- jaccard_overlap ---------------------------------------------------


class TestJaccardOverlap:
    """``|a ∩ b| / |a ∪ b|`` — no smoothing, no IDF. Boundary cases
    return 0.0 rather than NaN so the downstream threshold check is
    safe regardless of input."""

    def test_both_empty_returns_zero(self) -> None:
        # Empty / empty must NOT be 1.0 — that would flag every empty
        # response with no served material.
        assert jaccard_overlap(frozenset(), frozenset()) == 0.0

    def test_one_side_empty(self) -> None:
        assert jaccard_overlap(frozenset({"abc"}), frozenset()) == 0.0
        assert jaccard_overlap(frozenset(), frozenset({"abc"})) == 0.0

    def test_identical_sets(self) -> None:
        s = frozenset({"abc", "bcd", "cde"})
        assert jaccard_overlap(s, s) == 1.0

    def test_disjoint_sets(self) -> None:
        a = frozenset({"abc", "bcd"})
        b = frozenset({"xyz", "yzw"})
        assert jaccard_overlap(a, b) == 0.0

    def test_partial_overlap_one_third(self) -> None:
        # |a ∩ b| = 1; |a ∪ b| = 3 → 1/3.
        a = frozenset({"abc", "bcd"})
        b = frozenset({"abc", "cde"})
        assert jaccard_overlap(a, b) == 1 / 3

    def test_partial_overlap_two_thirds(self) -> None:
        # |a ∩ b| = 2; |a ∪ b| = 3.
        a = frozenset({"abc", "bcd"})
        b = frozenset({"abc", "bcd", "cde"})
        assert jaccard_overlap(a, b) == 2 / 3

    def test_subset_overlap(self) -> None:
        # b ⊂ a → intersection = b, union = a.
        a = frozenset({"abc", "bcd", "cde", "def"})
        b = frozenset({"abc", "bcd"})
        assert jaccard_overlap(a, b) == 2 / 4

    def test_symmetric(self) -> None:
        # Jaccard is symmetric — the order of arguments must not matter.
        a = frozenset({"abc", "bcd"})
        b = frozenset({"abc", "cde", "def"})
        assert jaccard_overlap(a, b) == jaccard_overlap(b, a)


# --- compute_overlap ---------------------------------------------------


class TestComputeOverlap:
    """The public entry point. Composition of ``trigram_shingles`` and
    ``jaccard_overlap`` — covered above. These tests verify the
    composition behaves correctly end-to-end on real-shaped inputs.
    """

    def test_identical_text_returns_one(self) -> None:
        text = "the cathodic protection system is monitored monthly"
        assert compute_overlap(text, text) == 1.0

    def test_identical_after_normalisation(self) -> None:
        # Recasing + whitespace-changing the served text must still flag.
        served = "the cathodic protection system is monitored monthly"
        copied = "  The   Cathodic Protection SYSTEM is monitored MONTHLY  "
        assert compute_overlap(copied, served) == 1.0

    def test_disjoint_text_returns_zero(self) -> None:
        # Use strings sharing no trigrams (different character set).
        # "1234567" vs "abcdefg" — character-disjoint trigrams.
        assert compute_overlap("1234567", "abcdefg") == 0.0

    def test_empty_candidate_returns_zero(self) -> None:
        # AC-D4 #5: "Skip silently when nothing was served" — the
        # converse also holds: an empty candidate produces 0.0 not
        # a NaN, so ``is_flagged`` will not fire.
        assert compute_overlap("", "served explainer text here") == 0.0

    def test_empty_served_returns_zero(self) -> None:
        assert compute_overlap("response text here", "") == 0.0

    def test_both_empty_returns_zero(self) -> None:
        assert compute_overlap("", "") == 0.0

    def test_partial_paraphrase_below_threshold(self) -> None:
        # A loosely-paraphrased response that shares thematic words but
        # not structure must score well below the 60% threshold.
        served = (
            "Cathodic protection prevents corrosion by making the structure "
            "the cathode of an electrochemical cell."
        )
        candidate = "The system stops rust by using electricity to control the metal."
        ratio = compute_overlap(candidate, served)
        # Sanity range — should be very low; tight upper bound proves
        # paraphrase is well below 60%.
        assert ratio < 0.20

    def test_near_verbatim_above_threshold(self) -> None:
        # A near-verbatim copy with a tiny edit — must score above the
        # 60% threshold (the integrity signal AC-D4 #5 exists to catch).
        served = (
            "Cathodic protection prevents corrosion by making the structure "
            "the cathode of an electrochemical cell."
        )
        candidate = (
            "Cathodic protection prevents corrosion by making the structure "
            "the cathode of the cell."
        )
        ratio = compute_overlap(candidate, served)
        assert ratio >= 0.60


# --- is_flagged --------------------------------------------------------


class TestIsFlagged:
    """Threshold is INCLUSIVE at 0.60 by default — a response at exactly
    60% trigram overlap flags."""

    def test_below_threshold(self) -> None:
        assert is_flagged(0.0) is False
        assert is_flagged(0.5) is False
        assert is_flagged(0.599999) is False

    def test_at_threshold_inclusive(self) -> None:
        # Boundary case — 0.60 IS flagged (>=).
        assert is_flagged(0.60) is True

    def test_above_threshold(self) -> None:
        assert is_flagged(0.7) is True
        assert is_flagged(1.0) is True

    def test_custom_threshold(self) -> None:
        # Operator-tuning seam — a future system_settings column would
        # plumb a different threshold through.
        assert is_flagged(0.50, threshold=0.40) is True
        assert is_flagged(0.30, threshold=0.40) is False

    def test_zero_threshold_flags_any_overlap(self) -> None:
        # Edge: threshold 0 means "flag any non-zero overlap". Even
        # 0.0 >= 0.0 → True. Documented edge for symmetry.
        assert is_flagged(0.0, threshold=0.0) is True
