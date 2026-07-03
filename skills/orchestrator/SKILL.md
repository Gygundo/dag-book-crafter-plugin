---
name: orchestrator
description: "Master pipeline controller for writing short, easy-to-read, topical books in the Dag Heward-Mills teaching style. Use this skill whenever the user wants to write a book, create a book from sermons or notes, check book project status, resume an interrupted book project, or run the full book pipeline. Triggers on: 'write a book', 'write me a short book on', 'book project', 'book status', 'resume book', 'book pipeline', 'create a book from', 'book crafter', 'start a book', 'new book', 'continue book'. Coordinates all stages: outline, research, write, edit, format."
allowed-tools: Read, Write, Bash, Grep, Glob, Agent
---

# Dag Book Crafter Orchestrator

Master pipeline controller for the dag-book-crafter plugin. This plugin writes short, easy-to-read, topical books in the Dag Heward-Mills teaching style - numbered points, verse-first architecture, plain declarative prose, direct address to the reader. This skill manages the entire book-writing lifecycle: creating new projects, detecting pipeline state, chaining sequential stages, spawning parallel chapter agents, and displaying progress dashboards.

## 1. Pipeline Overview

```
USER INPUT (topic brief OR existing content)
    |
    v
[ORCHESTRATOR] -- Main thread, controls entire pipeline
    |
    |-- Stage 0.5: SERMON ADAPTATION (sermon-adapter skill) [CONDITIONAL]
    |   Only runs when sermon-format sources detected
    |   Output: sources-adapted/
    |
    |-- Stage 1: OUTLINE (outliner skill)
    |   Output: chapter-outline.md, book-dna.md
    |   GATE: User approves outline before proceeding
    |
    |-- Stage 2: RESEARCH (researcher skill, parallel per-chapter)
    |   Output: research/ch01-research.md, research/ch02-research.md, ...
    |
    |-- Stage 3: WRITE (writer skill + chapter-writer agents, parallel per-chapter)
    |   Output: drafts/ch01-draft.md, drafts/ch02-draft.md, ...
    |
    |-- Stage 4: EDIT (editor skill + chapter-editor agents for large books)
    |   Output: edited/ch01-final.md, edited/ch02-final.md, ...
    |
    |-- Stage 4.5: ENRICH (enricher skill)
    |   Output: enrichments/ch01-enrichments.md, ..., front-matter/foreword.md
    |
    |-- Stage 4.6: POST-ENRICHER NOVELTY GATE (craft-check.js --novelty)
    |   Gate: novelty_dedup pass/fail against full corpus including foreword
    |
    |-- Stage 5: FORMAT (formatter skill)
    |   Output: output/[Book Title].docx
```

All inter-stage communication happens via the filesystem. Each stage reads artefacts produced by prior stages and writes artefacts for subsequent stages. Book DNA (`book-dna.md`) is the shared context document that every agent reads for voice consistency.

## 2. On Trigger: Detect or Create Project

When the orchestrator activates:

1. Check for existing book projects in `~/Documents/Books/` by listing subdirectories
2. If the user mentions a specific project name, look for a matching directory
3. If no projects exist or the user wants a new book, proceed to project creation
4. If multiple projects exist, show them and ask which one to work with

### Creating a New Project

When creating a new project:

1. **Gather project details from the user:**
   - Book title (required)
   - Topic brief or description (required) -- can be a topic, a collection of sermon transcripts, notes, or an existing outline
   - Key themes (optional)
   - Target audience (optional)
   - Book size tier: `booklet` (8–15 chapters, 10–20K words, ~800–2,000 words/chapter), `short` (15–25 chapters, 20–35K words), or `standard` (15–25 chapters, 35–50K words). Default: `booklet`
   - Voice profile (one of five options):
     - **Named profile**: A profile name from the plugin's voice library (e.g., "dag-default"). Looks up `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/[name].md`
     - **Custom file path**: An absolute or relative path to a `.md` voice profile file (e.g., "~/my-voices/academic.md")
     - **Inline description**: A plain-text description of the desired voice (e.g., "casual, conversational, like talking to a friend over coffee"). Will be expanded into a full profile.
     - **Build from source material**: A directory path containing .md files to analyse. The voice builder skill generates a profile from the source content.
     - **Not specified**: Defaults to `dag-default`

2. **Create the project directory structure:**

```
~/Documents/Books/[Book Title]/
├── book-dna.md              # Copied from ${CLAUDE_PLUGIN_ROOT}/references/book-dna-template.md
├── voice-profile.md         # Copied from selected voice profile
├── sources/               # User-provided source material (sermons, notes, blog posts)
├── research/                # Empty, populated in Stage 2
├── drafts/                  # Empty, populated in Stage 3
├── edited/                  # Empty, populated in Stage 4
├── revisions/               # Empty, for revision history in Stage 4
├── front-matter/            # Empty, populated in Stage 6
└── output/                  # Empty, .docx generated in Stage 5
```

3. **Populate book-dna.md:** Copy the template from `${CLAUDE_PLUGIN_ROOT}/references/book-dna-template.md` and fill in the Metadata section with:
   - Title from user input
   - Size tier from user selection
   - Created date (today)
   - Author name if provided

### Voice Profile Selection

Determine which voice input mode the user specified and process accordingly:

**Mode 1: Named profile** (user provides a name like "dag-default"):
1. Read `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/[name].md`
2. If file not found, list available profiles from `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/` (exclude `voice-profile-spec.md`) and ask user to choose
3. Copy file contents to `[project]/voice-profile.md`

**Mode 2: Custom file path** (user provides a file path ending in `.md`):
1. Read the file at the provided path
2. Validate against `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/voice-profile-spec.md`:
   - Check for required sections: Tone, Sentence Patterns, Vocabulary (with Use and Avoid subsections), Emphasis Techniques, Anti-Patterns
   - If any required section is missing: WARN the user which sections are missing, fill each missing section with "[Not specified -- using neutral, clear prose]" marked with <!-- DEFAULT -->
3. Write the (possibly augmented) profile to `[project]/voice-profile.md`

**Mode 3: Inline description** (user provides plain text that is not a file path):
1. Generate a full voice profile from the user's description by expanding it into the required sections:
   - **Tone**: Infer from the description (e.g., "casual" -> "Relaxed, conversational, approachable")
   - **Sentence Patterns**: Infer rhythm (e.g., "casual" -> shorter sentences, contractions, informal fragments)
   - **Vocabulary > Use**: Extract characteristic language from the description
   - **Vocabulary > Avoid**: Infer what breaks the described voice
   - **Emphasis Techniques**: Infer from the tone
   - **Anti-Patterns**: Infer what would violate the described voice
2. Mark each section with <!-- INFERRED --> to indicate it was generated, not user-specified
3. Write the generated profile to `[project]/voice-profile.md`
4. Show the generated profile to the user: "I've expanded your voice description into a full profile. Here's what I've inferred -- let me know if you'd like to adjust anything before we continue."

