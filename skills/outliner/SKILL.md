---
name: outliner
description: "Generate a chapter-by-chapter book outline from a topic brief or existing content. Called by the orchestrator during the outline stage of the book pipeline. Triggers on: 'outline a book', 'book outline', 'chapter outline', 'plan a book structure'."
user-invocable: false
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Book Outliner

Generates a chapter-by-chapter book outline with structured metadata per chapter, designs a narrative arc, and populates the Book DNA master context document after user approval.

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
- The overall tone and voice characteristics (influences chapter title style and hook strategies)

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

| Size Tier | Chapters | Total Words | Per-Chapter Words |
|-----------|----------|-------------|-------------------|
| Booklet   | 5-8      | 15-20K      | ~2,500-3,500      |
| Short     | 8-12     | 15-25K      | ~1,800-2,500      |
| Standard  | 12-20    | 40-60K      | ~3,000-4,000      |

Choose a specific chapter count within the tier range based on the complexity and breadth of the topic. A narrow topic with deep treatment favours fewer, longer chapters. A broad topic with survey treatment favours more, shorter chapters.

### Step 2: Design the narrative arc

Before writing individual chapters, design the book's overall narrative arc:

- **Opening:** What tension or question draws the reader in? What is the status quo the book disrupts?
- **Progressive revelation:** How does understanding deepen chapter by chapter? What is the logical escalation?
- **Climax:** What is the peak revelation or turning point? The "aha moment" the entire book builds toward.
- **Resolution:** How does the book land? What does the reader walk away with? How are they changed?

Write the arc as a single line:
`[Opening tension] -> [Progressive revelation] -> [Climactic truth] -> [Resolution]`

### Step 3: Assign momentum positions

Each chapter receives a momentum position that determines its energy, pacing, and structural role:

| Position | Typical Chapters | Purpose |
|----------|-----------------|---------|
| Foundation | Chapters 1-2 | Establish the premise, hook the reader, lay groundwork. Set up the central question or tension. |
| Building | Early-middle chapters | Develop arguments, introduce complexity, deepen understanding. Each chapter adds a new layer. |
| Accelerating | Mid-late chapters | Increase intensity, connect threads, raise stakes. The reader feels momentum building. |
| Climax | 1-2 chapters near end | Peak revelation, the "aha moment", most powerful content. Everything converges here. |
| Landing | Final 1-2 chapters | Resolution, application, send-off with lasting impact. The reader knows what to do next. |

Every outline must use all five momentum positions. The distribution should feel natural -- not every chapter needs a different position, but the overall trajectory must escalate from Foundation through Landing.

### Step 4: Generate per-chapter metadata

For each chapter, generate:

- **Title:** Compelling and specific, not generic. "The Anatomy of Breakthrough" not "Chapter 3: More About Faith". The title should intrigue, not merely describe.
- **Hook strategy:** Choose ONE of the following and write the specific hook in 1-2 sentences:
  - **Bold declaration** -- a confident, provocative statement that demands engagement
  - **Rhetorical question** -- a question that makes the reader stop and think before reading on
  - **Counter-intuitive claim** -- a statement that contradicts common wisdom and creates curiosity
  - **Tension-creating observation** -- an observation that exposes a gap between reality and expectation
  **Story-first hooks (preferred):** Wherever possible, the hook should be wrapped in a story, anecdote, or vivid scene. The bold declaration, question, or tension emerges FROM the opening narrative rather than standing alone. Example: Instead of just "Your weakest moment wasn't a failure", open with a 2-3 sentence scene of someone experiencing that moment, then deliver the declaration as the insight that emerges from the story.
- **Core argument:** The single central claim this chapter makes, in one sentence. Every paragraph in the chapter should serve this argument.
- **Key arguments:** 3-5 supporting arguments that build the core argument. These become the chapter's structural backbone.
- **Supporting scriptures:** 2-5 scripture references relevant to the chapter's argument. For theological books (voice profile has a Theological/Domain Framework section), this is mandatory. For non-theological voice profiles, write "[N/A -- non-theological voice profile]".
- **Momentum position:** Foundation | Building | Accelerating | Climax | Landing
- **Connects to:** Which other chapters this chapter foreshadows, builds on, or callbacks to. Use the format: "Ch [X] (foreshadows [concept])", "Ch [Y] (builds on [concept])". Every chapter must connect to at least one other chapter.
- **Target word count:** Calculated from the size tier's per-chapter range. Can vary by +/- 20% based on the chapter's role (climax chapters tend to be longer, foundation chapters moderate).
- **Ending style:** Choose ONE:
  - **cliffhanger_seed** -- end with a question, tension point, or preview that makes the reader NEED the next chapter. Best for Foundation and Building chapters where you want forward momentum.
  - **reflective_hook** -- end with a reflective landing that lets the insight settle, followed by a 1-2 sentence forward hook. Best for Accelerating, Climax, and Landing chapters where the content needs to breathe before moving on.
  The outliner designs which ending fits each chapter based on momentum position and content. Not every chapter should use the same ending style.
