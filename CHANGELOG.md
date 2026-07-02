# Changelog

## [1.0.0] — 2026-07-02

Initial release.

- Forked from [book-crafter-plugin](https://github.com/gygundo/book-crafter-plugin) v1.1.1 — same five-stage pipeline (outline → research → write → edit → enrich → format), parallel chapter subagents, Book DNA context sharing, approval gates, and .docx formatter.
- Style layer replaced wholesale with rules derived from a build-time analysis of eight published Dag Heward-Mills books:
  - `references/dag-craft-rules.md` — DAG-01..08 (verse-or-declaration openers, scripture block density, numbered parallel points, key statements, short chapters, plain language, direct address, functional illustrations) replacing bestseller CRAFT-01..08.
  - `references/voice-profiles/dag-default.md` — descriptive Dag teaching-style voice profile (default). No copyrighted text shipped.
  - `references/captivation-rubric.md` — eight Dag-style components on the same schema v2 shape (0–16 total + binary novelty_dedup gate).
  - `references/dag-calibration.md` — original composed exemplars at score levels 3/9/14.
- Chapter craft fields: `opener_type`, `list_structure` (stem + count), `key_statement`, `testimony_seed` replace `central_image`, `vulnerability_beat_seed`, hook strategies, and ending styles. No cliffhangers exist in this pipeline.
- Deliberate repetition made first-class: list stems auto-declared as refrains; scripture blocks and benediction formulas exempt from the dedup audit; verse repetition across chapters treated as a feature.
- Pulpit-seam rule inverted: "You see,", "Notice how...", "Indeed," paragraph openers are authentic and permitted.
- Scripture default KJV with labelled alternates (NASB preferred, NLT, NKJV, NIV, AMP, TLB); ALL-CAPS emphasis inside quotes supported end-to-end (writer → editor → formatter).
- First-person testimony hard-gated to sourced seeds — the pipeline never invents the author's life.
- `craft-check.js` rewritten for the deterministic DAG checks; test suite and fixtures rebuilt in the new style.
- Sermon adapter retuned: numbered points, anaphora, and scripture blocks are now preserved (they are the target format), while spoken fragments, audience references, and verbal filler still convert.