**Mode 5: Build from source material** (user wants to analyse existing writing to generate a voice profile):
1. Ask for the directory path containing source material (if not already provided). The directory should contain `.md` files (e.g., an Obsidian vault, a content folder).
2. Invoke the `dag-book-crafter:voice-builder` skill with the directory path
3. The voice builder analyses the content and presents a profile for user review
4. On approval, the voice builder saves the profile to `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/[auto-name].md`
5. Copy the approved profile to `[project]/voice-profile.md`
6. Continue with pipeline (proceed to outline stage)

Note: The voice builder handles all analysis, review, and saving internally. The orchestrator just invokes it and waits for the approved profile path.

**Detecting Mode 5:** The user triggers Mode 5 when they say "build from my writing", "analyse my content", "generate from my files", "build voice profile", "extract voice from", "use my existing writing", or provide a directory path explicitly for voice analysis (as opposed to a single `.md` file path, which is Mode 2).

**Mode 4: Not specified** (user did not mention voice):
1. Use `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/dag-default.md`
2. Copy to `[project]/voice-profile.md`
3. Inform the user: "Using the default Dag Heward-Mills teaching voice profile. You can change this later by providing a different voice profile."

4. **Handle source material:** If the user provides source content (file paths, sermon transcripts, notes), copy or save them to `[project]/sources/`. If the user provides file paths, copy the files. If the user provides inline content, save each piece as a numbered file (source-01.md, source-02.md, etc.). The outliner will auto-detect source files and switch to Source Ingestion Mode.

5. **Confirm creation:** Show the user the created directory structure and the populated book-dna.md metadata, then proceed to the status dashboard.

6. **Detect sermon format (conditional):** After source files are saved, scan the source files for sermon format indicators:
   - ALL CAPS headings
   - Audience-directed pronouns ("we", "us", "you" as congregation address)
   - Verbal cues ("Let me tell you", "Watch this", "Here's where it gets good")
   - Temporal references ("this morning", "last Sunday")
   - Spatial references ("here in this room", "in our church")
   If 3+ indicators found across all source files, ask the user:
   "These source files appear to be sermon transcripts. Should I adapt them from spoken to written rhythm before generating the outline?"
   If confirmed, flag the project for Stage 0.5 execution.
   If the user explicitly stated the source is a sermon series (e.g., "convert my sermons to a book"), skip detection and flag directly.

### Detecting an Existing Project

If a project directory already exists, scan for pipeline state using the detection algorithm in section 3.

## 3. Pipeline State Detection

Scan the project directory to determine the current pipeline state. This is the resume logic that allows interrupted work to continue.

### Detection Algorithm

Work backwards from the most advanced stage:

```
1. Check for output/*.docx
   -> If exists: pipeline is COMPLETE

1.5. Check for enrichments/ch*-enrichments.md AND front-matter/foreword.md
   -> If enrichment file count matches chapter count AND foreword.md exists: Stage 4.5 COMPLETE
   -> If enrichment count > 0 but less than chapter count: Stage 4.5 PARTIALLY COMPLETE
   -> If no enrichments but edited files exist with no revision marker: Stage 4.5 NOT STARTED (proceed to Stage 4.5)

1.6. If Stage 4.5 COMPLETE, check post-enricher novelty gate status:
   -> Read reports/consistency-report.md, extract novelty_dedup field value
   -> If novelty_dedup: pass AND front-matter/foreword.md exists: Stage 4.6 COMPLETE
   -> If novelty_dedup: fail: Stage 4.6 FAILED (pipeline halted, needs Mode 7 or manual fix)
   -> If no novelty_dedup field but enrichments exist: Stage 4.6 NOT RUN (re-run Stage 4.6)

2. Check for edited/ch*-final.md
   -> If count matches outline chapter count:
      -> Check reports/consistency-report.md for <!-- REVISION IN PROGRESS --> marker:
         -> If marker present: Stage 4 IN REVIEW (revisions in progress)
         -> If no marker: Stage 4 COMPLETE
   -> If count > 0 but less than expected: Stage 4 PARTIALLY COMPLETE

3. Check for drafts/ch*-draft.md
   -> If count matches outline chapter count: Stage 3 COMPLETE
   -> If count > 0 but less than expected: Stage 3 PARTIALLY COMPLETE

4. Check for research/ch*-research.md
   -> If count matches outline chapter count: Stage 2 COMPLETE
   -> If count > 0 but less than expected: Stage 2 PARTIALLY COMPLETE

5. Check for chapter-outline.md with <!-- APPROVED --> marker
   -> If marker present: Stage 1 COMPLETE

6. Check for chapter-outline.md without <!-- APPROVED --> marker
   -> Stage 1 IN PROGRESS (outline exists but needs user approval)

7. Check for sources-adapted/ directory with files
   -> If exists AND sources/ also exists: Stage 0.5 COMPLETE (proceed to Stage 1 using sources-adapted/)
   -> If sources/ exists with sermon indicators but no sources-adapted/: Stage 0.5 NEEDED

8. None of the above
   -> Pipeline NOT STARTED (proceed to Stage 1)
```

### Chapter Count Extraction

To determine the expected chapter count, read `chapter-outline.md` and count lines matching the pattern `## Chapter` (chapter heading markers). This count is used to verify whether a stage has processed all chapters or only some.

### Partial Completion Handling

When a stage directory exists but the file count does not match the outline's chapter count:

1. The stage is **PARTIALLY COMPLETE**
2. Identify which specific chapters are missing by comparing existing filenames against the expected sequence (ch01, ch02, ..., chNN)
3. Report the gap: e.g., "Research: 8/12 chapters complete, missing ch09, ch10, ch11, ch12"
4. When resuming, only process the missing chapters -- do not redo completed ones

### Determining Next Action

After scanning, the orchestrator identifies the **first incomplete stage** and offers to continue from there:

- If a stage is PARTIALLY COMPLETE, resume within that stage (process missing chapters)
- If a stage is fully COMPLETE, advance to the next stage
- If the pipeline is COMPLETE, report finished status

## 4. Status Dashboard

Display the current pipeline status using this format:

```
## Book Pipeline: [Book Title]
Directory: ~/Documents/Books/[Book Title]/

### Pipeline Status

[ ] Stage 0.5: Sermon Adaptation (sermon-adapter) [only shown when sources/ contains sermon-format content]
    Adapted: [date] | Source files: [N]

[x] Stage 1: Outline (outliner)
    Generated: [date] | Chapters: [n] | Approved: Yes/No

[~] Stage 2: Research (researcher) -- [x]/[n] chapters
    [x] ch01-research.md
    [x] ch02-research.md
    [ ] ch03-research.md
    ...

[ ] Stage 3: Writing (writer) -- 0/[n] chapters

[ ] Stage 4: Editing (editor)
    [ ] Voice consistency pass
    [ ] Flow/transition pass
    [ ] Cross-chapter validation
    [ ] Review gate

When Stage 4 is in review (revisions requested), display:

[~] Stage 4: Editing (editor) -- IN REVIEW
    [x] Voice consistency pass
    [x] Flow/transition pass
    [x] Cross-chapter validation
    [~] Revision requested: Ch 3, Ch 7

[ ] Stage 4.5: Content Enrichment (enricher)
    [ ] Discussion questions: 0/[N] chapters
    [ ] Chapter summaries: 0/[N] chapters
    [ ] Prayer points: 0/[N] chapters [or "N/A -- non-theological"]
    [ ] Foreword: pending

[ ] Stage 4.6: Post-Enricher Novelty Gate (craft-check.js --novelty)

[ ] Stage 5: Formatting (formatter)
    [ ] .docx generation

### Progress: [x]/5 stages complete
### Next: [Next stage name and what it will do]
```

