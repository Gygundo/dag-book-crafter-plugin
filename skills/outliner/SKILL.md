---
name: outliner
description: "Generate a chapter-by-chapter book outline from a topic brief or existing content. Called by the orchestrator during the outline stage of the book pipeline. Triggers on: 'outline a book', 'book outline', 'chapter outline', 'plan a book structure'."
user-invocable: false
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Book Outliner

Generates a chapter-by-chapter book outline with structured metadata per chapter, maps a topical progression, and populates the Book DNA master context document after user approval.

## 1. On Invocation

Receive the project directory path via `$ARGUMENTS`. Read the following from the project directory:

1. `book-dna.md` -- for metadata (title, subtitle, author, size tier, target word count)
2. `voice-profile.md` -- for voice characteristics to inform outline tone

Extract from `book-dna.md`:
- **Title** and **Subtitle** (from Metadata section)
- **Author** (from Metadata section)
- **Size tier** (booklet | short | standard)
- **Topic brief or description** (from Metadata or provided inline by orchestrator)

Extract from `voice-profile.md`:
- Whether the profile includes a Theological/Domain Framework section (determines if scriptures are required per chapter)
- The overall tone and voice characteristics (influences chapter title style and opener choices)

## 2. Determine Mode

Check the project directory for source content, preferring adapted content when available:

1. If a `sources-adapted/` directory exists and contains `.md`, `.txt`, or `.docx` files: use **Source Ingestion Mode** (section 4) reading from `sources-adapted/`
2. Else if a `sources/` directory exists and contains `.md`, `.txt`, or `.docx` files: use **Source Ingestion Mode** (section 4) reading from `sources/`
3. If neither directory contains source files: use **Topic Brief Mode** (section 3)

Log which mode is being used:
- "Mode: Topic Brief" -- generating outline from topic brief and metadata
- "Mode: Source Ingestion (adapted, [N] source files from sources-adapted/)" -- using sermon-adapted content
- "Mode: Source Ingestion ([N] source files from sources/)" -- using raw source content

## 3. Topic Brief Mode

Generate a book outline from scratch using the topic brief, key themes, target audience, and optional scriptures from the project metadata.

### Step 1: Determine chapter count from size tier

| Size Tier | Chapters | Total Words | Per-Chapter Words | Note |
|-----------|----------|-------------|-------------------|------|
| Booklet *(DEFAULT)* | 8-15 | 10-20K | ~800-2,000 | Chapter length is driven by point count, not a template |
| Short     | 15-25    | 20-35K      | ~1,000-2,000 | |
| Standard  | 15-25    | 35-50K      | ~1,500-3,000 | |

Choose a specific chapter count within the tier range based on the complexity and breadth of the topic. A narrow topic with deep treatment favours fewer, longer chapters. A broad topic with survey treatment favours more, shorter chapters. Chapter length imbalance across the book is authentic — a 700-word chapter may sit beside a 3,000-word one.

### Step 2: Design the topical progression

Before writing individual chapters, map the book's overall topical progression. Chapters are self-contained; the arc orders topics, it does not create suspense or withhold resolution.

- **What to understand first:** Which foundational truths, definitions, or warnings must be established before the other teaching makes sense?
- **What builds on it:** What sequence of topics deepens understanding naturally — each chapter assuming what was taught before?
- **Strongest chapters:** Which topics deserve the fullest treatment and sit at the book's peak? These are where the main burden of proof lies.
- **Commissioning close:** How does the book land the reader? A final exhortation, call to action, or blessing that sends them out to act on what they have learned.

Write the arc as a single line:
`[What to understand first] -> [What builds on it] -> [Strongest chapters] -> [Commissioning close]`

### Step 3: Assign momentum positions

Each chapter receives a momentum position that determines its energy, pacing, and structural role:

| Position | Typical Chapters | Purpose |
|----------|-----------------|---------|
| Foundation | Chapters 1-2 | Establish the premise, define key terms, orient the reader to the book's central claim. |
| Building | Early-middle chapters | Develop arguments, deepen understanding, introduce further distinctions. Each chapter adds a new layer. |
| Accelerating | Mid-late chapters | Intensify urgency, connect threads, apply more directly to the reader's situation. |
| Climax | 1-2 chapters near end | Fullest and strongest teaching content. The main burden of the book lands here. |
| Landing | Final 1-2 chapters | Commissioning close: exhortation, call to action, blessing, or prayer that sends the reader out. |

