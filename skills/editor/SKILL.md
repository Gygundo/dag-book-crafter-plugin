---
name: editor
description: "Audit voice consistency, flow, and transitions across all chapters. Called by the orchestrator during the editing stage of the book pipeline."
user-invocable: false
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Book Editor

Three-pass sequential editing pipeline that transforms individually-written chapter drafts into a cohesive manuscript. Each pass builds on the previous pass's output: voice normalisation first, then opener/landing conformance and illustration audit, then cross-chapter validation. The result is a manuscript that reads as one voice, with each chapter a self-contained sermon unit conforming to the DAG teaching style.

## 1. On Invocation

Receive via `$ARGUMENTS`:
- **Project directory path** -- the book project root
- **Edit mode** -- "full" (all three passes on all chapters) or "revision" (targeted re-edit of specific chapters)
- **Chapters to edit** -- (optional, for revision mode only) list of chapter numbers to re-edit

**Step 1: Read Book DNA**

Read `[project_directory]/book-dna.md` for:
- Voice profile summary (tone, sentence rhythm, vocabulary, emphasis techniques)
- Theological/domain framework (the interpretive lens for content decisions)
- Chapter map (chapter positions, opener_type, list_structure, key_statement, testimony_seed, momentum positions)
- Refrains block (declared phrases with max_uses budgets - these are exempt from dedup)
- Running themes (themes to track across chapters)
- Key terms (terminology that must be consistent)
- Cross-chapter continuity notes

**Step 2: Read Voice Profile**

Read `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/dag-default.md` (or the project-specific override) for detailed voice rules. Pay particular attention to:
- **Tone** -- the overall tonal quality to enforce
- **Sentence Patterns** -- average sentence length target, anaphora, rhetorical question volleys
- **Vocabulary > Use** -- words and phrases characteristic of this voice
- **Vocabulary > Avoid** -- words and phrases that break this voice (hard constraint)
- **Emphasis Techniques** -- ALL-CAPS-in-quote, bold numbered points, key statements, benedictions
- **Anti-Patterns** -- behaviours that break the voice (hard constraint)
- **Theological Framework** -- the interpretive lens for theological content
- **Reader Situations** -- concrete situations to anchor application in (≥2 per chapter)

**Step 3: Read Chapter Outline**

Read `[project_directory]/chapter-outline.md` for:
- Total chapter count
- Per-chapter fields: opener_type, list_structure (stem + count), key_statement, testimony_seed
- Momentum positions per chapter (Foundation, Building, Accelerating, Climax, Landing)

**Step 4: Count Chapters**

```bash
ls [project_directory]/drafts/ch*-draft.md | wc -l
```

**Step 5: Determine Editing Strategy**

- **15 or fewer chapters:** The editor reads all chapters directly. No subagents needed for Pass 1.
- **16+ chapters:** Use `chapter-editor` subagents with rolling window for Pass 1 (see Section 5).

Pass 2 and Pass 3 are ALWAYS handled by the main editor skill, regardless of chapter count.

**Step 6: Create Output Directories**

```bash
mkdir -p [project_directory]/edited [project_directory]/reports
```

## 2. Pass 1 -- Voice Consistency + Theological Guardrails

**Purpose:** Normalise each chapter's voice against the profile and run all deterministic DAG rule checks. This pass runs FIRST because subsequent passes need voice-normalised text.

**Requirements addressed:** EDIT-01 (voice consistency), EDIT-03 (theological guardrails), DAG-01..09

For each chapter (parallel via subagents if 16+ chapters, sequential otherwise):

### 2.0 Craft Check Invocation (deterministic)

**Run this BEFORE any LLM work on the chapter.** This is the deterministic craft-rule gate for DAG-01, DAG-02, DAG-04, DAG-05, DAG-06, DAG-07, DAG-09 (AI-slop scan: em dashes, negation-pivot cap, banned AI-ism phrases, emoji), and the version-stamp check. LLM judgment sub-sections (§2.4–§2.12) run later in this pass on top of these results.

**Invoke:**

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js [project_directory]/drafts/ch[NN]-draft.md
```

**Parse JSON output.** Schema:

```json
{
  "chapter_id": "ch01",
  "checks": {
    "DAG-01": { "pass": true, "evidence": "anchor_scripture opener; story-marker absent", "citations": ["L3"] },
    "DAG-02": { "pass": true, "evidence": "5 blocks; density 1/312 words; all interpreted", "citations": ["L15", "L42", "L67", "L89", "L118"] },
    "DAG-04": { "pass": false, "evidence": "no standalone key statement found", "citations": [] },
    "DAG-05": { "pass": true, "evidence": "1,840 words (within target)", "citations": [] },
    "DAG-06": { "pass": false, "evidence": "hedging phrase: 'perhaps we might'", "citations": ["L134"] },
    "DAG-07": { "pass": false, "evidence": "you-density 6.2/1000w; 2 imperatives; 3 questions", "citations": [] },
    "version_stamp": { "pass": true, "evidence": "<!-- generated-by: dag-book-crafter v1.1.0 -->", "citations": ["L2"] }
  }
}
```

**Merge every check result into the chapter's `<!-- VOICE AUDIT -->` metadata block under a new top-level field `craft_check`** (see §2.8 for the full block shape). Preserve the raw evidence and citations so Pass 2 and the Dag Style Diagnostic step can reuse them without re-invoking the script.

**Enforcement policy:**

| Check | On fail | Action |
|---|---|---|
| DAG-01 | story-marker opener detected | **Auto-revise** - request writer rewrite of chapter opener only |
| DAG-01 | opener_type mismatch (non-story) | **Flag** - carry into Pass 2 opener conformance check (§3.2) |
| DAG-02 | density underflow (< 1/350 words or < 3 blocks) | **Auto-revise** - request writer add scripture blocks |
| DAG-04 | missing key statement OR missing CAPS-in-quote | **Flag only** |
| DAG-05 | body > target+50% or > tier cap | **Auto-revise** - tighten or split |
| DAG-06 | hedging phrase detected | **Auto-revise** - rewrite the specific sentence(s) only |
| DAG-06 | > 1 transliterated term | **Auto-revise** - see §2.9 |
| DAG-07 | you-density < 8/1000w, < 3 imperatives, or < 4 questions | **Flag only** |
| DAG-09 | em dash in author prose, banned AI-ism phrase, emoji, or ≥ 2 negation-pivots ("isn't just X, it's Y" family) | **Auto-revise** - rewrite the specific sentence(s) as plain declarations; scripture blockquotes are exempt |
| version_stamp | missing `<!-- generated-by: dag-book-crafter v1.1.0 -->` | **Auto-fix** - prepend stamp (do not round-trip to writer) |

**Revision request contract:** when auto-revising, write the writer instruction to `[project_directory]/revisions/ch[NN]-request.md` with fields `reason`, `failed_check`, `scope` (opener / sentence-range / full-chapter), `evidence`, `citations`. The orchestrator routes the request to the writer.

**Revision cap:** 2 per chapter. On exhaustion, keep the highest-scoring revision by captivation total, append a flag to the diagnostic report, and continue.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/dag-craft-rules.md` - DAG-01..09, Cross-Rule Integration.

