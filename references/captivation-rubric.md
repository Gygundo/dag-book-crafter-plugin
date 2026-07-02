---
schema_version: 2
total_range: [0, 16]
components:
  - key: clarity_of_point
    label: "Clarity of Point"
    range: [0, 2]
  - key: scripture_saturation
    label: "Scripture Saturation"
    range: [0, 2]
  - key: structural_parallelism
    label: "Structural Parallelism"
    range: [0, 2]
  - key: direct_address
    label: "Direct Address"
    range: [0, 2]
  - key: simplicity
    label: "Simplicity"
    range: [0, 2]
  - key: emphasis_repetition
    label: "Emphasis & Repetition"
    range: [0, 2]
  - key: illustration_discipline
    label: "Illustration Discipline"
    range: [0, 2]
  - key: novelty_variation
    label: "Novelty / Variation"
    range: [0, 2]
dimensions:
  - key: novelty_dedup
    type: binary
    values: [pass, fail]
thresholds:
  sample_gate:
    captivation_total_min: 10
    novelty_dedup: pass
output_fields:
  - captivation_total
  - components
  - novelty_dedup
  - novelty_dedup_flags
  - rewrite_targets
---

# Captivation Rubric (Dag Teaching Style)

> Chapter-level quality scoring for the Dag fork. 8 components × 0-2 points = 0-16 total, same schema shape as book-crafter v2 so the sample gate and editor machinery are unchanged — but every component measures fidelity to the Dag teaching style instead of literary-bestseller craft. Invoked by editor Pass 1 and Pass 2 — scoring logic lives here as the single source of truth.

## Components

### Clarity of Point

Does the chapter state its point plainly and immediately, and does every section make exactly one point?

**Detection approach:** Read the chapter opener — it must be an anchor scripture, plain declaration, or definition (DAG-01), with the chapter's thesis unmistakable within the first two prose sentences. Then scan each numbered point/section: one proposition each, stated in the heading itself.

**Scoring:**
- 2 points: Opener declares the theme within two sentences; every point heading is a complete one-proposition sentence
- 1 point: Theme clear but delayed past the first paragraph, OR some point headings are vague labels rather than propositions
- 0 points: Chapter opens with narrative warm-up or the reader cannot say what the chapter claims after the first 150 words

### Scripture Saturation

Verse-first architecture: is every major point anchored to a quoted scripture block, at authentic density?

**Detection approach:** Count scripture blocks vs chapter body words (target ≥1 per 350 words, floor 3 per DAG-02). Check each block has a reference line, KJV default / labelled alternates, and is followed within 2 paragraphs by a plain-words restatement or application.

**Scoring:**
- 2 points: Density met, every block interpreted, ≥1 block carries ALL-CAPS emphasis on its operative phrase
- 1 point: Density met but ≥1 block left uninterpreted, OR density slightly under (≥1 per 500 words)
- 0 points: Fewer than 3 blocks, or blocks dropped in without interpretation, or non-KJV base text unlabelled

### Structural Parallelism

The numbered-list skeleton: counted titles, parallel stems, bold full-sentence points.

**Detection approach:** For list chapters (outline `list_structure` with a stem), verify the point count matches any counted title, points are numbered with bold complete-sentence headings, and ≥60% of points reuse the declared stem frame. For flowing chapters, verify short title-case section headings are present (2-4).

**Scoring:**
- 2 points: Count matches title, stems parallel throughout, points follow the atomic unit (heading → scripture → restatement → application)
- 1 point: List present but stem drifts across points, or count mismatch of one, or atomic unit frequently incomplete
- 0 points: Designated list chapter rendered as undifferentiated essay prose

### Direct Address

The preacher speaking TO the reader: you-density, commands, question volleys, exhortation close.

**Detection approach:** Count "you/your/yourself" in author prose (target ≥8 per 1,000 words), imperative commands (≥3), rhetorical questions (≥4, ideally in volleys). Check the final paragraph lands (command, benediction, prayer, exclamation, scripture, or stated moral — never cliffhanger).

**Scoring:**
- 2 points: All four thresholds met, chapter closes with exhortation/benediction energy
- 1 point: You-density met but commands or questions sparse, or flat (non-cliffhanger) ending
- 0 points: Detached third-person register, or chapter ends on a cliffhanger/teaser

### Simplicity

Plain language at grade 6-8: short sentences, defined terms, zero hedging.

**Detection approach:** Average author-prose sentence length (≤18 words, target 12-16); scan for banned hedging phrases (DAG-06); check any hard word gets a one-sentence definition; ≤1 transliterated term, glossed simply; paragraphs ≤~120 words.