- **central_image:** One dominant sensory anchor for the chapter, expressed as a concrete image (examples: "a drowning man reaching for a rope", "the cold coffee on the hospital waiting-room table", "a lighthouse visible through fog"). The writer MUST thread this image through the chapter's opening 200 words, middle third, and closing 200 words. This is a constraint, not a suggestion. See `references/bestseller-craft-rules.md` § CRAFT-03.
- **vulnerability_beat_seed:** A pointer to real source material that the writer will draw on when composing the chapter's first-person vulnerability beat, formatted as `source_path:line` (examples: `sources/sermon-2024-03-15.md:42`, `book-dna.md:89`, `voice-profile.md:12`). Permitted source paths: `sources/{file}.md`, `sources-adapted/{file}.md`, `book-dna.md`, `voice-profile.md`. If no real fragment can be found after walking the available sources, leave this field empty and add the note `no vulnerability seed available -- skip beat` so the writer skips the beat for that chapter. Fabricated vulnerability beats are a CRAFT-04 hard fail. See `references/bestseller-craft-rules.md` § CRAFT-04.

### Step 5: Cross-chapter coherence check

After generating all chapters, review the complete outline for coherence:

1. **Progression check:** Does each chapter build on the previous one? Is there a logical flow?
2. **Gap analysis:** Are there gaps in the argument progression? Missing links between ideas?
3. **Momentum check:** Do the momentum positions actually escalate? Is there a clear build toward climax?
4. **Connection density:** Are there enough cross-chapter connections (foreshadowing, callbacks)? Aim for at least 2 connections per chapter on average.
5. **Climax delivery:** Does the climax chapter deliver on the tension set up in chapter 1?
6. **Landing satisfaction:** Does the landing chapter resolve what was opened, without introducing new unresolved threads?

If any check fails, revise the affected chapters before writing the output file.

### Central Image Distinctness Check

After assigning `central_image` to every chapter, re-read the full list and verify no two chapters share a near-identical image. Use semantic judgment, not string match: "flickering candle" vs "dim candle" is too similar and must be revised; "drowning man" vs "lighthouse in fog" is distinct enough. If any pair is too similar, revise one of them so the two images occupy different sensory registers (visual vs tactile, interior vs exterior, quiet vs loud, etc.). Rationale: near-duplicate central_image values across chapters cause the book to blur — see `.planning/research/PITFALLS.md` Pitfall 9 (central_image collisions).

### Vulnerability Beat Seed Sourcing

For each chapter, the outliner MUST walk the available source material to find a real fragment that can seed the chapter's vulnerability beat. Search order:

1. `sources-adapted/` (if present) — adapted source prose
2. `sources/` (if present) — raw source material
3. `voice-profile.md` — any first-person anecdotes or confessions in the voice profile
4. `book-dna.md` — any first-person material already lifted into the Book DNA

For each chapter, pick the line that best matches the chapter's core argument and record the `vulnerability_beat_seed` as `source_path:line`. If no fragment exists in any of these locations for a given chapter, leave `vulnerability_beat_seed` empty AND add the note `no vulnerability seed available -- skip beat` so the writer skips the beat for that chapter. Never invent a seed or point at a line that does not exist. The writer enforces this by refusing to fabricate beats — see CRAFT-04.

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
- Identify the natural progressive argument that emerges from the combined material
- Design a NEW book structure that serves the reader's journey, not the speaker's delivery schedule
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

Write the outline to `[project]/chapter-outline.md` in this exact format. **Prepend `<!-- generated-by: dag-book-crafter v1.1.0 -->` as the first line of `chapter-outline.md`** before the `# Book Outline: [Title]` heading. The comment is stripped by the formatter before .docx emission and exists only as a regression-chain anchor for Phase 12 tooling.