**Status markers:**
- `[x]` -- stage fully complete
- `[~]` -- stage partially complete (some chapters done)
- `[ ]` -- stage not started

For partially complete stages, list each chapter's status individually so the user can see exactly what remains.

## 5. Stage Execution

When executing the next stage in the pipeline:

### Step 0: Fresh Mode Preprocessing

When Mode 6 (Fresh Run) is active, the fresh preprocessing steps in Section 6 (Mode 6) run BEFORE normal state detection. After the user confirms the delete list and the locked delete operation completes, fall through to Step 1 below and proceed with normal state detection - because every downstream artefact has been deleted, state detection will correctly identify the earliest pipeline stage as the next stage.

### Step 1: Identify the Next Stage

Use the state detection algorithm (section 3) to determine which stage to run next.

### Step 2: Check Skill Implementation Status

Before invoking a stage skill, read its SKILL.md and check for the `[STUB` marker. If the skill contains `[STUB`:

> "Stage [N]: [Name] is not yet implemented. It will be available in a future phase. The pipeline pauses here until that skill is built."

Do not attempt to execute a stub skill. Report which stage is blocking and what it will do when implemented.

### Step 3: Invoke the Stage Skill

For implemented stages, invoke the appropriate skill with the project directory path as context:

- **Stage 1 (Outline):** Invoke the outliner skill with the topic brief and voice profile
- **Stage 2 (Research):** Loop through chapters sequentially, invoking the researcher skill per chapter (see Stage 2 notes below)
- **Stage 3 (Write):** Spawn chapter-writer subagents in parallel (see below)
- **Stage 4 (Edit):** Invoke the editor skill with all drafted chapters
- **Stage 5 (Format):** Invoke the formatter skill with all edited chapters

### Step 4: Post-Stage Update

After a stage completes:

1. Re-scan pipeline state to confirm completion
2. Display the updated status dashboard
3. If in Full Pipeline mode, automatically proceed to the next stage
4. If in Guided mode, ask the user before proceeding

### Stage-Specific Orchestration Notes

#### Stage 0.5: Sermon Adaptation (Conditional)

This stage only runs when the project has source files flagged as sermon format (either by auto-detection or explicit user indication).

**Step 1: Verify sermon adaptation is needed**

Check if `sources-adapted/` already exists with files:
- If exists and file count matches `sources/`: Stage 0.5 already complete, skip to Stage 1
- If not: proceed with adaptation

**Step 2: Invoke the sermon adapter**

Invoke the `dag-book-crafter:sermon-adapter` skill with argument:
- Project directory path: `[project_directory]`

The sermon adapter will read all `.md` files from `sources/`, apply spoken-to-written transformations, and write adapted files to `sources-adapted/`.

**Step 3: Verify adaptation output**

1. Check that `sources-adapted/` directory exists: `ls [project_directory]/sources-adapted/ 2>/dev/null`
2. Count adapted files and compare to source file count
3. Verify each adapted file contains the `<!-- SERMON ADAPTED` metadata marker
4. Display: "Stage 0.5 complete: [N] sermon source files adapted for book format"

**Step 4: Update outliner source path**

When proceeding to Stage 1, the outliner's Source Ingestion Mode will auto-detect `sources/`. However, when `sources-adapted/` exists, the orchestrator must tell the outliner to read from `sources-adapted/` instead. Pass this as an additional argument to the outliner invocation:
- Source directory override: `[project_directory]/sources-adapted/`

Update the Stage 1 outliner invocation to include:
"Source material is in `sources-adapted/` (sermon-adapted versions). Use these files instead of the raw `sources/` directory."

#### Stage 1: Outline

**Step 1: Invoke the outliner**

Invoke the `dag-book-crafter:outliner` skill with the project directory path. The outliner will:
- Read book-dna.md metadata and voice-profile.md from the project directory
- Auto-detect mode (Topic Brief if no sources/ directory, Source Ingestion if sources/ exists)
- Generate chapter-outline.md with structured per-chapter metadata

If `sources-adapted/` exists in the project directory, include in the outliner invocation:
"Source material has been adapted from sermon format. Read from sources-adapted/ instead of sources/."

**Step 2: Present outline for review**

After the outliner produces `chapter-outline.md`:

1. Present the full outline to the user, highlighting:
   - Book arc (the narrative progression)
   - Size tier and calculated word targets
   - Chapter count and momentum position distribution
   - Any cross-chapter connections
2. Ask explicitly: "Does this outline look good? I can adjust specific chapters, change the structure, or regenerate entirely. Once approved, I'll generate the Book DNA and proceed to research."

**Step 3: Approval gate**