**Scoring:**
- 2 points: Sentence average in range, zero hedging, all terms defined, paragraphs short
- 1 point: Sentence average 18-22, or one undefined hard term, or a long paragraph
- 0 points: Any hedging phrase, academic register, or sentence average >22

### Emphasis & Repetition

The signature emphasis devices that make the style quotable.

**Detection approach:** Check for (a) ≥1 standalone one-line key statement (the outline's `key_statement` present in the chapter), (b) ALL-CAPS phrase inside ≥1 scripture quote, (c) ≥1 anaphora run (identical opener ×3+) OR definition-refrain restatement, (d) exclamation punchlines closing paragraphs.

**Scoring:**
- 2 points: Key statement lands + CAPS-in-quote + at least one anaphora run or refrain
- 1 point: Two of the three device families present
- 0 points: One or none — the chapter reads as flat exposition

### Illustration Discipline

Brief, functional illustrations with the lesson stated — never literary scenes, never fabricated testimony.

**Detection approach:** Count illustrations (1-3 per chapter). Each: ≤300 words, opens with a formula time-marker or frame ("Years ago...", "The story below teaches us..."), ends with the moral stated explicitly. First-person testimony must trace to a `testimony_seed`; without a seed the illustration must be biblical retelling, everyday analogy, or anonymised third-party.

**Scoring:**
- 2 points: 1-3 illustrations, all within length, all with stated morals, all testimony seeded
- 1 point: Illustration overlong or a moral left implicit, but no fabrication
- 0 points: Zero illustrations in a chapter that needs one, a literary scene-setting opener, or ANY fabricated first-person testimony (this also triggers DAG-08 auto-revise)

### Novelty / Variation

Measures whether the chapter's NON-EXEMPT prose is varied across a whole-manuscript scan. Deliberate repetition is native to this style, so the exemption list is wider than book-crafter's: scripture blocks, declared refrains (list stems, key statements, definitions), and benediction formulas are exempt. Everything else must not loop.

This component is evaluated over the whole manuscript and stamped onto every chapter's scorecard.

**Sub-checks (collapse into one 0-2 score):**

- **Illustration distinctness:** No two chapters may reuse the same illustration, anecdote, or analogy vehicle. A verse may repeat; a story may not.
- **Cross-artefact 6+ word span dedup:** Scan `front-matter/*.md` + `edited/ch*-final.md`. Any 6+ word span appearing in ≥2 files — outside scripture blocks and declared refrains within their `max_uses` budget — fails this sub-check.
- **Aphorism freshness:** Each chapter's key statement must be distinct across the book (unless declared as a whole-book refrain with budget).

**Scoring:**
- 2 points: All sub-checks pass — repetition is confined to the exempt classes
- 1 point: Minor echoes, but every echo falls under a declared refrain within its `max_uses` budget
- 0 points: A repeated illustration, a verbatim 6+ word non-exempt span across artefacts, or an undeclared repeated aphorism

**Relationship to the binary `novelty_dedup` dimension:** the 0-2 component contributes to `captivation_total`; the binary `novelty_dedup` is a separate output field. The sample release gate requires BOTH `captivation_total >= captivation_total_min` AND `novelty_dedup == pass`.

## Scoring Aggregation

Each chapter receives a `captivation_total` (0-16) based on eight components (0-2 points each):

| Component | What it measures | Source |
|-----------|-----------------|--------|
| Clarity of Point | Plain opener + one proposition per point | Pass 1 |
| Scripture Saturation | Verse-first density + interpretation | Pass 1 |
| Structural Parallelism | Counted lists, parallel stems, atomic unit | Pass 1 |
| Direct Address | You-density, commands, questions, landing | Pass 1 |
| Simplicity | Sentence length, no hedging, defined terms | Pass 1 |
| Emphasis & Repetition | Key statements, CAPS-in-quote, anaphora | Pass 1 |
| Illustration Discipline | Brief functional stories, stated morals, seeded testimony | Pass 2 |
| Novelty / Variation | Non-exempt prose distinct across manuscript | Pass 3 |

Total range: **0-16**.

**Thresholds (0-16 scale):**

| Total | Band | Meaning |
|-------|------|---------|
| 0-6   | Below craft floor | Chapter requires revision |
| 7-9   | Weak | Ships only if no hard gates fired |
| 10-12 | Competent | Ships as-is |
| 13-16 | Strong | Authentic Dag-teaching-style quality |

**Sample release gate (schema v2):** The release gate requires BOTH `captivation_total >= 10` AND `novelty_dedup == pass`. Either failing hard-fails the release. See `skills/sample/SKILL.md` for the canonical YAML read.