```markdown
# Book Outline: [Title]

## Book Arc
[Opening tension] -> [Progressive revelation] -> [Climactic truth] -> [Resolution]

## Size Tier
[booklet | short | standard]
Target: [total word count] words, [chapter count] chapters, ~[per-chapter words] words/chapter

## Chapter 1: [Title]
- **Hook strategy:** [Type] -- [Specific hook description in 1-2 sentences]
- **Core argument:** [Single sentence central claim]
- **Key arguments:**
  1. [Argument 1]
  2. [Argument 2]
  3. [Argument 3]
- **Supporting scriptures:** [Scripture 1], [Scripture 2], ...
- **Momentum position:** [Foundation | Building | Accelerating | Climax | Landing]
- **Connects to:** Ch [X] (foreshadows...), Ch [Y] (builds on...)
- **Target word count:** ~[N] words
- **Ending style:** [cliffhanger_seed | reflective_hook]
- **central_image:** [One dominant sensory anchor -- e.g. "a lighthouse visible through fog"]
- **vulnerability_beat_seed:** [source_path:line OR empty with note "no vulnerability seed available -- skip beat"]

## Chapter 2: [Title]
- **Hook strategy:** [Type] -- [Specific hook description in 1-2 sentences]
- **Core argument:** [Single sentence central claim]
- **Key arguments:**
  1. [Argument 1]
  2. [Argument 2]
  3. [Argument 3]
- **Supporting scriptures:** [Scripture 1], [Scripture 2], ...
- **Momentum position:** [Foundation | Building | Accelerating | Climax | Landing]
- **Connects to:** Ch [X] (foreshadows...), Ch [Y] (builds on...)
- **Target word count:** ~[N] words
- **Ending style:** [cliffhanger_seed | reflective_hook]
- **central_image:** [One dominant sensory anchor -- distinct from Chapter 1's image]
- **vulnerability_beat_seed:** [source_path:line OR empty with note "no vulnerability seed available -- skip beat"]

[... continue for all chapters ...]
```

Every chapter MUST have all fields present. No field may be omitted for any chapter.

The "Supporting scriptures" field may be "[N/A -- non-theological voice profile]" if the voice profile does not have a Theological/Domain Framework section.

For Source Ingestion Mode, add a "Source Material Notes" bullet after "Ending style" for each chapter:
```markdown
- **Ending style:** [cliffhanger_seed | reflective_hook]
- **Source Material Notes:** [Key quotes, illustrations, or source references for this chapter]
```

After writing `chapter-outline.md`, report to the orchestrator:
- "Outline generated: [N] chapters, [size tier] tier, ~[total word count] words target"
- "Momentum distribution: [N] Foundation, [N] Building, [N] Accelerating, [N] Climax, [N] Landing"
- Mode used (Topic Brief or Source Ingestion)

## Refrain Candidate Gate (Phase 13, D-08)