3. On **approval**:
   a. Add `<!-- APPROVED -->` marker to the top of `chapter-outline.md`
   b. Re-invoke the outliner for Book DNA generation (the outliner's Section 6 handles this)
   c. Verify `book-dna.md` has been populated (check that Chapter Map table has rows)
   d. Proceed to Stage 2
4. On **rejection with feedback**:
   a. Pass the user's specific feedback to the outliner
   b. The outliner revises the outline (it reads the existing chapter-outline.md and applies changes)
   c. Return to Step 2 to present the revised outline
5. On **request to modify specific chapters**:
   a. The user may ask to change specific chapters without regenerating the entire outline
   b. Pass the modification request to the outliner
   c. Return to Step 2

The outline approval gate prevents wasting time and tokens generating content from a flawed structure. This gate is NEVER skipped, even in Full Pipeline mode.

#### Stage 2: Research (Sequential Per-Chapter)

Research runs sequentially -- one chapter at a time -- because each chapter's research is fast (Claude generating from knowledge, not fetching from external APIs). Sequential execution is simpler and avoids race conditions.

**Step 1: Read the approved outline**

Read `chapter-outline.md` and extract the chapter count and per-chapter metadata. Verify the `<!-- APPROVED -->` marker is present.

**Step 2: Identify chapters needing research**

Check `research/` directory for existing `ch[NN]-research.md` files. If resuming a partial run, only process chapters without existing research files.

**Step 3: Loop through each chapter sequentially**

For each chapter that needs research:

1. Invoke the `dag-book-crafter:researcher` skill with arguments:
   - Project directory path
   - Chapter number
2. Verify the output file exists at `research/ch[NN]-research.md`
3. Verify the file contains the `<!-- RESEARCH COMPLETE: Chapter [N] -->` marker
4. Report progress: "Research complete: [current]/[total] chapters"

**Step 4: Verify research completeness**

After all chapters are processed:
1. Count `research/ch[NN]-research.md` files
2. Confirm count matches the chapter count from the outline
3. Display: "Stage 2 complete: Research gathered for all [N] chapters"
4. Proceed to Stage 3 (or show dashboard in Guided mode)

#### Stage 3: Write (Parallel Chapter Writing)

Spawn chapter-writer subagents in parallel using the Agent tool.

**Batching strategy by book size:**
- **Booklet (8–15 chapters):** One to two waves of 8 chapters each
- **Short (15–25 chapters):** Three waves of 8–9 chapters each
- **Standard (15–25 chapters):** Three waves of 8–9 chapters each

Wave 1: First 4-6 chapters (spawn agents simultaneously)
Wave 2: Next batch after Wave 1 completes
Continue until all chapters are written.

**Agent invocation:** Each chapter-writer subagent receives this prompt:

```
Write Chapter [N] of "[Book Title]"

Project directory: [project_directory]
Book DNA: [project_directory]/book-dna.md
Voice profile: [project_directory]/voice-profile.md
Chapter outline section: [paste the specific ## Chapter N section from chapter-outline.md]
Research notes: [project_directory]/research/ch[NN]-research.md
Output path: [project_directory]/drafts/ch[NN]-draft.md
Target word count: ~[N] words
Momentum position: [Foundation/Building/Accelerating/Climax/Landing]
```

Each chapter-writer agent uses the `chapter-writer` subagent definition from `${CLAUDE_PLUGIN_ROOT}/agents/chapter-writer.md`, which preloads the `dag-book-crafter:writer` skill.

**Post-wave verification:** After each wave completes, verify all expected `drafts/ch[NN]-draft.md` files exist and contain the `<!-- METADATA` block. Report any missing chapters and retry them before starting the next wave.

**Completion check:** After all waves, count draft files and confirm they match the outline chapter count. Display: "Stage 3 complete: [N]/[N] chapters drafted. Proceeding to Stage 4."

**Critical:** Book DNA is READ-ONLY during parallel writing. No agent updates shared files. Updates happen between stages only.

#### Stage 4: Edit (Voice Consistency + Flow + Validation + Review)

**Step 1: Invoke the editor**

Invoke the `dag-book-crafter:editor` skill with arguments:
- Project directory path
- Edit mode: "full"

The editor performs three sequential passes:
1. Pass 1: Voice consistency + theological guardrails (each chapter audited against voice profile)
2. Pass 2: Flow/transitions (sequential chapter-pair analysis, only modifies endings/openings)
3. Pass 3: Cross-chapter validation (term index, reference validation, scripture consistency, theme tracking)

For books with 16+ chapters, the editor uses chapter-editor subagents with rolling window for Pass 1. Passes 2 and 3 are always handled by the main editor skill.

**Step 2: Verify editing output**

After the editor returns:
1. Verify `edited/ch[NN]-final.md` files exist for all chapters (count matches outline)
2. Verify `reports/consistency-report.md` exists
3. Read the editor's return summary for the overview metrics

**Step 3: Review gate (ITER-02)**

Present the draft review to the user:

```
## Draft Review: [Book Title]

Your manuscript is ready for review.

### Summary
- **Chapters:** [N]
- **Total words:** [sum of word counts from METADATA blocks in edited files]
- **Voice consistency:** [Clean/Minor/Significant] ([X] issues found, [Y] auto-resolved)
- **Transitions:** [X]/[N-1] transitions smooth
- **Cross-references:** [X] validated, [Y] flagged

### Consistency Report
See: [project_directory]/reports/consistency-report.md

### Options
1. **Approve** -- proceed to formatting (Stage 5)
2. **Revise chapters** -- tell me which chapters need rewriting and what to change
3. **Read full draft** -- I'll compile all chapters for you to read through

Which would you like?
```

**On Option 1 (Approve):** Proceed to Stage 4.5 (Content Enrichment).

**On Option 2 (Revise chapters -- ITER-03, ITER-04, ITER-05):**

For each chapter the user wants revised:

a. **Version backup (ITER-05):** Before overwriting, copy the current draft to `revisions/`:
   - Scan `revisions/` for existing `ch[NN]-v*-draft.md` files using `ls revisions/ch[NN]-v*-draft.md 2>/dev/null | sort -V | tail -1`
   - If no existing versions, this is v01. If highest is v02, next is v03.
   - Copy `drafts/ch[NN]-draft.md` to `revisions/ch[NN]-v[VV]-draft.md`

b. **Re-invoke writer:** Spawn a chapter-writer subagent with the user's feedback appended to the standard arguments. The writer produces a new `drafts/ch[NN]-draft.md`.

c. **Re-invoke editor in revision mode:** Invoke `dag-book-crafter:editor` with:
   - Project directory path
   - Edit mode: "revision"
   - Chapters to edit: [the revised chapter number]
   The editor runs Pass 1 on the revised chapter, Pass 2 on the revised chapter + its immediate neighbours (one hop only -- ITER-04), and targeted Pass 3 validation.

d. **Update consistency report:** The editor updates `reports/consistency-report.md` with revision results.

e. **Add revision marker:** If revisions are in progress, add `<!-- REVISION IN PROGRESS -->` to the top of `reports/consistency-report.md`. Remove the marker when all requested revisions are complete.

f. **Return to review gate:** After all requested revisions complete, present the updated review summary. The user can approve, request more revisions, or read the full draft.

**On Option 3 (Read full draft):**
Compile all `edited/ch[NN]-final.md` files into a single markdown document and present it to the user (or tell them the file paths to read). Then return to the review gate.

##### Revision Cap and Divergent-Improvement Detection

This subsection wires the hard 2-revision cap and divergent-improvement detection into the chapter revision loop above. It applies to BOTH the Stage 4 Option 2 user-driven revision flow (steps a-f) AND every editor-triggered auto-revise call (DAG-01 story-opener failure, DAG-02 scripture density failure, DAG-05 overflow failure, DAG-06 hedging/transliteration failure, and DAG-08 fabricated testimony failure). Flag-only failures (DAG-03, DAG-04, DAG-07) do NOT trigger the revision loop - they only append to the diagnostic report assembled by editor §4.6.

**Per-chapter revision state.**

The orchestrator tracks per-chapter revision state in `reports/revision-log.md` (created on first revision, append-only). Each chapter has an entry of the form:

```
## Ch [NN] revision history

revision_count: <integer, 0..2>
revision_history:
  - revision_n: 0
    captivation_total: <0..16>
    component_scores: {clarity_of_point: N, scripture_saturation: N, structural_parallelism: N, direct_address: N, simplicity: N, emphasis_repetition: N, illustration_discipline: N, novelty_variation: N}
    craft_check_failures: [DAG-XX, ...]
    source_file: drafts/ch[NN]-draft.md
  - revision_n: 1
    captivation_total: <0..16>
    component_scores: {...}
    craft_check_failures: [...]
    source_file: revisions/ch[NN]-v01-draft.md
  - revision_n: 2
    captivation_total: <0..16>
    component_scores: {...}
    craft_check_failures: [...]
    source_file: revisions/ch[NN]-v02-draft.md
status: capped | converged | divergent | accepted
final_revision: <integer index into revision_history>
```

`revision_count` starts at 0 (the original draft) and increments by 1 each time the writer is re-invoked for that chapter. `component_scores` is harvested from the editor's Pass 1 captivation rubric output (the 8 components from `references/captivation-rubric.md`). `craft_check_failures` is harvested from the deterministic `scripts/craft-check.js` JSON written into the chapter's `<!-- VOICE AUDIT -->` `craft_check` block.

**Hard cap.**

`revision_count` must NEVER exceed 2. After the second revision (revision_n == 2), no further revision is attempted even if hard-gate checks still fail. This is the structural prevention against Pitfall 4 (Auto-Revise Infinite Loop) and the locked policy from Phase 10 D-08.

If a user explicitly requests a third revision on the same chapter via Stage 4 Option 2 or Mode 5, the orchestrator MUST refuse with this exact message and return to the review gate without spawning a writer subagent:

> "Chapter [NN] has already used the 2-revision cap. The highest-scoring revision is currently in place. To revise further, you'll need to manually edit the file or restart the chapter via Mode 6 (Fresh)."

**Divergent-improvement detection.**

After each revision N where N ≥ 1 (i.e. after revision_count increments to 1 or 2), the orchestrator compares the new revision's `component_scores` against the previous revision's `component_scores` BEFORE accepting the new revision as the working draft.

1. For each of the 8 captivation components, compute `delta = scores[N] - scores[N-1]`.
2. If ANY single component has `delta < 0` (revision N scores LOWER than revision N-1 on that sub-component, even if the total went up), declare **divergent improvement**.
3. On divergent improvement: roll back to revision N-1 - restore `drafts/ch[NN]-draft.md` from the previous `revisions/ch[NN]-v[VV]-draft.md`, re-run editor Pass 1 on the rolled-back draft to restore `edited/ch[NN]-final.md`, set `status: divergent` and `final_revision: N-1` in the revision log, and STOP the revision loop for this chapter.
4. Append a flag to the `DAG Craft Diagnostic` section of `reports/consistency-report.md` (the section editor §4.6 assembles) using exactly this format so §4.6 can render it under "Revision Cap Notes":

   ```
   Chapter [NN]: divergent improvement detected at revision [N]. Accepted revision [N-1] (component [X] dropped from [A] to [B]).
   ```

The detection is intentionally STRICT: any single sub-component regression trips it. The rationale (D-09 + Pitfall 4) is that "total went up but one component dropped" is the signature failure mode of forced rewrites on judgment checks - the rewrite trades depth in one dimension for surface gains in another.

**Revision exhaustion handling (cap hit).**

If `revision_count == 2` and hard-gate `craft_check_failures` remain non-empty after editor Pass 1 reruns on the v02 draft, the orchestrator does NOT spawn a third writer call. Instead, it picks the highest-scoring revision from the recorded history:

1. Compare `captivation_total` across all entries in `revision_history`.
2. The winner is the entry with the highest `captivation_total`. Ties are broken by lowest `craft_check_failures` length, then by lowest `revision_n` (earliest wins).
3. Restore the winner's `source_file` as the working draft, re-run editor Pass 1/2/3 against it so `edited/ch[NN]-final.md` reflects the chosen revision, set `status: capped` and `final_revision: <winner index>` in the revision log.
4. Append a flag to the `DAG Craft Diagnostic` section of `reports/consistency-report.md` using exactly this format so §4.6 can render it under "Revision Cap Notes":

   ```
   Chapter [NN] hit the 2-revision cap. Accepted revision [M] (captivation total [T], craft check failures [F]). Human review recommended at Stage 4 review gate.
   ```

5. Continue the pipeline. Do NOT halt. The user sees the flag at the Stage 4 review gate alongside all other diagnostics and decides whether to manually intervene.

**Auto-revise trigger integration.**

Editor Pass 1 (DAG-01 story-opener fail, DAG-02 scripture density fail, DAG-05 overflow fail, DAG-06 hedging/transliteration fail) and DAG-08 (fabricated testimony fail) write revision requests to `[project_directory]/revisions/ch[NN]-request.md`. The orchestrator detects this file at the top of each revision iteration and treats it as an auto-revise trigger:

1. Read the request, version-backup the current draft (same v[VV] scheme as Stage 4 Option 2 step a).
2. Increment `revision_count` and re-spawn the writer with the request's `failed_check`, `scope`, and `evidence` fields appended to the standard arguments.
3. Re-run editor Pass 1 on the new draft, harvest the new `component_scores` and `craft_check_failures`, append to `revision_history`.
4. Apply divergent-improvement detection (above). If divergent, roll back and stop. Otherwise:
5. If hard-gate failures remain AND `revision_count < 2`, loop. If `revision_count == 2` and failures remain, apply revision exhaustion handling (above). If failures cleared, set `status: converged` and `final_revision: <current N>`, stop the loop.

Flag-only checks (DAG-03, DAG-04, DAG-07) do NOT write revision requests and do NOT enter this loop. They are surfaced exclusively through editor §4.6 diagnostic assembly.

**State persistence.**

`reports/revision-log.md` survives across orchestrator restarts and across Mode 3 (Resume) re-entries. On Resume, the orchestrator reads the revision log and restores per-chapter `revision_count` before deciding whether further revision is permitted. Mode 6 (Fresh) deletes `reports/` which clears the log - fresh runs start every chapter at `revision_count: 0`.

#### Stage 4.5: Content Enrichment

**Step 1: Verify readiness**

1. Confirm Stage 4 is COMPLETE: all `edited/ch[NN]-final.md` files exist AND `reports/consistency-report.md` exists AND no `<!-- REVISION IN PROGRESS -->` marker
2. Check if `enrichments/` already has all expected files (resume logic)

**Step 2: Invoke the enricher**

Invoke the `dag-book-crafter:enricher` skill with argument:
- Project directory path: `[project_directory]`

The enricher will:
1. Read all `edited/ch[NN]-final.md` files and `book-dna.md`
2. Determine if the book is theological (from voice profile)
3. Generate per-chapter enrichments (discussion questions, summaries, prayer points if theological)
4. Generate a foreword in `front-matter/foreword.md`

**Step 3: Verify enrichment output**

After the enricher returns:
1. Count `enrichments/ch[NN]-enrichments.md` files -- must match chapter count
2. Verify each enrichment file contains the `<!-- ENRICHMENT METADATA` marker
3. Verify `front-matter/foreword.md` exists and contains `<!-- FOREWORD METADATA` marker
4. Display: "Stage 4.5 complete: [N] chapter enrichments + foreword generated"

**Step 4: Post-enricher novelty gate (Stage 4.6)**

> The editor's §4.4.5 Novelty and Dedup Audit runs during Stage 4, before the foreword exists. This gate runs AFTER Stage 4.5 so the full corpus - including the enricher-generated foreword - is checked for verbatim overlap. It is the structural fix for the SC-6 proof run failure where three 6+ word spans bled from ch01 into the foreword undetected.

Run the deterministic novelty check against the full corpus:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js" \
  --novelty \
  --tier both \
  --dna "[project_directory]/book-dna.md" \
  "[project_directory]"
```

Parse the JSON output.

**If `flag: false` (novelty_dedup: pass):**
- Display: "Stage 4.6 post-enricher novelty gate: PASS. Proceeding to Stage 5."
- Proceed to Stage 5 (Format). No approval gate for enrichments -- users can request revision through Mode 5 after reviewing the .docx.

**If `flag: true` (novelty_dedup: fail):**
- Display the flag summary: "Stage 4.6 post-enricher novelty gate: FAIL. [N] flags detected."
- List each flag (repeated_spans, cross_artefact_hits, illustration_reuse, refrain_overuse, tier2 hits).
- Write the flags to `[project_directory]/reports/rewrite_targets.yaml` in the D-12 format (each target with file, span, reason, flagged_by: craft-check). For foreword-to-chapter overlaps, the reason MUST include the specific span and a directional instruction like "rewrite the foreword sentence at L[N] to avoid verbatim overlap with edited/ch[NN]-final.md:L[M]".
- Update the `## Captivation Score` YAML block in `reports/consistency-report.md`: set `novelty_dedup: fail` and populate `novelty_dedup_flags` with the flag array. This OVERWRITES any `novelty_dedup: pass` the editor emitted during Stage 4 (the editor could not see the foreword at that point).
- Display: "Pipeline halted. Use Mode 7 (`--rewrite-targets`) to re-run flagged artefacts, or manually edit the foreword at `front-matter/foreword.md` and re-run the orchestrator."
- HALT. Do NOT proceed to Stage 5.

#### Stage 5: Format

**Step 1: Verify readiness**

1. Confirm Stage 4 is COMPLETE: all `edited/ch[NN]-final.md` files exist AND `reports/consistency-report.md` exists AND no `<!-- REVISION IN PROGRESS -->` marker
2. Confirm `book-dna.md` exists in the project directory
3. Create `output/` directory if it does not exist: `mkdir -p [project_directory]/output`
4. Confirm Stage 4.5 is COMPLETE: `enrichments/` has files matching chapter count AND `front-matter/foreword.md` exists

**Step 2: Invoke the formatter**

Invoke the `dag-book-crafter:formatter` skill with argument:
- Project directory path: `[project_directory]`

The formatter will:
1. Read `book-dna.md` for metadata (title, subtitle, author, chapter count, key terms, style rules)
2. Read `voice-profile.md` for spelling conventions
3. Read all `edited/ch[NN]-final.md` files
4. Generate a Node.js script using docx-js that assembles the complete .docx
5. Execute the script to produce `output/[Book Title].docx`
6. Read all `enrichments/ch[NN]-enrichments.md` files for per-chapter discussion questions, summaries, and prayer points
7. Read `front-matter/foreword.md` for the foreword

**Step 3: Verify output**

After the formatter returns:
1. Check that `output/` directory contains a `.docx` file: `ls output/*.docx 2>/dev/null`
2. Verify the file is > 0 bytes: `test -s output/*.docx`
3. Report file size: `ls -lh output/*.docx`
4. If validation script is available, run it: `python scripts/office/validate.py output/*.docx` (optional -- do not fail if script not found)

**Step 4: Report completion**

Display:
```
## Pipeline Complete: [Book Title]

Your book has been formatted and exported.

Output: [project_directory]/output/[Book Title].docx
Size: [file size]
Chapters: [N]

Front matter: Half title, Title page, Copyright, Dedication, Foreword, Table of Contents
Per chapter: Discussion Questions, Chapter Summary, Prayer Points (theological only)
Back matter: About the Author, Scripture Index, Glossary

Note: When you open the .docx in Word, you may see "Update fields?" -- click Yes to populate the Table of Contents.

The book pipeline is now complete. You can:
1. Open the .docx in Microsoft Word or Google Docs
2. Request revisions to specific chapters (use Mode 5)
3. Start a new book project
```

Update the **Status Dashboard** (Section 4) to show the completed format:
```
[x] Stage 5: Formatting (formatter)
    Generated: [date] | File: [filename] | Size: [size]
```

No changes needed to Section 3 (State Detection) since `output/*.docx` detection is already implemented.

## 6. Execution Modes

### Mode 1: Guided (Default)

The default interaction mode. The orchestrator:

1. Shows the status dashboard
2. Explains what the next stage does and what it will produce
3. Asks for confirmation before proceeding
4. Reports results after each stage completes
5. Pauses at approval gates (outline review)

Use this mode when the user wants oversight of each stage.

### Mode 2: Full Pipeline ("write the whole book")

Triggered when the user says "write the whole book", "full pipeline", "run everything", or "generate the complete book":

1. Create project if needed (gather details first)
2. Execute each stage in sequence, automatically advancing
3. **Always pause** at the outline approval gate -- this is never skipped
4. Report progress after each stage completes
5. Stop at the first stub skill encountered (do not skip stages)
6. Display final dashboard when complete or blocked

### Mode 3: Resume ("continue", "resume", "pick up where we left off")

Triggered when the user wants to continue interrupted work:

1. Detect pipeline state via the detection algorithm
2. Show the status dashboard with current progress
3. Identify the next incomplete stage or partially complete stage
4. Offer to continue: "You're at Stage [N]. Would you like me to continue from here?"
5. If a stage is partially complete, specify which chapters remain

### Mode 4: Status Only ("book status", "where am I", "show progress")

Show the dashboard only. Do not execute anything.

1. Detect pipeline state
2. Display the full status dashboard
3. Report the next action that would be taken if the user chooses to continue

### Mode 5: Revision ("revise chapter 3", "rewrite chapters 5 and 7")

Triggered when the user requests revision of specific chapters on an existing project:

1. Detect pipeline state -- verify Stage 4 is COMPLETE or IN REVIEW
2. Parse chapter numbers from the user's request (e.g., "revise chapter 3" -> [3], "rewrite chapters 5 and 7" -> [5, 7])
3. Gather the user's feedback for each chapter (what to change, what's wrong, what they want instead)
4. Execute the revision workflow for each chapter:
   a. Version backup: copy current `drafts/ch[NN]-draft.md` to `revisions/ch[NN]-v[VV]-draft.md`
   b. Re-invoke writer: spawn chapter-writer subagent with user feedback appended to standard arguments
   c. Re-invoke editor in revision mode: `dag-book-crafter:editor` with mode "revision" and the revised chapter numbers
   d. Editor runs Pass 1 on revised chapters, Pass 2 on revised chapters + immediate neighbours (one hop), targeted Pass 3
   e. Update `reports/consistency-report.md` with revision results