Every outline must use all five momentum positions. The distribution should feel natural -- chapters may share a position, but the overall trajectory must move from Foundation through Landing.

### Step 4: Generate per-chapter metadata

For each chapter, generate:

- **Title:** Use Dag title patterns: counted lists ("Seven Ways to Deal with Familiarity", "Twelve Signs of Disloyalty"), "How to..." / "How You Can..." formulas, "Those Who..." constructions, or plain thematic titles. When a counted title is used, the number MUST match the chapter's point count exactly. Avoid vague or literary titles ("Chapter 3: More About Faith").
- **Core point:** The single proposition this chapter teaches, in one sentence. Every passage in the chapter serves this proposition.
- **opener_type:** Choose ONE of the three valid openers per DAG-01:
  - `anchor_scripture` -- a block-quoted scripture immediately after the chapter title, key phrase in ALL CAPS, followed by a plain declarative sentence orienting the reader to the theme.
  - `plain_declaration` -- a flat thesis statement of the chapter's point within the first two sentences ("You must be anointed because no one can fulfil his ministry by natural might.").
  - `definition` -- the chapter's key term defined in the first sentence ("Intimidation is the art of deterring or controlling someone through fear.").
  **Story openers are forbidden** (DAG-01). Stories belong inside numbered points, never at the chapter opening.
- **Anchor scripture:** The reference to quote at the chapter head. Mandatory when `opener_type` is `anchor_scripture`. Omit when opener is `plain_declaration` or `definition`.
- **Key scriptures:** 2-6 scripture references the chapter will draw on. KJV default; non-KJV must be labelled. For non-theological voice profiles, write "[N/A -- non-theological voice profile]".
- **list_structure:** Either `{stem: "[the repeated grammatical frame every point reuses]", count: N}` for list chapters (e.g. `stem: "Develop steadfastness by...", count: 7`) OR `flowing` for narrative-teaching chapters. Most chapters should be list chapters. When a stem and count are declared, the chapter title MUST use that count. See DAG-03.
- **key_statement:** The chapter's one-line quotable aphorism -- the signature maxim the reader should carry away ("The anointing is not something you learn, it is something you catch."). Must be distinct from key statements in other chapters unless declared as a refrain. See DAG-04.
- **testimony_seed:** A pointer to real source material for the chapter's first-person testimony illustration. Format: `source_path:line` (examples: `sources/sermon-2024-03-15.md:42`, `book-dna.md:89`, `voice-profile.md:12`). Permitted source paths: `sources/{file}.md`, `sources-adapted/{file}.md`, `book-dna.md`, `voice-profile.md`. If no real fragment can be found after walking all available sources, leave empty with the note `no testimony available -- use biblical retelling, everyday analogy, or third-party anecdote`. Never invent a seed. See DAG-08.
- **Momentum position:** Foundation | Building | Accelerating | Climax | Landing
- **Connects to:** Which other chapters this chapter builds on or applies. Format: "Ch [X] (builds on [concept])", "Ch [Y] (applies [concept])". Every chapter must connect to at least one other chapter.
- **Target word count:** Calculated from the size tier's per-chapter range. Imbalance across chapters is authentic and acceptable -- never pad a chapter to meet a target when the argument is complete.

### Step 5: Cross-chapter coherence check

After generating all chapters, review the complete outline for coherence:

1. **Coverage check:** Does the topical progression cover the book's subject completely? Are there gaps in the teaching?
2. **Sequence check:** Is the teaching order logical -- do later chapters build on what earlier ones established?
3. **Momentum check:** Do the momentum positions actually escalate? Is there a clear build from Foundation through Landing?
4. **Connection density:** Are there enough cross-chapter references? Aim for at least 2 connections per chapter on average.
5. **Peak delivery:** Do the Climax-position chapters carry the fullest, most substantive teaching? The strongest content must sit at the peak.
6. **Landing energy:** Does the Landing chapter close with exhortation, command, or blessing -- not an open question or a teaser?

If any check fails, revise the affected chapters before writing the output file.

### Key Statement Distinctness Check

After assigning `key_statement` to every chapter, re-read the full list and verify no two chapters share a near-identical aphorism. Use semantic judgement, not string match: "The anointing must be pursued" vs "The anointing must be sought" is too similar and must be revised; "The anointing flows to the humble" vs "Loyalty protects your ministry" is distinct enough. If any pair is too similar, rewrite one so the two statements are clearly distinct propositions. Near-duplicate key statements cause the book to blur -- the reader cannot distinguish the chapter's core truth.

