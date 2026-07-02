# Dag Book Crafter Pipeline Stages

Reference document describing the five stages of the book-writing pipeline. The orchestrator uses this to guide the user through the process and to determine which stage to execute next.

## Stage 0.5: Sermon Adaptation (sermon-adapter skill) [CONDITIONAL]

**Input:** Source files in `sources/` directory that contain sermon-format content
**Output:** `sources-adapted/` directory with transformed source files
**Conditional:** Only runs when sermon-format source material is detected (ALL CAPS headings, audience pronouns, verbal cues, temporal/spatial references) AND user confirms
**Parallel:** No -- processes files sequentially

The sermon adapter converts spoken transcript to WRITTEN Dag register. It converts:
- Spoken fragments -> complete short sentences
- Audience-specific references ("our church", "this morning", "here in this room") -> universal "you" address
- Verbal filler ("Watch this", "Here's where it gets good") -> clean prose transitions

It keeps (these are target features, not problems to fix):
- Numbered points (retained with bold full-sentence headings per DAG-03)
- Repetition-for-emphasis (retained as anaphora — identical openers ×3+ per the voice profile)
- Block-quoted scripture with commentary (retained in blockquote format with reference lines per DAG-02)

After adaptation, the outliner's Source Ingestion Mode reads from `sources-adapted/` instead of `sources/`.

## Stage 1: Outline (outliner skill)

**Input:** Topic brief (topic, key themes, target audience, optional scriptures) OR existing content (sermon transcripts, notes, blog posts)
**Output:** `chapter-outline.md` + initial `book-dna.md`
**Approval gate:** User must review and approve the outline before Stage 2 begins.

The outliner generates a chapter-by-chapter structure including:
- Chapter titles and opener types (anchor_scripture, plain_declaration, or definition per DAG-01)
- Key arguments and supporting scriptures per chapter
- Topical arc with momentum positioning (chapters ordered from foundation to commissioning close; self-contained, no cross-chapter suspense)
- Book size tier: booklet (8–15 chapters, 10–20K words, ~800–2,000 words/chapter — default), short (15–25 chapters, 20–35K words), standard (15–25 chapters, 35–50K words)

## Stage 2: Research (researcher skill)

**Input:** Approved `chapter-outline.md` + `book-dna.md`
**Output:** `research/ch01-research.md`, `research/ch02-research.md`, etc.
**Parallel:** Yes -- one researcher subagent per chapter, batched in waves of 8-10

Per-chapter research includes:
- Scripture references (actual Bible text, KJV default — alternates labelled with translation name, e.g. NASB)
- Per-point proof texts and brief cross-references across Old and New Testaments
- Greek/Hebrew word studies limited to at most one simple gloss per chapter (DAG-06: "'Aman' means 'to nurture'" style — no academic apparatus)
- Illustration candidates and supporting material

## Stage 3: Write (writer skill + chapter-writer subagent)

**Input:** `book-dna.md` + `research/ch*-research.md` per chapter
**Output:** `drafts/ch01-draft.md`, `drafts/ch02-draft.md`, etc.
**Parallel:** Yes -- one chapter-writer subagent per chapter, batched in waves of 8-10

Each chapter agent reads the full Book DNA for voice consistency and its chapter-specific research. Chapters are written in markdown as intermediate format.

## Stage 4: Edit (editor skill + chapter-editor subagent)

**Input:** `book-dna.md` + `voice-profile.md` + all `drafts/ch*-draft.md` files
**Output:** `edited/ch01-final.md`, `edited/ch02-final.md`, etc. + `reports/consistency-report.md`
**Parallel:** Partially -- Pass 1 voice audit can use parallel subagents for 16+ chapter books; Passes 2-3 are sequential

Editing passes (sequential):
1. **Pass 1: Voice + DAG craft checks** -- runs `scripts/craft-check.js` deterministic checks (DAG-01..08) and scores all 8 rubric components (clarity_of_point, scripture_saturation, structural_parallelism, direct_address, simplicity, emphasis_repetition, illustration_discipline, novelty_variation). Audits vocabulary, sentence rhythm, and anti-patterns against the voice profile. Normalises drift.
2. **Pass 2: Opener/landing audits, key statement audit, testimony seed audit, illustration discipline** -- verifies each chapter opens with the outline's declared opener_type; confirms the key_statement lands in the chapter text; checks each first-person illustration traces to a testimony_seed; audits illustration count and length (DAG-08).
3. **Pass 3: Cross-chapter validation** -- builds term index, validates scripture translation consistency (KJV unlabelled, alternates labelled), tracks theme development; applies widened dedup exemptions (scripture blocks, declared refrains, and benedictions are exempt — verse repetition across chapters is a feature, not a defect).

Intermediate artefacts: `edited/ch[NN]-pass1.md`, `edited/ch[NN]-pass2.md` (kept for debugging, not used by pipeline state detection)

**Reports:** `reports/consistency-report.md` with per-chapter findings, severity levels, and specific locations.

**Review gate:** After editing completes, the orchestrator presents the consistency report and offers: approve (proceed to Stage 5), revise specific chapters, or read the full draft.