5. Return to the review gate (present updated summary with approve/revise/read options)

### Mode 6: Fresh Run

Triggered when the user wants to re-run the pipeline from scratch on an existing project while preserving the original inputs (sources, adapted sources, brief, and voice profile).

**Trigger phrases (natural-language detection):**

- "start fresh"
- "rerun from scratch"
- "fresh build"
- "regenerate everything"
- "--fresh"

If any of these phrases appear in the user's utterance during orchestrator invocation, enter Mode 6 BEFORE running the state detection algorithm in Section 3.

**Mode 6 preprocessing steps:**

1. **Identify the project directory** from the user's request (same logic as Mode 3 Resume and Mode 5 Revision).

2. **Compute the delete list and preserve list** against the project directory:
   - **Delete list:** `chapter-outline.md`, `research/`, `drafts/`, `edited/`, `revisions/`, `enrichments/`, `front-matter/`, `reports/`, `output/`
   - **Conditional delete - `book-dna.md`:** Delete by default. **EXCEPTION (Phase 13, D-09 fixture bypass):** If `book-dna.md` exists AND contains a `## Refrains` section with at least one non-comment entry (fenced yaml block with one or more `- phrase:` lines), preserve it. This is the pre-approved refrains block that the outliner's Refrain Candidate Gate bypass depends on - wiping it would make the fixture-bypass precondition unreachable. The outliner's §6 Generate Book DNA path will still overwrite the Chapter Map in the preserved file after outline approval; the Refrains block is what survives. Detect via: `awk '/^## Refrains/,/^## /' book-dna.md | grep -q '^- phrase:'`.
   - **Preserve list:** `sources/`, `sources-adapted/`, `brief.md`, `voice-profile.md`, and `book-dna.md` iff the conditional clause above holds.

