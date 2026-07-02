<!-- generated-by: dag-book-crafter v1.1.0 -->

# Book DNA — Adversarial Tier 1 Fixture

This Book DNA is deliberately minimal. It exists only to give `craft-check.js --novelty`
and Editor Pass 3 §4.4.5 the structural inputs they need (Chapter Map with central_image
fields, plus the Refrains block) so the known-bad manuscript under `edited/` and
`front-matter/` deterministically trips every Tier 1 rule.

## Voice Profile

Spiritual default. Not relevant to novelty detection — this fixture exists only for
Tier 1 fail-path testing.

## Chapter Map

- Ch 1 central_image: unlit bedside lamp
- Ch 2 central_image: desk lamp glowing yellow
- Ch 3 central_image: reading lamp on the nightstand

All three vehicles are deliberately variants of a single "lamp" vehicle family. The
central-image distinctness check MUST flag them as collapsed-to-one.

## Refrains

```yaml
refrains:
  - phrase: "one small lamp refusing the whole dark"
    max_uses: 1
    scope: whole_book
```

The foreword contains this phrase exactly once (the allowed first use). Chapter 2
contains it a second time — that second occurrence MUST be flagged as
refrain_overuse (max_uses+1), proving the off-by-one handling flags occurrence N+1,
not occurrence 1.

## Notes

This fixture is NEVER shipped in the release zip. `scripts/release.sh` Gate 3b
asserts the adversarial directory did not leak into staging.