### 2.1 Vocabulary Audit

Scan the full chapter text for words and phrases from the voice profile's Avoid list (`references/voice-profiles/dag-default.md` § Vocabulary > Avoid). Use case-insensitive matching.

Flag every occurrence with:
- Approximate line location
- The specific phrase found
- Which Avoid rule it violates

**Key Avoid-list patterns for the DAG teaching voice:**
- Academic hedging: "some scholars", "it could be argued", "arguably", "studies suggest", "one might", "it seems that", "in my view", "perhaps we might", "broadly speaking", "to some extent", "many believe"
- Scholarly apparatus: footnotes, commentary citations, bibliographies, statistics as authority
- Meta-scaffolding: "in this chapter we will", "in conclusion", "as previously mentioned", "in the next chapter"
- Irony, understatement, or self-deprecating wit
- Sensory scene-setting for its own sake (weather, atmosphere, slow builds)
- Softening disclaimers ("of course there are exceptions")

Flag each occurrence; corrections happen in §2.6.

### 2.2 Sentence Length Distribution

Count words per sentence in author prose (split on `.`, `!`, `?` boundaries). **Exclude blockquote lines (beginning with `>`) and heading lines (beginning with `#` or `**N.`)**. Calculate:
- **Average author-prose sentence length** across the chapter
- **Paragraph length** - flag any prose paragraph exceeding ~120 words

Compare against DAG-06 targets (per `references/dag-craft-rules.md` § DAG-06):
- Target average: **12–16 words** (hard ceiling: ≤18 average)
- Paragraph ceiling: **~120 words** or ~5 sentences

Flag chapters whose average exceeds 18 words. Flag individual paragraphs over 120 words.

### 2.3 Anti-Pattern Detection

Check for each anti-pattern listed in the voice profile's Anti-Patterns section (`references/voice-profiles/dag-default.md` § Anti-Patterns).

| Anti-Pattern | Detection |
|-------------|-----------|
| Story-marker chapter opener | First body paragraph begins with DAG-01 forbidden regex - handled by §2.0; confirm flag is present |
| Academic hedging in any form | Banned phrases listed in DAG-06 and §2.1 |
| Uninterpreted scripture block | Block quote not followed within 2 paragraphs by a restatement or application |
| Ambiguous illustration moral | Story or analogy ends without an explicit lesson statement |
| Fabricated first-person testimony | First-person testimony without a resolvable `testimony_seed` - hard fail per DAG-08 |
| Long unbroken essay prose | > ~200 words without a heading, number, scripture block, or one-line punch |
| Detached third-person authorial voice | Extended passages without "I" or "you" - the voice speaks TO the reader |
| AI voice indicators | Overly balanced, hedged, or neutral tone; "various perspectives", "many Christians believe" |

> **Pulpit-Seam Openers - PERMITTED:** Paragraph-opener phrases such as "You see,", "Notice how...", "Listen,", "In other words," and evaluative adverb openers ("Indeed,", "Sadly,", "Amazingly,") are **authentic to the DAG teaching voice** and MUST NOT be flagged. This is a deliberate inversion of the old CRAFT-05 ban - in this style, the preacher's platform voice is the voice on the page. See §2.10 for the full inversion note.

### 2.4 Clarity of Point (rubric component)

Score the `clarity_of_point` component (0–2) per `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` § Clarity of Point. Anchor scores against the exemplars in `${CLAUDE_PLUGIN_ROOT}/references/dag-calibration.md`.

**Detection procedure:**
1. Read the chapter opener (first 150 words, excluding blockquote and heading lines).
2. Confirm the opener matches the outline's `opener_type` (anchor_scripture / plain_declaration / definition - see DAG-01).
3. Confirm the chapter's thesis is unmistakable within the first two prose sentences.
4. Scan each numbered point/section heading: each should be a complete declarative or imperative sentence stating one proposition.

**Score:**
- 2: Opener matches opener_type; thesis unmistakable within two sentences; every point heading is a complete one-proposition sentence
- 1: Theme clear but delayed past the first paragraph, OR some point headings are vague labels
- 0: Story-marker opener, or the reader cannot say what the chapter claims after 150 words

Record the score in the VOICE AUDIT block.

### 2.5 Scripture Saturation (rubric component)

Score the `scripture_saturation` component (0–2) per `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` § Scripture Saturation.

**Detection procedure:**
1. Count scripture blocks (lines beginning with `> `). Compute density: blocks ÷ (chapter body words / 350). Confirm ≥ 3 blocks absolute minimum (DAG-02 floor).
2. Check each block carries a reference line (`> -- Reference`). Non-KJV quotes must carry a translation label.
3. Confirm each block is followed within 2 paragraphs by a plain-words restatement or direct application.
4. Confirm ≥ 1 block carries an ALL-CAPS emphasis phrase.

**Score:**
- 2: Density met; every block interpreted; ≥ 1 block carries ALL-CAPS emphasis
- 1: Density met but ≥ 1 block left uninterpreted, OR density slightly under (≥ 1 per 500 words)
- 0: Fewer than 3 blocks, or blocks dropped without interpretation, or non-KJV base text unlabelled

### 2.5.5 Structural Parallelism (rubric component)

Score the `structural_parallelism` component (0–2) per `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` § Structural Parallelism.

**Detection procedure:**
1. Read the outline's `list_structure` field for this chapter.
2. **List chapters** (stem declared): verify point count matches any counted title, points are numbered with bold complete-sentence headings, and ≥ 60% of points reuse the declared stem frame.
3. **Flowing chapters** (`list_structure: flowing`): verify short title-case section headings are present (2–4 per chapter).
4. For list chapters: verify the atomic unit (heading → scripture → restatement → application) is followed for each point.

**Score:**
- 2: Count matches title; stems parallel throughout (≥ 60%); points follow the atomic unit
- 1: List present but stem drifts across points, or count mismatch of one, or atomic unit frequently incomplete
- 0: Designated list chapter rendered as undifferentiated essay prose

### 2.6 Tone Normalisation