3. **Mandatory confirmation prompt - never silent delete.** Present the specific paths about to be deleted and the specific paths that will be preserved, and wait for an explicit affirmative response. If `book-dna.md` was moved to the preserve list via the D-09 clause, call it out explicitly so the user knows the refrains block is surviving:

   > "Fresh mode will delete the following in `{project_path}`: [dynamic delete list - omit book-dna.md if preserved]. Preserved: sources/, sources-adapted/, brief.md, voice-profile.md[, book-dna.md (pre-approved refrains block detected - Phase 13 D-09)]. Proceed? (yes/no)"

   Affirmative responses: `yes`, `y`, `proceed`, `confirm` (case-insensitive). Any other response aborts Mode 6 and falls through to Mode 3 (Resume), which presents the status dashboard from the current state without deleting anything.

4. **On affirmative response, perform the deletes.** The delete operation is idempotent - items in the delete list that do not exist in the project directory are skipped silently. Non-empty directories are removed recursively (`rm -rf`). Every item in the preserve list is left untouched regardless of the delete list order.

5. **Re-enter state detection (Section 3).** Because the delete list covers every downstream artefact, state detection will identify the earliest pipeline stage as the next stage (Stage 0.5 if `sources-adapted/` is absent but `sources/` contains sermon-format material, otherwise Stage 1 Outline). From here the orchestrator proceeds in whichever execution mode the user requested alongside Mode 6 (Guided by default, or Full Pipeline if the user said "rerun the whole book from scratch").