**Revision workflow:** User requests chapter rewrites with targeted feedback. For each revised chapter:
1. Original draft backed up to `revisions/ch[NN]-v[VV]-draft.md` (version auto-incremented)
2. Chapter re-written by writer agent with user feedback
3. Editor re-runs Pass 1 on revised chapter, Pass 2 on revised chapter + immediate neighbours, Pass 3 on affected references
4. Consistency report updated

**Rolling window:** For books with 16+ chapters, Pass 1 uses chapter-editor subagents. Each receives the current chapter plus 500 words overlap from adjacent chapters.

## Stage 4.5: Content Enrichment (enricher skill)

**Input:** All `edited/ch[NN]-final.md` files + `book-dna.md` + `voice-profile.md`
**Output:** `enrichments/ch[NN]-enrichments.md` per chapter + `front-matter/foreword.md`
**Parallel:** No -- processes chapters sequentially

Per-chapter enrichments include:
- **Discussion questions** (3-5) -- specific to the chapter's unique arguments, passes cliche test (no generic questions)
- **Chapter summary** (3-5 sentences) -- captures core argument, key supporting points, contribution to book arc
- **Prayer points** (2-4, theological books only) -- connected to specific chapter revelations, addressed to God in prayer format

Foreword:
- 500-800 words framing the book's purpose
- Two modes: author voice (default) or endorser draft
- Does NOT summarise chapters or spoil climax revelations

The formatter renders enrichment sections inline after each chapter body in the .docx.

## Stage 5: Format (formatter skill)

**Input:** All `edited/ch*-final.md` files + `book-dna.md` + `voice-profile.md` + `enrichments/ch*-enrichments.md` (if present) + `front-matter/foreword.md` (if present)
**Output:** `output/[Book Title].docx`
**Parallel:** No -- single document generation

### Document Section Architecture

The generated .docx contains multiple sections with different page numbering:

1. **Half Title Page** -- centred title only, no headers/footers
2. **Full Title Page** -- title, subtitle, author name, no headers/footers
3. **Copyright Page** -- copyright notice, scripture permission, ISBN placeholder
4. **Dedication Page** -- placeholder for user-supplied dedication
5. **Foreword** -- (if has_foreword) read from front-matter/foreword.md, styled as body text with "Foreword" as Heading 1
6. **Table of Contents** -- auto-generated from chapter headings (HeadingLevel.HEADING_1), roman numeral page numbers
7. **Body (all chapters)** -- single section, chapters separated by pageBreakBefore, arabic page numbers restart at 1, header with book title, footer with "Page X of Y". After each chapter's body paragraphs (if has_enrichments): Discussion Questions (Heading 2, numbered list), Chapter Summary (Heading 2, italic text), Prayer Points (Heading 2, bulleted via LevelFormat.BULLET numbering -- theological only)
8. **About the Author** -- author bio or placeholder
9. **Scripture Index** -- auto-extracted from chapter content and METADATA blocks, sorted by canonical Bible book order
10. **Glossary** -- from Book DNA Key Terms table

### Typography

- Font: Georgia throughout
- Body: 12pt, 1.5 line spacing
- Chapter number + title: centred; chapter number on its own line above the title; 24pt bold; page break before
- Scripture blocks: indented, italic, reference line beneath (`> -- Reference` style); not inline with running prose
- Numbered point headings: bold, complete sentence, numbered (1., 2., ...)
- Page size: US Letter (12240 x 15840 DXA)
- Margins: 1.5" top/bottom, 1" sides

### Auto-Extraction

- **Scripture Index:** Extracted from edited chapter METADATA `scriptures_used` fields + regex scan of chapter body. Deduplicated and sorted by canonical Bible book order (Genesis through Revelation). Omitted entirely for non-theological books (determined by voice profile).
- **Glossary:** Extracted from Book DNA Key Terms and Jargon table. Formatted as a two-column table (Term | Definition). Omitted if no Key Terms are defined.

### Completion Detection

Stage 5 is complete when `output/` directory contains a `.docx` file.

## Stage Completion Detection

| Stage | Complete When | Key Artefact |
|-------|---------------|--------------|
| Sermon Adapt. | `sources-adapted/` dir has files matching `sources/` count AND each contains `<!-- SERMON ADAPTED` marker | `sources-adapted/*.md` |
| Outline | `chapter-outline.md` exists AND contains `<!-- APPROVED -->` marker | `chapter-outline.md` |
| Research | `research/` dir has `ch*-research.md` files matching outline chapter count | `research/ch01-research.md` |
| Write | `drafts/` dir has `ch*-draft.md` files matching outline chapter count | `drafts/ch01-draft.md` |
| Edit | `edited/` dir has `ch*-final.md` files matching outline chapter count AND no `<!-- REVISION IN PROGRESS -->` marker in `reports/consistency-report.md` | `edited/ch01-final.md` + `reports/consistency-report.md` |
| Enrichment | `enrichments/` dir has `ch*-enrichments.md` files matching chapter count AND `front-matter/foreword.md` exists | `enrichments/ch01-enrichments.md` + `front-matter/foreword.md` |
| Format | `output/` dir contains `.docx` file | `output/[Title].docx` |