### Illustration Distinctness Expectation

No two chapters should reuse the same illustration, analogy vehicle, or anecdote. Different episodes from the same biblical narrative are acceptable if the events are distinct. This expectation will be checked by the editor's Novelty / Variation component.

### Testimony Seed Sourcing

For each chapter, the outliner MUST walk the available source material to find a real fragment for the `testimony_seed`. Search order:

1. `sources-adapted/` (if present) -- adapted source prose
2. `sources/` (if present) -- raw source material
3. `voice-profile.md` -- any first-person anecdotes in the voice profile
4. `book-dna.md` -- any first-person material already lifted into the Book DNA

For each chapter, pick the line that best matches the chapter's core point and record `testimony_seed` as `source_path:line`. If no fragment exists in any of these locations for a given chapter, leave `testimony_seed` empty AND add the note `no testimony available -- use biblical retelling, everyday analogy, or third-party anecdote` so the writer uses a permitted alternative. Never invent a seed or point at a line that does not exist. The writer enforces this by refusing to fabricate testimony -- see DAG-08.

## 4. Source Ingestion Mode

Generate a book outline from existing content (sermon transcripts, notes, blog posts, outlines).

### Step 1: Read and analyse all source files

Read all files from the source directory identified in Section 2 (either `sources-adapted/` or `sources/`). Accept `.md`, `.txt`, or `.docx` files.

When reading from `sources-adapted/`, these files have already been transformed from spoken to written rhythm by the sermon adapter. The outliner should treat them as written prose -- do not apply any additional spoken-to-written transformations.

### Step 2: Extract themes and arguments

Across all source material, identify:
- **Major themes:** Recurring topics that appear across multiple sources
- **Core arguments:** Key claims or positions consistently made
- **Key quotes and illustrations:** Memorable phrases, stories, or examples worth preserving
- **Structural patterns:** How the source material is organised (chronological, topical, progressive)
- **Existing voice:** The tone and style already present in the source material

### Step 3: Transform, do not mirror

**Critical instruction: Do NOT mirror the source structure.** A sermon series and a book have fundamentally different rhythms. Sermons are standalone talks; a book is a progressive argument.

- A 6-sermon series should NOT automatically become 6 chapters
- A collection of blog posts should NOT become one chapter per post
- Notes with 10 bullet points should NOT become 10 chapters

Instead:
- Group related themes across multiple source files
- Identify the natural topical progression that emerges from the combined material
- Design a NEW book structure that serves the reader's learning, not the speaker's delivery schedule
- Some source material may be split across multiple chapters; other material may be condensed into a single chapter

### Step 4: Apply the standard outline generation process

Follow the same process as Topic Brief Mode (section 3, steps 1-5), but informed by the extracted themes, arguments, and voice from the source material.

### Step 5: Preserve key quotes and source material

For each chapter, add a **Source Material Notes** entry listing:
- Specific quotes or illustrations from the source material that should appear in this chapter
- Which source file(s) the material comes from
- Any key phrases or terminology from the source that should be preserved verbatim

This gives the writer agent concrete material to weave in, maintaining continuity with the original content.

## 5. Output: chapter-outline.md

Write the outline to `[project]/chapter-outline.md` in this exact format. **Prepend `<!-- generated-by: dag-book-crafter v1.0.0 -->` as the first line of `chapter-outline.md`** before the `# Book Outline: [Title]` heading. The comment is stripped by the formatter before .docx emission and exists only as a regression-chain anchor for Phase 12 tooling.