**Safety Invariants:**

- **Never delete `sources/`, `sources-adapted/`, `brief.md`, or `voice-profile.md`.** These paths are hard-coded into the preserve list and no user instruction can override them inside Mode 6. If the user genuinely needs to wipe a source directory they must do so manually outside the orchestrator.
- **Never delete `book-dna.md` when it carries a pre-approved refrains block (D-09 fixture bypass precondition).** If the file contains `## Refrains` with at least one `- phrase:` entry, it must survive Mode 6 so the outliner's Refrain Candidate Gate bypass remains reachable. The user can still manually wipe it outside the orchestrator if they want a genuine clean slate.
- **Never delete without explicit user confirmation.** The confirmation prompt is mandatory on every Mode 6 invocation. There is no "remember my answer" mode. There is no `--yes` shortcut inside the orchestrator.
- **Never re-prompt without showing the specific paths about to be deleted.** The confirmation prompt always enumerates the delete list and the preserve list in full. A vague "are you sure?" prompt is not compliant.
- **Never delete files outside the identified project directory.** All paths in the delete list resolve relative to `{project_path}`. Mode 6 must never touch plugin files, other projects, or the user's home directory.

### Mode 7: Rewrite Targets (Phase 13, D-11)

> Phase 13 adds a scoped re-run mode so a dedup failure on a 20-chapter book does not require re-running the whole pipeline. Editor Pass 3 §4.4.5 emits a `rewrite_targets` block when `novelty_dedup` fails. This mode reads that block and re-runs writer + editor for ONLY the flagged chapters, with each target's `reason` field injected as directional writer guidance. Follows the Mode 6 Fresh Run phrase-trigger pattern.

#### Phrase triggers

- `--rewrite-targets`
- `rewrite the flagged chapters`
- `apply rewrite targets from <path>`
- `re-run flagged chapters`

If the invocation prompt contains any of these phrases, Mode 7 activates BEFORE the state detection algorithm in Section 3. The optional path argument points to a `rewrite_targets.yaml` file; the default is `[project_directory]/reports/rewrite_targets.yaml` (the path where editor Pass 3 §4.4.5 writes it).

#### Preprocessing steps

1. **Identify the project directory.** Use the same resolution logic as Mode 6: explicit project path argument if provided, else `~/Documents/Books/<book-name>`, else the current project state.

2. **Resolve the `rewrite_targets.yaml` path.** Default: `[project_directory]/reports/rewrite_targets.yaml`. If the user supplied an explicit path via `apply rewrite targets from <path>`, use that instead. If the file does not exist, halt with:

   > "Mode 7: rewrite_targets.yaml not found at [path] - run editor Pass 3 first to produce the targets block."

3. **Parse the yaml file.** Expected shape (matches editor §4.4.5 emit contract):

   ```yaml
   rewrite_targets:
     - file: edited/ch02-final.md
       span: "L21-L28"
       reason: "verbatim overlap with front-matter/foreword.md:L12-L18 - rewrite the testimony illustration using a different sourced detail"
       flagged_by: craft-check
     - file: edited/ch03-final.md
       span: "L40-L47"
       reason: "same illustration vehicle (electrical socket analogy) dominates ch01 and ch03 - substitute with a distinct vehicle from the motif family"
       flagged_by: editor-pass3
   ```

   Use a minimal handwritten YAML parser (~30 lines, the same flat-schema parser pattern used by `craft-check.js --dna` for the refrains block). No new npm dependency.

4. **Validate the `reason` field for every target.** D-12 requires specific directional hints. Reject any target whose `reason` does NOT contain BOTH (a) a source location (file reference, path, or line range `L\d+-L\d+`) AND (b) one of the directional verbs `rewrite`, `substitute`, `replace`, `different`. If any target has a generic reason, halt with:

   > "Mode 7: target [file] has insufficient reason - D-12 requires a specific cross-reference and directional instruction. Edit rewrite_targets.yaml and retry."

5. **Validate file paths for traversal safety (Pitfall 6).** For each `target.file`, compute `absolute_path = path.resolve(projectDir, target.file)` and assert `absolute_path.startsWith(projectDir)`. Any `../` escape causes an immediate halt with:

   > "Mode 7: path traversal detected in target [file] - aborting to protect files outside the project directory."

6. **Mandatory confirmation prompt - never silent delete.** Surface a prompt listing EVERY chapter that will be re-run and EVERY file that will be deleted:

   > "Mode 7 will re-run writer + editor for these chapters: [list]. Files to be deleted before re-run: [list of `edited/ch*-final.md` and `drafts/ch*-draft.md` paths]. Proceed? (yes/no)"

   Halt if the author says anything other than affirmative (`yes`, `y`, `proceed`, `confirm`, case-insensitive).