For each flagged passage (from §2.1 vocab audit, §2.2 sentence length, §2.3 anti-pattern):
1. **Re-read the voice profile** before rewriting any passage. Rewrites MUST match the voice.
2. Rewrite to match the voice profile while preserving the argument and scripture references
3. Replace Avoid-list vocabulary with Use-list alternatives (from `dag-default.md` § Vocabulary > Use)
4. Sharpen hedged language into direct declarations ("It is!" not "It could be")
5. Break overly long sentences into short declarative stacks
6. Maintain the original meaning - change the voice, not the content

### 2.7 Theological Guardrail Check

Validate each chapter against the Theological/Domain Framework in `book-dna.md` (and the voice profile's Theological Framework section):

- **Scripture plus experience as authority:** Flag content that grounds claims in scholarship, statistics, or commentary instead of scripture and testimony
- **Supernatural-affirming:** Flag cessationist framing ("those gifts were for the early church")
- **Practical application over doctrine:** Flag speculative theology without an application "you" must take
- **Typological reading accepted:** Old Testament figures mapped onto modern church roles are authentic - do NOT flag
- **Binary moral world:** No both-sides framing; hardship stories end in vindication

For non-theological books, skip this sub-check entirely.

### 2.8 Pass 1 Output

Save each edited chapter to `[project_directory]/edited/ch[NN]-pass1.md` with the voice audit metadata block appended at the end.

**Version stamp:** Every pass1 chapter file inherits its first two lines from the writer's draft - line 1 is `<!-- provenance: {source_path}:{line} -->` and line 2 is `<!-- generated-by: dag-book-crafter v1.1.0 -->`. Preserve both lines exactly. If either is missing, prepend it before writing the pass1 file. Version-stamp auto-fix is performed here, not round-tripped to the writer.

Chapter file structure emitted by Pass 1:

```markdown
<!-- VOICE AUDIT
chapter: [N]
vocabulary_violations: [count]
  - Line ~[N]: "[phrase]" ([Avoid rule])
avg_sentence_length: [number]
paragraph_ceiling_flags: [count or "none"]
anti_patterns_found:
  - Line ~[N]: [description] ([pattern name])
theological_flags: [list or "none"]
clarity_of_point: [0|1|2]
scripture_saturation: [0|1|2]
structural_parallelism: [0|1|2]
captivation_score: [running total 0-12 from Pass 1 components]
craft_check:
  DAG-01: pass (anchor_scripture; story-marker absent)
  DAG-02: pass (5 blocks; density 1/312 words; all interpreted)
  DAG-04: flag (no standalone key statement)
  DAG-05: pass (1,840 words)
  DAG-06: pass (avg 14.2 words; no hedging; 0 transliterated terms)
  DAG-07: flag (you-density 6.2/1000w; 2 imperatives; 3 questions)
  version_stamp: pass
changes_made: [count]
severity: clean | minor | significant
-->
```

The `craft_check` field aggregates the deterministic results from §2.0 (craft-check.js) PLUS the LLM judgment results from §2.9–§2.12. Each entry is `pass` or `fail` / `flag` followed by inline evidence. Pass 2 and the Dag Style Diagnostic step read this block directly.

**Severity scale:**
- **clean** -- 0 violations, sentence length within range, no anti-patterns, captivation_score 10+
- **minor** -- 1–3 total issues (vocabulary + anti-patterns), sentence length within range, captivation_score 7+
- **significant** -- 4+ total issues, OR sentence length outside range, OR theological flags present, OR captivation_score below 7, OR any auto-revise-class craft_check failure (DAG-01 story opener, DAG-02, DAG-05, DAG-06) not yet resolved

### 2.9 DAG-06 Transliteration Check

**LLM judgment layered on top of §2.0's deterministic DAG-06 result.** craft-check.js has already confirmed the count of distinct transliterated terms (≤ 1 passes; > 1 triggers auto-revise). This sub-section performs the quality judgment: confirm the one permitted term (if present) is glossed in a single plain sentence immediately on introduction.

**Procedure:**

1. Read the citation lines from `craft_check.DAG-06.citations` in the VOICE AUDIT block (marks term-introduction lines).
2. For the term, read the sentence introducing it and the sentence immediately following.
3. Confirm the gloss is a single plain sentence giving the term's meaning in ordinary English ("'Aman' means 'to nurture', 'to foster as a parent'"). No multi-sentence word study, no etymology chain, no cross-references.

**Failure mode:** More than one transliterated term = auto-revise (remove or replace the extra terms with plain-English equivalents). Gloss missing or too elaborate = flag. Update `craft_check.DAG-06` in the VOICE AUDIT block accordingly.

Also compute the **Simplicity rubric component** (0–2) here, aggregating results from §2.2 (sentence length), §2.1 (hedging vocab flags), and this transliteration check:
- 2: Sentence average 12–16 words, zero hedging, all hard words defined, ≤ 1 transliterated term glossed in one sentence, paragraphs ≤ 120 words
- 1: Sentence average 17–22, or one undefined hard term, or one overly long paragraph
- 0: Any hedging phrase (DAG-06 auto-revise), or sentence average > 22

Record `simplicity: [0|1|2]` in the VOICE AUDIT block.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/dag-craft-rules.md` § DAG-06.

### 2.10 Pulpit-Seam Openers: Inversion Note

> **Historical note - this section documents an explicit inversion.** An earlier craft rule set (CRAFT-05) banned paragraph-opener phrases such as "You see,", "Notice,", "Listen,", "Notice how...", "In other words," as "pulpit seams" that broke a literary-fiction voice. For the DAG teaching style, this ban is **fully inverted**. Those openers are the authentic rhythm of preaching-on-the-page and are **required to be permitted**. The deterministic craft-check.js does NOT flag them as errors. The editor LLM must NOT flag them in §2.3 Anti-Pattern Detection or anywhere else.
>
> Permitted and authentic paragraph-opener patterns (never flag these):
> - Teaching framers: "You see,", "Notice how...", "Notice:", "In other words,", "Listen,"
> - Evaluative adverb openers: "Indeed,", "Sadly,", "Amazingly,", "Unfortunately,", "Surprisingly,"
> - Pre-emptive pivot: "Please do not misunderstand me. I am not saying that..."
>
> The cliffhanger PROHIBITION (DAG-07) is separately maintained: chapters must close with a landing (command, benediction, prayer, exclamation, scripture, or stated moral) - they must never close with unresolved tension, a teaser, or a trailing question.

### 2.11 DAG-04 Key Statement / CAPS Check

**Flag-only LLM pass confirming the emphasis devices that make this style quotable.**

**Procedure:**

1. Locate the chapter's `key_statement` from the Book DNA chapter map.
2. Confirm the key_statement appears verbatim (or very close paraphrase) as a **standalone single-sentence paragraph** in the chapter body. Use the deterministic regex from DAG-04 (`/^[A-Z][^\n]{20,160}[.!]$/m`) as a guide, but apply judgment on paraphrase equivalence.
3. Confirm ≥ 1 scripture block carries an ALL-CAPS emphasis phrase on its operative words (per DAG-02 and DAG-04).
4. Optionally confirm ≥ 1 anaphora run (identical sentence opener repeated 3+ times consecutively) or definition-refrain restatement.

**Scoring (Emphasis & Repetition rubric component, 0–2):**
- 2: Key statement lands + CAPS-in-quote + at least one anaphora run or refrain
- 1: Two of the three device families present
- 0: One or none - the chapter reads as flat exposition

Record `emphasis_repetition: [0|1|2]` in the VOICE AUDIT block. Update `craft_check.DAG-04` to `pass` or `flag` with inline evidence.

**Failure mode:** Flag only. Add to diagnostic report with the missing device(s) and candidate locations.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/dag-craft-rules.md` § DAG-04.

### 2.12 DAG-07 Direct Address Check

**Flag-only LLM pass confirming the preacher-to-reader register.**

**Procedure:**

1. Count "you/your/yourself" in author prose only (exclude scripture blockquote lines). Target: ≥ 8 per 1,000 author-prose words. Use §2.0's deterministic you-density count from `craft_check.DAG-07`.
2. Count imperative commands (sentence-initial verb in base form targeting the reader). Target: ≥ 3 per chapter.
3. Count rhetorical questions (sentences ending `?` in author prose). Target: ≥ 4; ideally 7–15 as in the corpus median. Look for question volleys (3–6 consecutive questions).
4. Check the final paragraph ends with a landing close: a direct command, benediction ("May you..."), prophetic declaration ("I see your ministry..."), prayer (ending "Amen"), exclamation of encouragement, a scripture block, or the final point's stated moral. This is a first-pass check - Pass 2 §3.4 does the formal landing audit.

**Scoring (Direct Address rubric component, 0–2):**
- 2: All four thresholds met; chapter closes with exhortation or benediction energy
- 1: You-density met but commands or questions sparse; or non-cliffhanger flat ending
- 0: Detached register, or ending on a cliffhanger or teaser

Record `direct_address: [0|1|2]` in the VOICE AUDIT block. Update `craft_check.DAG-07` to `pass` or `flag` with inline evidence.

**Failure mode:** Flag only. Add to diagnostic report with specific counts versus thresholds.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/dag-craft-rules.md` § DAG-07.

## 3. Pass 2 -- Self-Contained Chapter Audit: Opener, Landing, and Illustrations

**Purpose:** Verify each chapter's opener conforms to its `opener_type` (DAG-01), its close conforms to DAG-07 (landing, never cliffhanger), and its illustrations satisfy DAG-08. In the DAG teaching style, chapters are SELF-CONTAINED sermon units - no cross-chapter narrative arcs and no forced ending→opening linkage. This pass replaces the narrative-bridging transition pass with an intra-chapter conformance audit.

**Requirement addressed:** EDIT-02 (flow/transitions reinterpreted as intra-chapter integrity)

**Critical rule:** This pass may modify ONLY the chapter opener (to fix opener_type mismatch) and the final paragraph (to replace a cliffhanger with a landing). Never change the body.

**Adjacent chapter check (narrow scope):** Read the previous chapter's opener class - if this chapter and the previous chapter open with the exact same device in identical phrasing (e.g., both quote the exact same scripture as their anchor), flag as an accidental duplicate opener. This is the only cross-chapter comparison in Pass 2.

For each chapter:

### 3.1 Read Chapter Zone

1. Read the chapter from `edited/ch[NN]-pass1.md`
2. Read the chapter's `opener_type`, `list_structure`, `key_statement`, and `testimony_seed` from the outline/Book DNA
3. Read the previous chapter's first 100 words only (from `edited/ch[N-1]-pass1.md`, or skip if first chapter) - solely to detect accidental identical openers in adjacent chapters

### 3.2 Opener Conformance Check (DAG-01)

Confirm the chapter opener matches the outline's `opener_type`:
- **anchor_scripture**: blockquote scripture immediately after the chapter heading, with ≥ 1 ALL-CAPS emphasis phrase, followed by a plain declarative sentence orienting the reader
- **plain_declaration**: flat thesis statement in the first two prose sentences (not a question, not a story, not a list head)
- **definition**: key term defined flatly in the first sentence ("Intimidation is the art of...")

Also confirm the forbidden opener class is absent (story-marker regex - DAG-01; should already be caught in Pass 1 §2.0, but confirm the auto-revise request is in place if fired).

**Adjacent opener dedup:** if this chapter and the previous chapter both open with the same anchor scripture (exact or nearly exact same verse), flag as an accidental duplicate opener - one of them should use a different opener device or a different anchor verse.

### 3.3 Opening Engagement Check (Clarity of Point - opener)

Refine the `clarity_of_point` score based on opener conformance:
- 2 points: opener matches outline's opener_type exactly; theme unmistakable within first two prose sentences
- 1 point: opener class correct but theme is delayed or vague
- 0 points: opener fails DAG-01 (story-marker detected or wrong opener_type)

**Action on mismatch:**
- Story-marker opener: already queued for auto-revise in §2.0
- Non-story opener_type mismatch: **flag** in `craft_pass2.opener_conformance`; carry to §3.5 for revision if the flag warrants a rewrite

### 3.4 Landing Check (DAG-07)

Read the final paragraph of the chapter. It must end with one of:
1. A direct command ("Decide to become an anointed person.")
2. A benediction ("May you walk in power from this day forward!")
3. A prophetic declaration ("I see your ministry growing as you obey these truths.")
4. A prayer (ending "Amen")
5. An exclamation of encouragement ("What a blessing awaits you!")
6. A scripture block
7. The final point's stated moral (aphorism or command)

**Cliffhanger scan** (from §2.0 DAG-07 result and direct text check): banned endings include "in the next chapter", "we will see", "but that is another", a trailing ellipsis (`...`), or a question as the final sentence of the chapter.

**If cliffhanger detected:** Auto-revise the final paragraph. Request the writer replace the last 2–3 sentences with an appropriate landing. Write revision request to `[project_directory]/revisions/ch[NN]-request.md` with `scope: ending`, `failed_check: DAG-07-landing`, and the specific banned pattern in `evidence`.

Also update the `direct_address` rubric component: the landing close is a key factor in scoring 2 vs 1 on this component.

### 3.5 Revise Opener or Landing (If Needed)

If the opener or landing requires revision:
1. **Re-read the voice profile** before rewriting anything. All revisions MUST match the DAG teaching voice.
2. For opener: rewrite to match the outline's `opener_type`, preserving the chapter's core argument and scripture references
3. For landing: rewrite the final paragraph to close with a command, benediction, or stated moral matching the chapter's theme
4. Preserve the core argument - edit structure, not content
5. Do NOT create narrative bridges to the next chapter - the chapter simply stops after the final point lands

### 3.6 Pass 2 Output

Save each chapter to `[project_directory]/edited/ch[NN]-pass2.md`.

If no changes were needed for a chapter, copy the pass1 file as-is to pass2.

**Version stamp:** Pass 2 preserves the two header comments inherited from Pass 1 - line 1 provenance and line 2 `<!-- generated-by: dag-book-crafter v1.1.0 -->`. If either is missing, auto-fix by prepending before writing the pass2 file.

Write `[project_directory]/reports/flow-report.md`. **Prepend `<!-- generated-by: dag-book-crafter v1.1.0 -->` as the first line of `flow-report.md`.**

```markdown
# Flow Report: [Book Title]

| Chapter | Opener Conformance | Landing | Action Taken |
|---------|-------------------|---------|--------------|
| Ch 1    | pass (anchor_scripture) | pass (benediction) | none |
| Ch 2    | flag (plain_declaration vs expected definition) | pass | opener revised |
| Ch 3    | pass | flag - auto-revise queued | landing rewritten |
```

**Pass 2 VOICE AUDIT extension.** For every chapter processed in Pass 2, append a `craft_pass2` block to its `<!-- VOICE AUDIT -->` metadata:

```
craft_pass2:
  opener_conformance: pass | flag (expected: anchor_scripture; found: plain_declaration) | revised
  landing_check: pass | flag (cliffhanger: trailing ellipsis at final paragraph) | revised
  adjacent_opener_dedup: pass | flag (same anchor scripture as ch[N])
  key_statement_audit: pass | flag (missing from chapter text | duplicate: ch[N])
  testimony_seed_audit: pass | flag (missing | fabricated | seed_unresolved) | skipped_no_seed
  reader_situations: pass | flag (count: N; missing: [...]) | skipped_no_section
  illustration_discipline: [0|1|2]
```

The Dag Style Diagnostic step (§4.6) reads both `craft_check` (Pass 1, §2.8) and `craft_pass2` (Pass 2, this block) from each chapter's VOICE AUDIT to build the final per-chapter Dag Style Diagnostic matrix. Do not duplicate the information elsewhere.

### 3.7 Key Statement Audit (DAG-04)

Read the chapter's `key_statement` field from the Book DNA chapter map. Confirm:

1. The key_statement (or a very close paraphrase) appears as a standalone single-sentence paragraph in the chapter body. A standalone key statement is a single-sentence paragraph stating the chapter's core truth as a quotable aphorism.
2. The key_statement is **distinct across all chapters** - scan all other chapters' `key_statement` fields in the Book DNA. If this key_statement is declared in the Book DNA `refrains:` block (as a whole-book refrain with a max_uses budget), its recurrence is permitted within that budget.

**Failure mode:** Flag only. Add to `craft_pass2.key_statement_audit` with evidence (missing, or which chapter duplicates it) and the specific line range checked. Do NOT auto-revise.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/dag-craft-rules.md` § DAG-04.

### 3.8 Testimony Seed Audit (DAG-08)

Read the chapter's `testimony_seed` field from the Book DNA chapter map.

1. **Seed empty or absent:** Note `testimony_seed_audit: skipped_no_seed`. The chapter should use biblical retelling, everyday analogy, or anonymised third-party anecdote only. Scan for first-person testimony openers ("Years ago, I...", "One day, I was..."); if found with no seed, treat as fabricated - hard fail.

2. **Seed present:** Resolve `source_path:line`. Open the source file and read that line. Confirm the line exists and is legible.
   - If path or line does not resolve: flag `testimony_seed_audit: seed_unresolved` with the failing pointer.

3. **Locate testimony:** Search the chapter for first-person testimony (time-marker formula: "Years ago,", "One day,", "When I was...").
   - No first-person testimony found and seed present: note `testimony_seed_audit: skipped_no_seed` - the chapter uses permitted non-testimony illustration types.
   - First-person testimony found but no seed: **Hard fail, auto-revise** - request writer convert to a biblical retelling, everyday analogy, or anonymised third-party anecdote. Write revision request with `scope: illustration`, `failed_check: DAG-08-fabricated`.

4. **Provenance check (if seed present and testimony found):** Confirm the testimony draws on the seed material (shared specific detail, same named context, paraphrased language). If the testimony does not trace to the seed: flag `testimony_seed_audit: fabricated` and queue the same hard-fail auto-revise.

5. **Illustration discipline:** For ALL illustrations in the chapter (types 1–4 per DAG-08):
   - Each ≤ 300 words
   - Each ends with the lesson stated explicitly (command, maxim, or exclamation)
   - No literary scene-setting opener (sensory description for its own sake)

**Scoring (Illustration Discipline rubric component, 0–2):**
- 2: 1–3 illustrations; all within length limit; all with stated morals; all testimony seeded or appropriately non-personal
- 1: Illustration overlong or a moral left implicit; no fabrication
- 0: Zero illustrations in a chapter that needs one, a literary scene-setting opener, or ANY fabricated first-person testimony (also triggers DAG-08 auto-revise)

Record `illustration_discipline: [0|1|2]` in `craft_pass2`.

**Failure mode:** Fabricated testimony = hard fail auto-revise. Missing lesson statement = flag only.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/dag-craft-rules.md` § DAG-08.

### 3.9 Reader Situations Audit

Read the voice profile's `Reader Situations` section (`references/voice-profiles/dag-default.md` § Reader Situations, or the project-specific voice profile's equivalent section).

1. **No section:** Skip and note `reader_situations: skipped_no_section`. No diagnostic report entry needed.
2. **Section present:** Confirm the chapter's application passages land in ≥ 2 of the listed reader situations. LLM judgment: does the "you" address reach a concrete situation from the ministry-and-calling, Christian-living, or warning-situations lists? A paraphrase match is sufficient.
3. If fewer than 2 situations are addressed: flag with count and the missing situation categories.

**Failure mode:** Flag only. Add to `craft_pass2.reader_situations`. Do NOT auto-revise.

## 4. Pass 3 -- Cross-Chapter Validation

**Purpose:** Build indexes across all chapters and validate consistency. This pass reads all chapters but works primarily from extracted indexes, not full text (important for context limits).

**Requirement addressed:** EDIT-04 (cross-chapter validation)

### 4.1 Term Index

Extract key terms and jargon from all chapters (`edited/ch*-pass2.md`). Cross-reference against Book DNA Key Terms section.

Flag:
- Terms used with inconsistent definitions
- Spelling variations (e.g., "anointing" vs "Anointing")
- Capitalisation drift (e.g., "the Spirit" vs "the spirit")
- Terms defined in Book DNA but not introduced before first use

### 4.2 Reference Validation

Find all forward and backward references using pattern matching:
- "as we saw in chapter [N]"
- "later in the book"
- "as we discussed earlier"
- "in the previous chapter"
- "chapter [N]" (general mentions)

For each reference:
- Verify the referenced chapter delivers on the promise
- Flag vague references ("as we saw earlier") and recommend specifying the chapter number
- Flag broken references (pointing to non-existent content)

Note: "in the next chapter" is a banned meta-scaffolding phrase (cliffhanger / teaser) and should have been caught and removed in Pass 2 §3.4. If it appears in the pass2 files, flag it here as a DAG-07 residual fail.

### 4.3 Scripture Consistency

Verse repetition across chapters is **a feature**, not an error. The same proof text functioning as a refrain across chapters is authentic to this teaching style. Do NOT flag repeated scriptures.

**Check instead:**
- **Translation labelling consistency:** KJV is the unlabelled default. Every non-KJV quote must carry its translation label in the reference line (e.g., `> -- Psalm 89:19 (NASB)`). Flag any non-KJV quote that appears without a label.
- **Label consistency:** if the same verse is quoted as NASB in chapter 2 and as NIV in chapter 7, confirm both are labelled; flag if one instance is unlabelled.
- **Permitted back-to-back translations:** quoting the same verse in two translations on the same page is authentic and permitted; both must be labelled if neither is KJV.
- **Wording drift (KJV only):** if the same KJV verse is quoted with slightly different wording in two chapters, flag as a likely transcription error; KJV text should be consistent.

### 4.4 Theme Tracking

Cross-reference against Book DNA Running Themes section:
- Verify each theme is introduced in its designated chapter
- Verify each theme is developed through its designated chapters
- Verify each theme reaches its climax in the designated chapter
- Flag themes that appear to be dropped or never resolved

### 4.4.5 Novelty and Dedup Audit

> Hybrid deterministic + LLM judgment pass. Deterministic script anchors the verdict; LLM judgment layer catches semantic reuse the regex cannot see. Combined verdict: script-fail OR LLM-fail → `novelty_dedup: fail`. Run exactly once per editor invocation - manuscript-level, not per-chapter.

**Exemption list (wider than book-crafter default):** The following are EXEMPT from the 6-word cross-artefact dedup and from the novelty_variation component penalty:
- Scripture blockquotes (any verse, any translation)
- Declared refrains from the Book DNA `refrains:` block within their `max_uses` budget (list stems, key statements, definitions)
- Benediction formulas ("May you...", "I see your ministry...")
- Chapter titles and bold point headings (structural scaffolding, not prose)

Everything outside these exempt classes must not repeat verbatim (6+ words) across artefacts.

**Step A - Deterministic invocation:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js" \
  --novelty \
  --tier both \
  --dna "[project_directory]/book-dna.md" \
  "[project_directory]"
```

Parse the JSON output. Shape:
```
{ mode: "novelty", tier, project_dir, repeated_spans, cross_artefact_hits, refrain_overuse, tier2_hits, flag, novelty_dedup }
```

If `result.flag` is true, Step C must emit a `rewrite_targets` block. Even if `result.flag` is false, continue to Step B.

**Step B - LLM judgment layer:**

Read `front-matter/*.md` and every `edited/ch*-final.md`. For each pair (foreword ↔ chapter, and every chapter pair), judge:

1. **Testimony scene reuse (paraphrase-level):** Does the same *sourced moment* (same person, same remembered setting, same narrative beat) appear in two artefacts, even if exact words differ? (A verse may repeat; a testimony scene may not.)

2. **Illustration vehicle reuse:** For every chapter pair, check illustrations across the manuscript. If the same analogy vehicle is the dominant teaching illustration in two chapters (e.g., an electrical socket analogy used in both ch1 and ch4), flag as illustration/anecdote reuse - a hard fail per DAG-08.

3. **Reader situation reuse in adjacent chapters:** Did chapter N and chapter N+1 both use the same specific reader situation from the voice profile list as their primary application landing? Same-chapter use is fine; adjacent-chapter duplication is a flag.

Emit LLM-judgment flags:
```
llm_flags: [
  { type: "testimony_reuse", source: "front-matter/foreword.md", duplicate: "edited/ch02-final.md", note: "same sourced anecdote paraphrased" },
  { type: "illustration_vehicle_reuse", files: ["edited/ch01-final.md", "edited/ch04-final.md"], note: "electrical socket analogy dominant in both" },
  { type: "reader_situation_reuse_adjacent", files: ["edited/ch02-final.md", "edited/ch03-final.md"], situation: "small-church pastor mocked" }
]
```

**Step C - Combined verdict:**

```
novelty_dedup = (script_flag || llm_flag) ? "fail" : "pass"
```

If `novelty_dedup == "fail"`:
- Populate `novelty_dedup_flags:` with a merged list. Entry types: `repeated_span`, `testimony_reuse`, `illustration_vehicle_reuse`, `reader_situation_reuse_adjacent`, `refrain_overuse`, `tier2_hits`.
- Emit a `rewrite_targets` block into the consistency report AND write to `[project_directory]/reports/rewrite_targets.yaml`.
- Do NOT rewrite any chapter yourself - the orchestrator's Mode 7 `--rewrite-targets` is the only path that re-runs flagged chapters.

**Rewrite targets block format:**

```yaml
rewrite_targets:
  - file: edited/ch02-final.md
    span: "L21-L28"
    reason: "testimony scene reuses the same sourced moment as front-matter/foreword.md:L12-L18 - rewrite using a different testimony_seed detail from voice-profile"
    flagged_by: editor-pass3
  - file: edited/ch04-final.md
    span: "L40-L47"
    reason: "electrical socket analogy is the dominant illustration vehicle in both ch01 and ch04 - substitute with a different everyday analogy"
    flagged_by: editor-pass3
```

Every `reason:` must contain both a source location (file or span reference) and one of "rewrite" / "substitute" / "replace" / "different". Generic reasons are rejected.

`novelty_dedup: fail` is a hard gate. The sample gate reads it and emits `SAMPLE FAIL - novelty_dedup fail: K flags`. There is no soft-warn mode.

### 4.5 Pass 3 Output

Save final edited chapters to `[project_directory]/edited/ch[NN]-final.md`. If no changes were needed in this pass, copy from pass2.

**Version stamp:** Each `edited/ch[NN]-final.md` preserves line 1 provenance and line 2 `<!-- generated-by: dag-book-crafter v1.1.0 -->`. If either is missing, auto-fix before writing.

Write `[project_directory]/reports/consistency-report.md` with this exact structure. **Prepend `<!-- generated-by: dag-book-crafter v1.1.0 -->` as the first line.**

```markdown
# Consistency Report: [Book Title]

**Generated:** [date]
**Chapters analysed:** [N]
**Overall assessment:** [Clean / Minor Issues / Significant Issues]

## Captivation Score

> Single canonical scoring surface per `references/captivation-rubric.md` schema_version: 2. Fields below are machine-readable; the sample gate reads them via column-0 line-anchored bash grep. Do not indent this block. Emit it unconditionally on every editor run.

```yaml
schema_version: 2
captivation_total: <INT 0-16>
novelty_dedup: <pass|fail>
components:
  clarity_of_point: <INT 0-2>
  scripture_saturation: <INT 0-2>
  structural_parallelism: <INT 0-2>
  direct_address: <INT 0-2>
  simplicity: <INT 0-2>
  emphasis_repetition: <INT 0-2>
  illustration_discipline: <INT 0-2>
  novelty_variation: <INT 0-2>
novelty_dedup_flags: []
```

**Field contract:**
- `schema_version: 2` - hard break from v1 shape. Never emit `schema_version: 1`.
- `captivation_total` - sum of all 8 component scores (0–16).
- `novelty_dedup` - binary verdict from §4.4.5. `pass` if zero flags, else `fail`.
- `components` - flat object with exactly 8 keys matching `captivation-rubric.md` `components.*.key` values. Every key MUST be present on every emit, even if 0.
- `novelty_dedup_flags` - array of flag objects when `fail`, else `[]`. Type values: `repeated_span`, `testimony_reuse`, `illustration_vehicle_reuse`, `reader_situation_reuse_adjacent`, `refrain_overuse`, `tier2_hits`.

**Contract for bash grep readers:** All four anchor lines (`schema_version:`, `captivation_total:`, `novelty_dedup:`, `novelty_dedup_flags:`) MUST appear at column 0 of their own line.

## Voice Consistency (Pass 1)

| Chapter | Violations | Avg Sentence Length | Paragraph Flags | Captivation | Severity |
|---------|-----------|--------------------|-----------------:|:-----------:|----------|
| Ch 1    | 0         | 14.2               | 0               | 14/16       | clean    |

### Captivation Score Breakdown

Scoring aggregation and thresholds per `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` § Scoring Aggregation (schema_version: 2, total_range [0, 16], 8 components, novelty_dedup binary dimension).

| Total | Band | Meaning |
|-------|------|---------|
| 0–6   | Below craft floor | Chapter requires revision |
| 7–9   | Weak | Ships only if no hard gates fired |
| 10–12 | Competent | Ships as-is |
| 13–16 | Strong | Authentic Dag-teaching-style quality |

### Flagged Issues
1. **Ch [N], ~line [N]:** "[description]"

## Flow and Transitions (Pass 2)

| Chapter | Opener Conformance | Landing | Action Taken |
|---------|-------------------|---------|--------------|
| Ch 1    | pass (anchor_scripture) | pass (benediction) | none |

## Cross-Chapter Consistency (Pass 3)

### Term Consistency
| Term | Chapters Used | Consistent | Issue |
|------|--------------|------------|-------|

### Reference Validation
| Reference | Source | Target | Validated |
|-----------|--------|--------|-----------|

### Theological Consistency
[Any contradictions between chapters]

### Scripture Consistency
[Translation labelling issues; repeated proof texts are expected and not flagged]

## Dag Style Diagnostic
[Per-chapter DAG-01..09 + version stamp pass/fail matrix appended by §4.6]

## Unresolved Issues (Requires User Decision)
[Issues the editor could not auto-resolve]
```

### 4.6 Dag Style Diagnostic Assembly

After Pass 3 cross-chapter validation completes, assemble the per-chapter Dag Style Diagnostic and append it to `reports/consistency-report.md`. This is the audit deliverable: every DAG-01..09 + version stamp result for every chapter, surfaced at the Stage 4 review gate.

**Step 1 - Re-invoke craft-check.js per chapter.** For each chapter, run the deterministic checker against the edited final file:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js [project_directory]/edited/ch[NN]-final.md
```

Parse the JSON output. The deterministic checks covered: DAG-01 (story-marker + version stamp), DAG-02 (scripture density), DAG-04 (key statement regex + CAPS-in-quote), DAG-05 (word count), DAG-06 (sentence length + hedging), DAG-07 (you-density + imperatives + cliffhanger scan).

**Step 2 - Gather Pass 2 judgment results.** Read each chapter's `<!-- VOICE AUDIT -->` metadata block from `edited/ch[NN]-final.md`. Extract the `craft_pass2:` block (written by Pass 2 §3.6). It supplies judgment results for DAG-03 (structural parallelism from `craft_check.structural_parallelism`), DAG-08 (illustration discipline and testimony seed from `craft_pass2.testimony_seed_audit` and `craft_pass2.illustration_discipline`), opener conformance, and landing check.

**Step 3 - Merge into a per-check matrix.** Status codes:
- `PASS` - all assertions for this check passed.
- `FAIL` - hard-gate failure (DAG-01 story opener, DAG-02 density, DAG-05 overflow, DAG-06 hedging or transliteration overflow, DAG-08 fabricated testimony).
- `FLAG` - flag-only judgment check (DAG-03, DAG-04, DAG-07, DAG-08 missing lesson, opener_type mismatch).
- `SKIP` - prerequisite absent (DAG-03 for flowing chapters, DAG-08 for zero-illustration chapters).

**Step 4 - Append `## Dag Style Diagnostic` to consistency-report.md.** Insert AFTER `## Cross-Chapter Consistency` and BEFORE `## Unresolved Issues`. Per-chapter shape:

```markdown
### Ch N: {title}

| Check | Pass/Fail | Evidence | Line |
|---|---|---|---|
| DAG-01 Verse-or-declaration opener | PASS/FAIL/FLAG | <evidence> | ch{NN}:<line> |
| DAG-02 Scripture density | PASS/FAIL | <evidence> | ch{NN}:<line> |
| DAG-03 Numbered points / parallelism | PASS/FLAG/SKIP | <evidence> | ch{NN}:<range> |
| DAG-04 Key statement / CAPS | PASS/FLAG | <evidence> | ch{NN}:<line> |
| DAG-05 Chapter length | PASS/FAIL | <evidence> | ch{NN}:<line> |
| DAG-06 Plain language | PASS/FAIL | <evidence> | ch{NN}:<line> |
| DAG-07 Direct address / landing | PASS/FLAG | <evidence> | ch{NN}:<line> |
| DAG-08 Functional illustrations | PASS/FAIL/FLAG/SKIP | <evidence> | ch{NN}:<range> |
| Version stamp | PASS/FAIL | <evidence> | ch{NN}:<line> |

**Severity:** <count> flags (judgment-only). Chapter meets/misses hard gates.
```

**Step 5 - Append revision-cap notes** after per-chapter sub-sections:

```
- Chapter N hit the 2-revision cap on [check]. Accepted revision {M} (highest-scoring). Human review recommended at Stage 4.
```

If divergent improvement was detected: `Chapter N: divergent improvement detected at revision {N}. Accepted revision {N-1} (component X dropped from A to B).`

**Step 6 - No auto-revise.** §4.6 is purely an assembly step. Re-invoking `scripts/craft-check.js` here does NOT trigger new revision passes.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/dag-craft-rules.md`

## 5. Rolling Window Pattern (16+ Chapters)

**Requirement addressed:** EDIT-05 (rolling window for large books)

For books with 16 or more chapters, use `chapter-editor` subagents for Pass 1 to avoid context overflow.

### 5.1 Window Composition Per Subagent

Each chapter-editor subagent receives:
- **Current chapter** (full text) -- the focus of editing
- **Previous chapter's final 500 words** (for context) -- or "none" if first chapter
- **Next chapter's first 500 words** (for context) -- or "none" if last chapter
- **Full voice profile** (always included)
- **Full Book DNA** (always included)

### 5.2 Subagent Invocation

Use the `chapter-editor` subagent from `${CLAUDE_PLUGIN_ROOT}/agents/chapter-editor.md`. Each receives:
- Project directory path
- Chapter number to edit
- Edit pass: "voice" (Pass 1 only for subagents)
- Voice profile path: `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/dag-default.md` (or project override)
- Book DNA path: `[project_directory]/book-dna.md`
- Current chapter path: `[project_directory]/drafts/ch[NN]-draft.md`
- Previous chapter overlap (final 500 words of ch[N-1], or "none")
- Next chapter overlap (first 500 words of ch[N+1], or "none")

### 5.3 Parallelisation Rules

- **Pass 1 subagents** can run in parallel -- each chapter is independent for voice checking
- **Pass 2** is ALWAYS handled by the main editor skill sequentially (opener/landing checks need per-chapter outline fields)
- **Pass 3** is ALWAYS handled by the main editor skill (needs cross-chapter indexes built from all chapters)

### 5.4 Collecting Subagent Output

After all Pass 1 subagents complete, verify that each chapter has a corresponding `edited/ch[NN]-pass1.md` file with a `<!-- VOICE AUDIT -->` metadata block. If any subagent failed to produce output, re-run that specific subagent before proceeding to Pass 2.

## 6. Revision Mode

When invoked with mode "revision" and a list of chapter numbers:

### 6.1 Targeted Pass 1

For each chapter to revise:
1. Read the new draft from `drafts/ch[NN]-draft.md`
2. Run the full Pass 1 voice consistency audit (Section 2) on the revised chapter only
3. Save to `edited/ch[NN]-pass1.md` (overwriting the previous pass1 file for this chapter)

### 6.2 Targeted Pass 2

Run Pass 2 (opener/landing/illustration audit) on the revised chapter only. Also check the adjacent chapter opener check (§3.2) against the immediately preceding chapter:
- If revising Chapter N, run the adjacent opener dedup check against ch[N-1]
- Read the neighbour chapter from `edited/ch[N-1]-pass2.md`
- Save updated chapter to `edited/ch[NN]-pass2.md`

**One-hop limit:** Do NOT recursively check beyond immediate neighbours. Flag for the user if significant changes were made to adjacent chapters.

### 6.3 Targeted Pass 3

Run Pass 3 (cross-chapter validation) on affected references only:
- Scan the revised chapter for forward and backward references
- Validate those specific references against the referenced chapters
- Check term consistency for any new terms introduced in the revision
- Check the revised chapter's key_statement is still distinct across all other chapters
- Do NOT rebuild the full cross-chapter index

### 6.4 Update Reports

Update `reports/consistency-report.md` with the revision results:
- Replace the row for the revised chapter in the Voice Consistency table
- Update the revised chapter's row in the Flow table
- Update affected entries in Cross-Chapter Consistency tables

## 7. Output Summary

After all passes complete (or after revision mode completes), return a summary to the orchestrator:

```
Editing complete for [Book Title].
Chapters edited: [N]
Voice consistency: [Clean/Minor/Significant] ([X] issues found, [Y] auto-resolved)
Captivation: avg [X.X]/16 ([N] chapters below threshold 10)
Opener/landing: [X]/[N] conformant
Cross-references: [X] validated, [Y] flagged
Report: [project_directory]/reports/consistency-report.md
```

## 8. Anti-Patterns

- Do NOT edit body text during Pass 2 -- only touch the chapter opener and final paragraph
- Do NOT create narrative bridges between chapters -- chapters are self-contained; do not force ending→opening connections
- Do NOT run passes in parallel -- passes MUST be sequential (Pass 2 needs Pass 1 output, Pass 3 needs Pass 2 output)
- Do NOT overwrite original drafts -- always write to the `edited/` directory
- Do NOT produce subjective voice flags -- every flag must cite a specific rule from the voice profile or dag-craft-rules.md
- Do NOT flag pulpit-seam openers ("You see,", "Notice,", "Listen,") -- they are authentic and permitted (see §2.10)
- Do NOT flag repeated scripture proof texts as dedup failures -- verse repetition is a feature (see §4.3 and §4.4.5)
- Do NOT modify Book DNA, voice-profile.md, chapter-outline.md, or any shared file
- Do NOT spawn subagents from within subagents -- if running as a chapter-editor subagent, work directly
- Do NOT recursively check beyond one hop during revision adjacency checks
- Do NOT run the entire manuscript through all three passes when in revision mode -- only process affected chapters and immediate neighbours
- Do NOT treat Pass 3 findings as auto-fixable -- term inconsistencies and broken references should be flagged for the user, unless the fix is unambiguous (e.g., capitalisation drift)