```markdown
# Book Outline: [Title]

## Book Arc
[What to understand first] -> [What builds on it] -> [Strongest chapters] -> [Commissioning close]

## Size Tier
[booklet | short | standard]
Target: [total word count] words, [chapter count] chapters, ~[per-chapter words] words/chapter

## Chapter 1: [Title]
- **Core point:** [Single proposition this chapter teaches]
- **opener_type:** [anchor_scripture | plain_declaration | definition]
- **Anchor scripture:** [Reference -- mandatory when opener_type is anchor_scripture; omit otherwise]
- **Key scriptures:** [2-6 references, KJV default]
- **list_structure:** [stem: "[repeated grammatical frame]", count: N] OR [flowing]
- **key_statement:** [One-line quotable aphorism -- distinct across all chapters]
- **testimony_seed:** [source_path:line OR empty with note "no testimony available -- use biblical retelling, everyday analogy, or third-party anecdote"]
- **Momentum position:** [Foundation | Building | Accelerating | Climax | Landing]
- **Connects to:** Ch [X] (builds on...), Ch [Y] (applies...)
- **Target word count:** ~[N] words

## Chapter 2: [Title]
- **Core point:** [Single proposition this chapter teaches]
- **opener_type:** [anchor_scripture | plain_declaration | definition]
- **Anchor scripture:** [Reference -- mandatory when opener_type is anchor_scripture; omit otherwise]
- **Key scriptures:** [2-6 references, KJV default]
- **list_structure:** [stem: "[repeated grammatical frame]", count: N] OR [flowing]
- **key_statement:** [One-line quotable aphorism -- distinct from Chapter 1's key statement]
- **testimony_seed:** [source_path:line OR empty with note "no testimony available -- use biblical retelling, everyday analogy, or third-party anecdote"]
- **Momentum position:** [Foundation | Building | Accelerating | Climax | Landing]
- **Connects to:** Ch [X] (builds on...), Ch [Y] (applies...)
- **Target word count:** ~[N] words

[... continue for all chapters ...]
```

Every chapter MUST have all fields present. No field may be omitted for any chapter.

The "Key scriptures" field may be "[N/A -- non-theological voice profile]" if the voice profile does not have a Theological/Domain Framework section.

For Source Ingestion Mode, add a "Source Material Notes" bullet after "Target word count" for each chapter:
```markdown
- **Target word count:** ~[N] words
- **Source Material Notes:** [Key quotes, illustrations, or source references for this chapter]
```

After writing `chapter-outline.md`, report to the orchestrator:
- "Outline generated: [N] chapters, [size tier] tier, ~[total word count] words target"
- "Momentum distribution: [N] Foundation, [N] Building, [N] Accelerating, [N] Climax, [N] Landing"
- Mode used (Topic Brief or Source Ingestion)

## Refrain Candidate Gate (Phase 13, D-08)

