# Dag Book Crafter Plugin

A multi-skill Claude Code plugin that writes short, easy-to-read, topical Christian books in the teaching style of Dag Heward-Mills, from a topic brief or sermon transcripts through to a professionally formatted .docx. Forked from book-crafter-plugin v1.1.1: the pipeline machinery is identical; the style layer is replaced.

## Architecture

Five sequential stages with parallel chapter agents during writing and editing:

```
Stage 0.5  sermon-adapter   (conditional: spoken -> written Dag register; KEEPS numbered
                             points, anaphora, and scripture blocks)
Stage 1    outliner         (topical outline; booklet default 8-15 short chapters)
Stage 2    researcher       (per-point KJV proof texts, illustration candidates)
Stage 3    writer           (parallel chapter-writer subagents)
Stage 4    editor           (3 passes + deterministic craft-check.js)
Stage 4.5  enricher         (discussion questions, summaries, prayer points, foreword)
Stage 5    formatter        (docx-js; centred chapter headings, indented scripture blocks)
```

## Single sources of truth

- `references/dag-craft-rules.md` - DAG-01..08. Regexes and thresholds here are authoritative; `scripts/craft-check.js` implements them and MUST stay in sync.
- `references/voice-profiles/dag-default.md` - the default voice. Descriptive only; never add quoted text from published books.
- `references/captivation-rubric.md` - scoring schema (frontmatter YAML is machine-read by the sample gate).
- `references/book-dna-template.md` - per-book master context shape. Chapter craft fields: `opener_type`, `list_structure`, `key_statement`, `testimony_seed`.

## Non-negotiables

- **No copyrighted book text anywhere in this repo.** The style profile is descriptive; calibration exemplars are original compositions.
- **No fabricated first-person testimony** in any generated or fixture prose - testimony requires a resolvable `testimony_seed`.
- **Version stamp** `<!-- generated-by: dag-book-crafter v<semver> -->` on every generated artefact; keep in sync with `.claude-plugin/plugin.json`.
- **Deliberate repetition is native**: scripture blocks, declared refrains (list stems, key statements), and "May you..." benedictions are dedup-exempt. Everything else must not repeat.
- KJV default, labelled alternates. British/SA spelling.

## Testing

```bash
node scripts/test-craft-check.js        # deterministic rule checks
node scripts/test-rubric-regression.js  # rubric schema lock
```

Run both before any release. `/dag-book-crafter:sample` exercises the full pipeline on `fixtures/tiny-book/` (LLM stages included - slower, token-costly).

`fixtures/tiny-book/adversarial*` are test-only known-bad manuscripts; `scripts/release.sh` excludes them from staging (Gate 3b).

## Relationship to book-crafter

Do not port bestseller craft back in (scene openers, central images, vulnerability beats, pulpit-seam bans - all deliberately inverted here). If you fix a pipeline-machinery bug that also exists in book-crafter-plugin, note it in the commit message so it can be upstreamed.