7. **Delete the listed chapter files.** Delete each listed `edited/ch*-final.md` AND the corresponding `drafts/ch*-draft.md` (so filesystem-as-state makes writer regenerate them from scratch). Preserve every other chapter's files. The **explicit preserve list** - never deleted by Mode 7 - is: `sources/`, `sources-adapted/`, `brief.md`, `voice-profile.md`, `book-dna.md`, `chapter-outline.md`, `research/`, `front-matter/`, `enrichments/`, and any chapter not named in `rewrite_targets`. Never delete anything not explicitly named in `rewrite_targets`.

8. **Inject each target's `reason` field into the writer's invocation prompt for that specific chapter.** Writer prompts are built per-chapter by the existing Stage 3 wave-batching logic - extend that builder to check a `rewrite_reason` parameter and, if present, append a section to the writer prompt:

   > "REWRITE GUIDANCE (Phase 13 Mode 7, flagged_by [flagged_by]): [reason text]. Your rewrite MUST address this specific reason. Producing the same text as before is a hard fail."

9. **Re-enter the orchestrator's normal state detection flow (Section 3).** Because the listed chapters' files are now deleted, the normal writer + editor stages will re-run for exactly those chapters. Other chapters remain byte-identical.

10. **After the editor Pass 3 re-runs, re-check `novelty_dedup`. Do NOT auto-loop.** If it is STILL `fail`, halt and surface the new `rewrite_targets.yaml` (which may be different from the previous one - different flags, different chapters, different reasons). Tell the author:

    > "Mode 7: dedup failure persists after scoped re-run. New rewrite_targets.yaml written at reports/rewrite_targets.yaml. Invoke Mode 7 again with the new targets, or manually rewrite the flagged spans and re-run editor."

    This respects D-10 (no auto-remediation, editor stays judge-not-author).

#### Safety invariants

- **Mandatory confirmation prompt** - never proceed silently. Every Mode 7 invocation enumerates the full re-run list and delete list.
- **Path-traversal protection** - `absolute_path` MUST start with `projectDir`. Any `../` escape aborts immediately before any file is touched.
- **Explicit preserve list** - never delete `sources/`, `sources-adapted/`, `brief.md`, `voice-profile.md`, `book-dna.md`, `chapter-outline.md`, `research/`, `front-matter/`, `enrichments/`, or any chapter not named in `rewrite_targets`.
- **No auto-loop** - one Mode 7 invocation triggers at most one scoped re-run; a second failure requires a second explicit Mode 7 invocation.
- **Byte-identical untouched chapters** - chapters NOT listed in `rewrite_targets` stay byte-identical through the entire Mode 7 flow. Assert this via a pre/post file hash check if feasible; otherwise rely on the explicit preserve list as the guarantee.
- **Reason field D-12 contract enforcement** - reject targets with generic reasons BEFORE touching any file. No destructive operation runs until every target passes validation.

#### Relationship to other modes

Mode 6 (Fresh Run) wipes the entire run directory and restarts the pipeline. Mode 7 wipes only the flagged chapters. Mode 6 is appropriate when the outline or Book DNA is wrong; Mode 7 is appropriate when only specific chapters failed the novelty audit. Mode 7 cannot run before the editor has produced a `reports/rewrite_targets.yaml` - if that file does not exist, the user needs Mode 6 (Fresh Run) or a normal Stage 4 re-run, not Mode 7. Mode 7 honours the Phase 11 D-09 fixture bypass indirectly: on the `fixtures/tiny-book/` fixture (3 chapters), Mode 7 re-runs all 3 chapters if all 3 are flagged, which is functionally equivalent to a full re-run but preserves the Mode 7 contract for larger books.

#### Example invocation

```
/dag-book-crafter:orchestrator --rewrite-targets
/dag-book-crafter:orchestrator apply rewrite targets from ~/Documents/Books/MyBook/reports/rewrite_targets.yaml
```

Both invocations trigger Mode 7. The orchestrator locates the yaml, parses the targets, enforces the D-12 reason contract, surfaces the mandatory confirmation prompt, deletes only the flagged chapters, and re-enters state detection so writer + editor re-run exclusively for those chapters.

## 7. Error Handling

Handle these common situations gracefully:

### Project Not Found
> "No book project found at ~/Documents/Books/[name]. Would you like to create a new project?"

### Outline Not Approved
> "The outline for '[Book Title]' hasn't been approved yet. Please review chapter-outline.md and let me know if you'd like to approve it or request changes."

### Stub Skill Encountered
> "Stage [N] ([skill name]) is not yet implemented. It will be available in a future phase. The pipeline pauses here."

List which stages are currently implemented and which are stubs.

### Partial Stage Completion
> "Stage [N] is partially complete: [x]/[n] chapters processed. Missing: [list of missing chapter numbers]. Would you like to resume and complete the remaining chapters?"

### Missing Dependencies
If a stage's expected input files are missing (e.g., trying to write without research):

> "Cannot start Stage [N] ([name]). Required input files are missing:
> - Expected: [list of expected files]
> - Found: [list of existing files]
> - Missing: [list of missing files]
>
> You may need to re-run Stage [N-1] first."

### Revision Without Editing
If the user requests revision but Stage 4 has not yet run:

> "The manuscript hasn't been edited yet. Let me run the editing passes first, and then you can review and request revisions."

### No Books Directory
If `~/Documents/Books/` does not exist, create it when the user starts a new project. Do not require the user to create it manually.

### Empty Project
If a project directory exists but contains no artefacts (no outline, no book-dna.md):

> "The project '[Book Title]' exists but has no content yet. Starting from Stage 1 (Outline)."

## 8. Reference File Paths

The orchestrator uses these paths for plugin resources and project files:

```
Plugin root:         ${CLAUDE_PLUGIN_ROOT}
Pipeline stages ref: ${CLAUDE_PLUGIN_ROOT}/references/pipeline-stages.md
Book DNA template:   ${CLAUDE_PLUGIN_ROOT}/references/book-dna-template.md
Voice profiles dir:  ${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/
Default voice:       ${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/dag-default.md
Subagent defs:       ${CLAUDE_PLUGIN_ROOT}/agents/chapter-writer.md
                     ${CLAUDE_PLUGIN_ROOT}/agents/chapter-editor.md
Voice builder:       ${CLAUDE_PLUGIN_ROOT}/skills/voice-builder/SKILL.md
Stage skills:        ${CLAUDE_PLUGIN_ROOT}/skills/sermon-adapter/SKILL.md
                     ${CLAUDE_PLUGIN_ROOT}/skills/outliner/SKILL.md
                     ${CLAUDE_PLUGIN_ROOT}/skills/researcher/SKILL.md
                     ${CLAUDE_PLUGIN_ROOT}/skills/writer/SKILL.md
                     ${CLAUDE_PLUGIN_ROOT}/skills/editor/SKILL.md
                     ${CLAUDE_PLUGIN_ROOT}/skills/enricher/SKILL.md
                     ${CLAUDE_PLUGIN_ROOT}/skills/formatter/SKILL.md
Default project dir: ~/Documents/Books/
```

When referencing plugin files, always use `${CLAUDE_PLUGIN_ROOT}` -- never hardcode absolute paths. This ensures the plugin works regardless of installation method (marketplace, --plugin-dir, or user plugin directory).