> Refrains are whitelisted phrases that may appear verbatim across chapters without tripping the Phase 13 dedup audit. Because a naively-inferred refrain becomes a loophole (Phase 13's root cause was a phrase that was de-facto treated as a refrain but never declared), this gate is MANDATORY — refrains cannot be auto-inferred from the brief alone. The author must confirm each candidate phrase before it is written into the Book DNA refrains block.

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
3. **Ignore** (candidate is noise — do not include at all).

Also offer: "Add a refrain I missed" — the author can specify a phrase the outliner did not propose.

The gate BLOCKS outline-to-Book-DNA handoff until the author has answered every candidate. The orchestrator spawns writer subagents only after this gate resolves. This is a separate gate from the existing outline approval gate — both gates fire, both must be passed.

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

The `fixtures/tiny-book/` sample fixture ships with a pre-approved `book-dna.md` that already contains the refrains block. When the orchestrator is invoked by the sample skill (`skills/sample/SKILL.md`), the refrain candidate gate is SKIPPED — the pre-populated refrain block is authoritative. Detection signal: the orchestrator passes a project path pointing under `fixtures/tiny-book/` AND the `book-dna.md` at that path already contains a refrains YAML block. Under those two conditions, the gate bypasses non-interactively. This mirrors the outline-approval gate's fixture bypass in Phase 11 D-09.

### Reinforcement of the distinctness rule

The outliner's existing **Central Image Distinctness Check** (section 3, Step 5 area) is reinforced, not contradicted, by this gate. The old rule said "central images should be distinct across chapters." Phase 13 tightens this: same motif family is allowed, same descriptive vehicle is not. The refrain whitelist is the ONLY exception path. If a chapter's `central_image` field is near-identical to another chapter's, the outliner MUST propose one of them as a refrain candidate with `max_uses ≥ 2` OR rewrite one of the `central_image` values to use a distinct vehicle in the same family.

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
Build one entry per chapter from the outline. Each entry MUST carry every structured field, including the two Phase 10 additions `central_image` and `vulnerability_beat_seed`. Use a sub-list layout per chapter (preferred) because the two new fields push a table layout too wide. Minimal required shape:

```markdown
- **Ch [N]: [Title]**
  - Core argument: [one sentence]
  - Opening hook strategy: [type -- 1-2 sentence description]
  - Key scriptures: [comma-separated]
  - Connects to: [Ch X (foreshadows ...), Ch Y (builds on ...)]
  - Momentum position: [Foundation | Building | Accelerating | Climax | Landing]
  - central_image: [the dominant sensory anchor from the outline]
  - vulnerability_beat_seed: [source_path:line OR empty with "no vulnerability seed available -- skip beat"]
```

Both `central_image` and `vulnerability_beat_seed` are mandatory fields in the Chapter Map. Data is extracted directly from each chapter's structured fields in the outline — if either field is missing from the outline, return to Section 3 and populate it before emitting the Book DNA.

#### 6. Running Themes
Analyse the outline and identify 3-7 themes that recur across multiple chapters. For each theme, note:
- Which chapter **introduces** the theme
- Which chapters **develop** it
- Which chapter provides the **climax** of that theme

Format: `- [Theme name]: Introduced Ch [X], developed Ch [Y, Z], climax Ch [W]`

#### 7. Key Terms and Jargon
Extract key terms from the outline that need consistent definition across chapters. For each term:
- **Term:** The word or phrase
- **Definition:** Brief, clear definition
- **First Used:** Which chapter introduces this term

These terms must be used consistently by every chapter agent. A term defined in Chapter 2 must mean the same thing in Chapter 14.

#### 8. Cross-Chapter Continuity
Based on the "Connects to" fields in the outline, write explicit continuity notes:

- **Foreshadowing:** "Chapter [X] sets up [concept] that pays off in Chapter [Y]"
- **Callbacks:** "Chapter [X] references back to the illustration from Chapter [Y]"
- **Running metaphors:** Any metaphor that should recur across chapters, with the chapters where it appears
- **Recurring imagery:** Visual or conceptual imagery that builds throughout the book

#### 9. Style Rules
Derive from voice profile and outline:
- **Spelling convention:** Default to British/SA English unless voice profile specifies otherwise
- **Scripture translation default:** From voice profile's Scripture Handling section, or NKJV if not specified
- **Target words per chapter:** From the outline's Size Tier section
- **Formatting rules:** Any specific formatting instructions from the voice profile (e.g., "no em dashes", "bold for emphasis")

#### 10. Add READ-ONLY marker and version stamp
At the very top of `book-dna.md`, before the title, add these two HTML comments in this exact order (version stamp on line 1, READ-ONLY marker on line 2):

```
<!-- generated-by: dag-book-crafter v1.1.0 -->
<!-- READ-ONLY: Do NOT modify this document during parallel chapter generation. Updates happen between pipeline stages only. -->
```

The version stamp is required on the first line of every generated artefact so Phase 12's regression-chain tooling can anchor comparisons. The formatter strips all HTML comments before .docx emission.

This marker is critical. During Stage 3 (parallel chapter writing), multiple chapter agents read this document simultaneously. Any modification during parallel execution would create race conditions and voice drift.

### Completion Confirmation

After writing `book-dna.md`, confirm completion:
"Book DNA generated. [N] chapters mapped, [M] running themes identified, [K] key terms defined."

## 7. Important Constraints

- **Never skip the narrative arc design step.** Chapters without momentum positioning produce flat books that feel like a collection of blog posts rather than a progressive argument.
- **Source Ingestion Mode must TRANSFORM source structure, not mirror it.** A sermon series has standalone talks; a book has a progressive argument. These are fundamentally different structures.
- **All outline fields are mandatory.** Do not omit any field for any chapter. If a field is not applicable (e.g., scriptures for non-theological books), use the explicit N/A notation.
- **Per-chapter word targets must be calculated from the size tier.** Never leave word counts as placeholders or "TBD".
- **Book DNA generation happens ONLY after outline approval.** If the outline has not been approved (no `<!-- APPROVED -->` marker in `chapter-outline.md`), do not generate Book DNA. The outliner's Section 6 is only invoked by the orchestrator after the user approves.
- **The Book DNA READ-ONLY marker is critical.** It prevents parallel chapter agents from modifying the shared context document, which would cause voice drift and data corruption. Never omit it.
- **Cross-chapter connections are not optional.** Every chapter must reference at least one other chapter. Isolated chapters produce disjointed books.
- **The climax must deliver on the opening.** During the coherence check, verify that the climax chapter resolves the tension established in the foundation chapters.
