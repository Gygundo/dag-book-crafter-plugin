# Changelog

## [1.2.0] - 2026-07-03

Enrichment made opt-in (default OFF) to match the analysed Dag corpus.

- **Stage 4.5 enricher no longer runs by default.** Analysed Dag Heward-Mills books end each chapter on the final numbered point - never with summaries, discussion questions, or application worksheets. The orchestrator now routes Stage 4 approval straight to Stage 5 unless the user explicitly asks for study/group material.
- **Foreword is a separate opt-in** within Stage 4.5 (several analysed Dag books carry no foreword). The enricher writes `front-matter/foreword.md` only when the orchestrator passes an explicit foreword request. Dedication, About the Author, and book-list back matter remain default (authentic).
- Stage 4.6 post-enricher novelty gate only runs when Stage 4.5 ran.
- State detection treats an absent/empty `enrichments/` directory as the normal completed path, not pending work; Stage 5 readiness no longer requires enrichments or a foreword.
- Sample skill runs the pipeline without the enrich stage.
- Docs updated: orchestrator/enricher skills, `references/pipeline-stages.md`, `CLAUDE.md`.

## [1.1.0] - 2026-07-03

Anti-AI-slop enforcement (DAG-09).

- New deterministic rule DAG-09 in `references/dag-craft-rules.md`, enforced by `scripts/craft-check.js` at editor Pass 1 (auto-revise):
  - **Em dashes banned** in author prose (scripture blockquotes exempt; a quoted translation may contain one).
  - **Negation-pivot cap:** at most ONE "isn't just X, it's Y" family construction per chapter ("not just/merely/simply", "more than just", "not only... but also", "it's not about X, it's about Y"). True antithesis without pivot words stays unlimited.
  - **Banned AI-ism phrase list:** "delve", "deep dive", "tapestry", "a testament to", "in today's fast-paced world", "game-changer", "it's important to note", "it's worth noting", "at the end of the day", "let's unpack", "let's explore", "in conclusion", "embark on", "the landscape of", "navigating the complexities", "elevate your", "unlock the secrets", "supercharge", "a powerful reminder", "moreover", "furthermore", "additionally", and variants.
  - **Emoji banned** in prose.
  - Deliberately NOT banned: "the power of God", "journey", bare "unpack" in exegesis, and every form of antithesis/anaphora - no theological false positives.
- Voice profile Avoid list and writer/editor skills updated to match; 7 new unit tests (33 total).
- New known-bad fixture `fixtures/phase10/known-bad/ch06-ai-slop.md` failing exactly DAG-09.
- All prose-modelling files (voice profile, calibration exemplars, fixtures) swept free of em dashes so agents never imitate them.

## [1.0.0] - 2026-07-02

Initial release.

- Forked from [book-crafter-plugin](https://github.com/gygundo/book-crafter-plugin) v1.1.1 - same five-stage pipeline (outline → research → write → edit → enrich → format), parallel chapter subagents, Book DNA context sharing, approval gates, and .docx formatter.
- Style layer replaced wholesale with rules derived from a build-time analysis of eight published Dag Heward-Mills books:
  - `references/dag-craft-rules.md` - DAG-01..08 (verse-or-declaration openers, scripture block density, numbered parallel points, key statements, short chapters, plain language, direct address, functional illustrations) replacing bestseller CRAFT-01..08.
  - `references/voice-profiles/dag-default.md` - descriptive Dag teaching-style voice profile (default). No copyrighted text shipped.
  - `references/captivation-rubric.md` - eight Dag-style components on the same schema v2 shape (0–16 total + binary novelty_dedup gate).
  - `references/dag-calibration.md` - original composed exemplars at score levels 3/9/14.
- Chapter craft fields: `opener_type`, `list_structure` (stem + count), `key_statement`, `testimony_seed` replace `central_image`, `vulnerability_beat_seed`, hook strategies, and ending styles. No cliffhangers exist in this pipeline.
- Deliberate repetition made first-class: list stems auto-declared as refrains; scripture blocks and benediction formulas exempt from the dedup audit; verse repetition across chapters treated as a feature.
- Pulpit-seam rule inverted: "You see,", "Notice how...", "Indeed," paragraph openers are authentic and permitted.
- Scripture default KJV with labelled alternates (NASB preferred, NLT, NKJV, NIV, AMP, TLB); ALL-CAPS emphasis inside quotes supported end-to-end (writer → editor → formatter).
- First-person testimony hard-gated to sourced seeds - the pipeline never invents the author's life.
- `craft-check.js` rewritten for the deterministic DAG checks; test suite and fixtures rebuilt in the new style.
- Sermon adapter retuned: numbered points, anaphora, and scripture blocks are now preserved (they are the target format), while spoken fragments, audience references, and verbal filler still convert.