> Refrains are whitelisted phrases that may appear verbatim across chapters without tripping the Phase 13 dedup audit. Because a naively-inferred refrain becomes a loophole (Phase 13's root cause was a phrase that was de-facto treated as a refrain but never declared), this gate is MANDATORY -- refrains cannot be auto-inferred from the brief alone. The author must confirm each candidate phrase before it is written into the Book DNA refrains block.

**Auto-declared stems (no author gate required):** Before surfacing candidates to the author, the outliner AUTO-DECLARES each list chapter's stem (from `list_structure`) as a refrain with `scope: chapter_body` and `max_uses: [point count]`. These are pre-confirmed -- the outliner writes them directly into the Book DNA refrains block and reports them to the author as informational only, not blocking. The author confirmation gate covers only book-level maxims, repeated definitions, and any additional phrases the outliner proposes. Scripture blocks and benediction formulas ("May you...") are always exempt from dedup and never declared.

### Step 1: Extract refrain candidates

Scan the brief and your draft outline for phrases that look like signature refrains. Candidate heuristics:

- Any phrase explicitly marked signature, refrain, or recurring in the brief text
- Any phrase ≥ 6 words that appears in 2 or more outline beats
- The brief's declared tagline, subtitle, or book motto if present
- Any phrase the outliner itself is tempted to thread through multiple chapters as a callback

Produce a candidates list with each candidate's source location in the brief or outline. If zero candidates are found, the candidates list is empty and Step 2 still runs so the author can ADD refrains the outliner missed.

### Step 2: Surface candidates to the author and block handoff

BEFORE writing `book-dna.md`, present the candidates to the author in plain text. For each candidate, offer three options:

1. **Keep as refrain.** Author specifies `max_uses` (integer or the string `unlimited`) and `scope` (one of `whole_book`, `chapter_endings`, `front_matter_only`, `body_only`).
2. **Demote to normal prose.** The phrase is removed from the refrain block; `craft-check.js --novelty` will flag any repetition.
3. **Ignore** (candidate is noise -- do not include at all).

Also offer: "Add a refrain I missed" -- the author can specify a phrase the outliner did not propose.

The gate BLOCKS outline-to-Book-DNA handoff until the author has answered every candidate. The orchestrator spawns writer subagents only after this gate resolves. This is a separate gate from the existing outline approval gate -- both gates fire, both must be passed.

### Step 3: Write refrains YAML block into Book DNA

Once the author has confirmed candidates, write a YAML block into `[project_directory]/book-dna.md` under a `## Refrains` heading. Shape:

```yaml
refrains:
  - phrase: confirmed phrase text
    max_uses: 1
    scope: whole_book
  - phrase: another phrase
    max_uses: unlimited
    scope: chapter_endings
```

Every downstream skill that reads Book DNA (writer, editor, enricher, formatter, sample skill, `craft-check.js --dna`) sees this block via the existing single-source-of-truth pattern. No new skill contract, no new orchestrator wiring beyond this gate.

### Fixture bypass (D-09)

The `fixtures/tiny-book/` sample fixture ships with a pre-approved `book-dna.md` that already contains the refrains block. When the orchestrator is invoked by the sample skill (`skills/sample/SKILL.md`), the refrain candidate gate is SKIPPED -- the pre-populated refrain block is authoritative. Detection signal: the orchestrator passes a project path pointing under `fixtures/tiny-book/` AND the `book-dna.md` at that path already contains a refrains YAML block. Under those two conditions, the gate bypasses non-interactively. This mirrors the outline-approval gate's fixture bypass in Phase 11 D-09.

### Reinforcement of the distinctness rule

The outliner's existing **Key Statement Distinctness Check** (section 3) is reinforced, not contradicted, by this gate. If a chapter's `key_statement` is near-identical to another chapter's, the outliner MUST propose one of them as a whole-book refrain with a budget OR rewrite one of the values to a clearly distinct aphorism. The refrain whitelist is the ONLY exception path for repeated aphorisms.

## 6. Post-Approval: Generate Book DNA

This section executes ONLY after the orchestrator confirms the user has approved the outline. The orchestrator adds `<!-- APPROVED -->` to `chapter-outline.md` and then re-invokes the outliner for Book DNA generation.

### Inputs

Read the following:
1. `[project]/chapter-outline.md` -- the approved outline
2. `[project]/voice-profile.md` -- the voice profile
3. `${CLAUDE_PLUGIN_ROOT}/references/book-dna-template.md` -- the template

### Populate book-dna.md

Populate `[project]/book-dna.md` by filling in every section of the template:

#### 1. Metadata
Already partially populated by the orchestrator during project creation. Update:
- **Chapter count** from the outline
- **Target word count** from the outline's Size Tier section

#### 2. Voice Profile
Copy the following sections from `voice-profile.md` into the Voice Profile section of `book-dna.md`:
- **Tone** -> Voice Profile > Tone
- **Sentence Patterns** -> Voice Profile > Sentence Patterns
- **Vocabulary** (both Use and Avoid subsections) -> Voice Profile > Vocabulary
- **Emphasis Techniques** -> Voice Profile > Emphasis Techniques

#### 3. Theological/Domain Framework
Copy from `voice-profile.md` if present. If the voice profile has no Theological/Domain Framework section, write:
"[No domain framework specified -- use general knowledge]"

#### 4. Book Arc
Copy the Book Arc line from `chapter-outline.md`.

#### 5. Chapter Map
Build one entry per chapter from the outline. Each entry MUST carry every structured field from the approved outline. Use a sub-list layout per chapter. Exact shape required:

```markdown
- **Ch [N]: [Title]**
  - Core point: [one sentence -- the single proposition this chapter teaches]
  - opener_type: [anchor_scripture | plain_declaration | definition]
  - Anchor scripture: [reference -- quoted as chapter epigraph if opener_type is anchor_scripture]
  - Key scriptures: [comma-separated references]
  - list_structure: [stem: "[the repeated point-opener frame]", count: N] OR [flowing]
  - key_statement: [the chapter's one-line quotable aphorism -- distinct across all chapters unless declared as a refrain]
  - testimony_seed: [source_path:line OR empty with note "no testimony available -- use biblical retelling, everyday analogy, or third-party anecdote"]
  - Connects to: [Ch X (builds on ...), Ch Y (applies ...)]
  - Momentum position: [Foundation | Building | Accelerating | Climax | Landing]
```

All fields are mandatory in the Chapter Map. If any field is missing from the outline, return to Section 3 and populate it before emitting the Book DNA. The writer reads `opener_type`, `list_structure`, `key_statement`, and `testimony_seed` as hard constraints at draft time -- see `references/dag-craft-rules.md` § DAG-01, § DAG-03, § DAG-04, § DAG-08.

#### 6. Running Themes
Analyse the outline and identify 3-7 themes that recur across multiple chapters. For each theme, note:
- Which chapter **introduces** the theme
- Which chapters **develop** it
- Which chapter provides the **strongest treatment** of that theme

Format: `- [Theme name]: Introduced Ch [X], developed Ch [Y, Z], strongest treatment Ch [W]`

#### 7. Key Terms and Jargon
Extract key terms from the outline that need consistent definition across chapters. For each term:
- **Term:** The word or phrase
- **Definition:** Brief, clear definition
- **First Used:** Which chapter introduces this term

These terms must be used consistently by every chapter agent. A term defined in Chapter 2 must mean the same thing in Chapter 14.

#### 8. Cross-Chapter Continuity
Based on the "Connects to" fields in the outline, write explicit continuity notes:

- **Builds on:** "Chapter [X] assumes the definition of [concept] established in Chapter [Y]"
- **Applies:** "Chapter [X] applies the principle from Chapter [Y] to [specific situation]"
- **Recurring verses:** Any proof text that functions as a book-level refrain, with the chapters where it appears
- **Key term reuse:** Coined terms that recur across chapters and must be used consistently

#### 9. Style Rules
Derive from voice profile and outline:
- **Spelling convention:** Default to British/SA English unless voice profile specifies otherwise
- **Scripture translation default:** KJV -- alternates always labelled (NASB preferred, then NLT, NKJV, NIV, AMP, TLB)
- **Target words per chapter:** From the outline's Size Tier section; chapter length is driven by point count -- imbalance across chapters is acceptable
- **Formatting rules:** Bold numbered full-sentence point headings; scripture as blockquotes with reference lines; no em dashes; no italics-for-emphasis in prose

#### 10. Add READ-ONLY marker and version stamp
At the very top of `book-dna.md`, before the title, add these two HTML comments in this exact order (version stamp on line 1, READ-ONLY marker on line 2):

```
<!-- generated-by: dag-book-crafter v1.0.0 -->
<!-- READ-ONLY: Do NOT modify this document during parallel chapter generation. Updates happen between pipeline stages only. -->
```

The version stamp is required on the first line of every generated artefact so Phase 12's regression-chain tooling can anchor comparisons. The formatter strips all HTML comments before .docx emission.

This marker is critical. During Stage 3 (parallel chapter writing), multiple chapter agents read this document simultaneously. Any modification during parallel execution would create race conditions and voice drift.

### Completion Confirmation

After writing `book-dna.md`, confirm completion:
"Book DNA generated. [N] chapters mapped, [M] running themes identified, [K] key terms defined."

## 7. Important Constraints

- **Never skip the topical progression design step.** Chapters without momentum positioning produce books that feel like a collection of unrelated tracts rather than a coherent teaching series.
- **Source Ingestion Mode must TRANSFORM source structure, not mirror it.** A sermon series has standalone talks; a book has a topical progression. These are fundamentally different structures.
- **All outline fields are mandatory.** Do not omit any field for any chapter. If a field is not applicable (e.g., scriptures for non-theological books), use the explicit N/A notation.
- **Per-chapter word targets must be calculated from the size tier.** Never leave word counts as placeholders or "TBD". Imbalance across chapters is authentic -- do not force uniformity.
- **Book DNA generation happens ONLY after outline approval.** If the outline has not been approved (no `<!-- APPROVED -->` marker in `chapter-outline.md`), do not generate Book DNA. The outliner's Section 6 is only invoked by the orchestrator after the user approves.
- **The Book DNA READ-ONLY marker is critical.** It prevents parallel chapter agents from modifying the shared context document, which would cause voice drift and data corruption. Never omit it.
- **Cross-chapter connections are not optional.** Every chapter must reference at least one other chapter. Isolated chapters produce disjointed books.
- **Counted titles must match point counts.** If a chapter title declares "Seven Ways to...", the chapter's `list_structure` count must be 7 and the writer must deliver exactly 7 points. Verify this before finalising the outline.
- **Chapter closes are always landing, never unresolved.** Every chapter ends with exhortation, benediction, command, or scripture per DAG-07. No open questions, no teasers, no forward hooks. The Landing momentum position closes the whole book -- all others simply stop after the final point lands.
