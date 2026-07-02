# Dag Book Crafter

> **Requires:** Claude Code + Node ≥18. Check with `node -v`.

Writes short, easy-to-read, topical Christian books in the teaching style of Dag Heward-Mills — plain declarations, numbered points with parallel stems, scripture-anchored chapters, brief functional illustrations, and exhortation endings — backed by 8 countable craft rules and a captivation gate.

> *And be ye kind one to another, tenderhearted, FORGIVING ONE ANOTHER, even as God for Christ's sake hath forgiven you.*
> — Ephesians 4:32
>
> Unforgiveness is a poison that you drink yourself, hoping that someone else will die. Many Christians are weak, sick and joyless for one reason only: they are holding an offence. It is time to let it go!
>
> *— Generated sample (calibration exemplar)*

## What makes this different from Book Crafter

[Book Crafter](https://github.com/gygundo/book-crafter-plugin) writes literary-bestseller non-fiction: scene-first openers, central images, vulnerability beats. This plugin is a fork with the opposite style layer — derived from a build-time analysis of eight published Dag Heward-Mills books:

| Book Crafter | Dag Book Crafter |
|---|---|
| Scene-first literary openers | Anchor scripture, plain declaration, or definition openers |
| Numbered lists banned | Numbered points ARE the skeleton ("Seven Reasons Why...") |
| Central images, vulnerability beats | Key statements, ALL-CAPS scripture emphasis, benedictions |
| 12–20 chapters, 40–60K words | 8–15 short chapters, 10–20K words (booklet default) |
| NKJV default | KJV default, labelled alternates |

The pipeline machinery is the same proven five-stage system: outline → research → write (parallel chapter agents) → edit (three passes + deterministic craft checks) → enrich → format to a professional `.docx`.

## Install

Run these three commands in Claude Code:

    /plugin marketplace add gygundo/dag-book-crafter-plugin
    /plugin install dag-book-crafter@dag-book-crafter-plugin
    /reload-plugins

That's it. You're ready to write a book.

## How to run it

Ask Claude Code to write you a book. A natural prompt like *"write me a short book on loyalty"* or *"write a booklet: Seven Keys to a Strong Prayer Life"* is enough. Dag Book Crafter will ask for a topic and a length, then work through outline, drafting, editing, and formatting. You stay in control at each approval gate.

You can also feed it your own sermon transcripts — drop them in the project's `sources/` directory and the sermon adapter converts spoken rhythm to the written teaching register (keeping the numbered points and scripture blocks that are native to this style).

**First-person stories are never invented.** The writer only uses "I remember..." testimony when it can trace to real source material you supplied; otherwise it uses biblical retellings, everyday analogies, or anonymised third-party anecdotes.

## What this makes

A professionally formatted `.docx` with a title page, table of contents, centred chapter headings, indented italic scripture blocks with reference lines, bold numbered point headings, optional discussion questions and prayer points per chapter, and a scripture index — ready to open in Microsoft Word, Google Docs, or Pages.

Output lands in `~/Documents/Books/<your book title>/output/`.

## Try the built-in sample

Run `/dag-book-crafter:sample` in Claude Code to exercise the full pipeline on a short built-in fixture. The sample prints a one-line PASS or FAIL summary when it finishes — useful as a quick smoke-test after install.

## The craft rules

Eight enforced rules (`references/dag-craft-rules.md`), the deterministic subset checked by `scripts/craft-check.js`:

- **DAG-01** Verse-or-declaration opener — no story/scene openers
- **DAG-02** Scripture block density — every point anchored, KJV default
- **DAG-03** Numbered points with parallel stems; counted titles match their counts
- **DAG-04** Standalone key statements + ALL-CAPS emphasis in quotes
- **DAG-05** Short chapter discipline
- **DAG-06** Plain language — no hedging, grade 6–8 register
- **DAG-07** Direct address — "you", commands, question volleys, exhortation close
- **DAG-08** Brief functional illustrations with the lesson stated; testimony only from sourced seeds

## A note on style and content

This plugin emulates a *style* — the structural and rhetorical patterns of a teaching genre. The shipped voice profile is descriptive; no copyrighted book text is included in this repository. The content, theology, and authorship of any book you generate are yours. Swap `references/voice-profiles/dag-default.md` for your own profile (or build one with the voice-builder skill) to keep the pipeline and change the voice.

## Licence

MIT. See [LICENSE](./LICENSE).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
