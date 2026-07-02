# Dag Book Crafter — Design Spec

**Date:** 2026-07-02
**Status:** Approved by David
**Repo:** `~/Development/dag-book-crafter-plugin` → public GitHub `gygundo/dag-book-crafter-plugin`

## Purpose

A Claude Code plugin that writes short, easy-to-read, topical Christian books in the style of Dag Heward-Mills, reusing the proven pipeline framework of `book-crafter-plugin` but replacing its literary-bestseller style layer with a Dag-derived one. Shareable with Leon via public GitHub marketplace install.

## Why a fork, not a voice profile

book-crafter's craft rules structurally conflict with Dag's style:

| book-crafter (CRAFT rules) | Dag Heward-Mills style |
|---|---|
| Scene-first literary openers (named human, time-marker, sensory detail) | Plain declaration of the point, straight into teaching |
| Bans "There are [N] reasons why..." and numbered-steps framing | Numbered points ARE the signature ("Seven reasons...", "Twenty steps...") |
| Vulnerability beats, central images, show-don't-tell ratios | Direct commands, repeated one-line key statements, scripture blocks |
| 12-20 chapter standard books, 40-60K words | Short topical books, many very short chapters (~800–2,000 words) |

A voice profile alone can't override deterministic craft-check enforcement. The style layer (craft rules + rubric + voice profile + formatter layout) must be replaced wholesale; the pipeline machinery (stages, subagents, state detection, approval gates) is kept.

## Decisions (locked)

1. **Name:** `dag-book-crafter` (repo `dag-book-crafter-plugin`), skills namespaced `dag-book-crafter:*`
2. **Visibility:** Public GitHub under `gygundo`, MIT licence
3. **Style source:** 8 representative books analyzed from `~/Documents/Books/LEON BOOKS/Dag Heward-Mills/`:
   - Those Who Pretend (Loyalty And Disloyalty)
   - Leaders and Loyalty
   - Steps To The Anointing
   - Catch the Anointing
   - How You Can Become a Strong Christian
   - How to Pray
   - The Art of Ministry
   - He That Hath (Success)
4. **Copyright stance:** The shipped voice profile is *descriptive* (patterns, rhythms, structures). No copyrighted book text is committed to the repo. Source PDFs never enter the repo.

## Architecture

Identical pipeline to book-crafter v1.1.0:

```
Stage 0.5  sermon-adapter   (conditional; spoken → written rhythm — kept, retuned to Dag's
                             preaching-adjacent register: it converts less aggressively since
                             Dag's written style retains sermonic directness)
Stage 1    outliner         (topical outline; booklet tier DEFAULT: 10–25 short chapters)
Stage 2    researcher       (per-chapter scripture research; KJV default translation)
Stage 3    writer           (parallel chapter-writer subagents)
Stage 4    editor           (3 passes: voice audit + craft-check.js, flow, cross-chapter)
Stage 4.5  enricher         (discussion questions, summaries, prayer points, foreword)
Stage 5    formatter        (docx-js; Dag-style layout)
```

Supporting components kept: `agents/chapter-writer.md`, `agents/chapter-editor.md`, `skills/voice-builder` (so Leon can build his own profile), `skills/sample` (smoke test), `scripts/craft-check.js` + tests, Book DNA pattern, per-book state directory under `~/Documents/Books/<title>/`.

## The Dag style layer (replaces bestseller layer)

### `references/voice-profiles/dag-default.md`
Built from the 8-book analysis. Required sections per voice-profile-spec (Tone, Sentence Patterns, Vocabulary, Emphasis Techniques, Anti-Patterns) + Theological Framework, Scripture Handling (KJV, block quotes, repetition allowed), Reader Moments equivalent (ministry/life situations).

### `references/dag-craft-rules.md` (replaces bestseller-craft-rules.md)
Rules DAG-01…DAG-08 (final list confirmed by the style analysis; expected shape):

| ID | Rule | Enforcement |
|---|---|---|
| DAG-01 | Chapter opens with a plain declaration of its point within the first 2 sentences | deterministic (presence of declarative opener) + LLM quality |
| DAG-02 | Every major point anchored to a quoted scripture block (KJV default) | deterministic (blockquote density) |
| DAG-03 | Numbered-point structure encouraged; points must be parallel in construction | LLM judgment |
| DAG-04 | One-line key statements repeated/bolded (his signature summary sentences) | deterministic regex |
| DAG-05 | Chapter length 800–2,000 words hard cap | deterministic word count |
| DAG-06 | Readability: short sentences, simple vocabulary (no academic hedging, minimal transliterated Greek) | deterministic heuristics + LLM |
| DAG-07 | Direct "you" address present throughout; commands/imperatives allowed | deterministic |
| DAG-08 | Real-life/ministry illustrations, briefly told — no long literary scenes | LLM judgment |

`scripts/craft-check.js` rewritten to enforce the deterministic subset; `test-craft-check.js` and rubric regression tests updated with Dag-style fixtures.

### `references/dag-calibration.md` + captivation rubric retuned
Scoring anchored to "reads like a Dag book" (clarity, directness, scripture saturation, practical steps) instead of literary captivation.

### Formatter layout
- Short-book feel: centered chapter numbers + titles, generous whitespace
- Scripture blocks: indented italics with bold reference line
- Bold numbered point headings
- Same front/back matter machinery (title pages, TOC, about-the-author, scripture index)

## Style distillation workflow (build-time, not shipped)

1. `pdftotext` the 8 PDFs into scratchpad
2. Parallel analysis agents (one per book) return structured findings: chapter structure, openers, sentence stats, scripture quoting pattern, numbered lists, vocabulary, emphasis devices, illustration style, chapter word counts
3. Synthesis into `dag-default.md` + craft-rule thresholds (e.g. actual median chapter length, scripture blocks per chapter)

## Publishing

- `.claude-plugin/plugin.json` (name `dag-book-crafter`), root `marketplace.json`
- README with 3-command install for Leon:
  `/plugin marketplace add gygundo/dag-book-crafter-plugin` → `/plugin install dag-book-crafter@dag-book-crafter-plugin` → `/reload-plugins`
- MIT LICENSE, CHANGELOG starting at 1.0.0
- `.gitignore` excludes any local analysis artefacts

## Out of scope

- PDF output, fiction, non-theological genres
- Shipping any Dag book text, cover imagery, or his name in the plugin's *generated output* (the tool writes in the style; authorship of generated books belongs to the user)
- Changes to the original book-crafter-plugin

## Verification

- `node scripts/test-craft-check.js` and rubric regression tests pass
- `/dag-book-crafter:sample` fixture exercises the pipeline (deterministic parts verified in CI-less local run)
- Fresh-eyes review of README install path
