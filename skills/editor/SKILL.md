---
name: editor
description: "Audit voice consistency, flow, and transitions across all chapters. Called by the orchestrator during the editing stage of the book pipeline."
user-invocable: false
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Book Editor

Three-pass sequential editing pipeline that transforms individually-written chapter drafts into a cohesive manuscript. Each pass builds on the previous pass's output: voice normalisation first, then flow/transitions, then cross-chapter validation. The result is a manuscript that reads as one voice with seamless transitions and validated cross-references.

## 1. On Invocation

Receive via `$ARGUMENTS`:
- **Project directory path** -- the book project root
- **Edit mode** -- "full" (all three passes on all chapters) or "revision" (targeted re-edit of specific chapters)
- **Chapters to edit** -- (optional, for revision mode only) list of chapter numbers to re-edit

**Step 1: Read Book DNA**

Read `[project_directory]/book-dna.md` for:
- Voice profile summary (tone, sentence rhythm, vocabulary, emphasis techniques)
- Theological/domain framework (the interpretive lens for content decisions)
- Chapter map (chapter positions, connections, momentum positions)
- Running themes (themes to track across chapters)
- Key terms (terminology that must be consistent)
- Cross-chapter continuity notes (callbacks, foreshadowing, running metaphors)

**Step 2: Read Voice Profile**

Read `[project_directory]/voice-profile.md` for detailed voice rules. Pay particular attention to:
- **Tone** -- the overall tonal quality to enforce
- **Sentence Patterns** -- average sentence length target, fragment frequency, rhetorical question usage
- **Vocabulary > Use** -- words and phrases characteristic of this voice
- **Vocabulary > Avoid** -- words and phrases that break this voice (hard constraint)
- **Emphasis Techniques** -- how the voice creates impact
- **Anti-Patterns** -- behaviours that break the voice (hard constraint)
- **Theological Framework** -- (if present) the interpretive lens for theological content

**Step 3: Read Chapter Outline**

Read `[project_directory]/chapter-outline.md` for:
- Total chapter count
- Momentum positions per chapter (Foundation, Building, Accelerating, Climax, Landing)
- Cross-chapter connections specified in the outline

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

**Purpose:** Normalise each chapter's voice against the profile. This pass runs FIRST because subsequent passes need voice-normalised text.

**Requirements addressed:** EDIT-01 (voice consistency), EDIT-03 (theological guardrails), CRAFT-01, CRAFT-02, CRAFT-05, CRAFT-07, CRAFT-15

For each chapter (parallel via subagents if 16+ chapters, sequential otherwise):

### 2.0 Craft Check Invocation (deterministic)

**Run this BEFORE any LLM work on the chapter.** This is the deterministic craft-rule gate for CRAFT-01, CRAFT-02, CRAFT-05, CRAFT-07, and CRAFT-15. LLM judgment sub-sections (§2.9-§2.12) run later in this pass on top of these results.

**Invoke:**

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js [project_directory]/drafts/ch[NN]-draft.md
```

**Parse JSON output.** Schema:

```json
{
  "chapter_id": "ch01",
  "checks": {
    "CRAFT-01": { "pass": true, "evidence": "provenance: sources/sermon-2024-03.md:42", "citations": ["L1"] },
    "CRAFT-02": { "pass": true, "evidence": "2 distinct terms: charis, dunamis", "citations": ["L87", "L112"] },
    "CRAFT-05": { "pass": false, "evidence": "paragraph starts with 'So,'", "citations": ["L134"] },
    "CRAFT-07": { "pass": false, "evidence": "1 reader-thought line", "citations": ["L201"] },
    "CRAFT-15": { "pass": true, "evidence": "version stamp present", "citations": ["L1"] }
  }
}
```

**Merge every check result into the chapter's `<!-- VOICE AUDIT -->` metadata block under a new top-level field `craft_check`** (see §2.8 for the full block shape). Preserve the raw evidence and citations so Pass 2 and the CRAFT-16 diagnostic step can reuse them without re-invoking the script.

**Enforcement policy (per D-06 / D-07 in 10-CONTEXT.md):**

| Check | On fail | Action |
|---|---|---|
| CRAFT-01 | missing/malformed provenance OR unresolvable path | **Auto-revise** — request writer rewrite of the chapter opener only (keep the rest of the draft) |
| CRAFT-02 | distinct transliterated terms > 3 | **Auto-revise** — request writer rewrite to cut terms to ≤3, each with ≥3 unpacking sentences |
| CRAFT-05 | pulpit-seam phrase at chapter or paragraph start | **Auto-revise** — request writer rewrite of the specific paragraph(s) only (run §2.10 LLM override first) |
| CRAFT-07 | <2 italicised/blockquote reader-thought lines | **Flag only** — add to diagnostic report. Do not auto-revise. |
| CRAFT-15 | missing `<!-- generated-by: dag-book-crafter vX.Y.Z -->` stamp | **Auto-fix** — prepend the stamp to the chapter (do not round-trip to writer) |

**Revision request contract:** when auto-revising, write the writer instruction to `[project_directory]/revisions/ch[NN]-request.md` with fields `reason`, `failed_check`, `scope` (opener / paragraph-range / full-chapter), `evidence`, `citations`. The orchestrator (Plan 10-09, CRAFT-17) routes the request to the writer.

**Revision cap:** All revision requests respect the 2-revision-per-chapter cap wired in Plan 10-09 (CRAFT-17). On exhaustion, keep the highest-scoring revision by captivation rubric total, append a flag to the diagnostic report with line citations, and continue — do not halt the pipeline.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` — CRAFT-01, CRAFT-02, CRAFT-05, CRAFT-07, CRAFT-15.

### 2.1 Vocabulary Audit

Scan the full chapter text for words and phrases from the voice profile's Avoid list. Use case-insensitive matching.

Flag every occurrence with:
- Approximate line location
- The specific phrase found
- Which Avoid rule it violates

**Common Avoid-list patterns for spiritual-default voice:**
- Academic hedging: "some scholars believe", "it could possibly mean", "there is a view that"
- Religious cliches: "God won't give you more than you can handle", "everything happens for a reason"
- Filler phrases: "In conclusion", "Furthermore", "It is important to note that"
- Passive voice: any sentence where active voice is possible
- Em dashes: replace with regular hyphens with spaces or restructure the sentence

### 2.2 Sentence Length Distribution

Count words per sentence (split on `.`, `!`, `?` boundaries). Calculate:
- **Average sentence length** across the chapter
- **Fragment percentage** -- sentences with 8 or fewer words as a percentage of all sentences

Compare against voice profile targets:
- Target average: 12-18 words (for spiritual-default)
- Frequent shorter fragments: 3-8 words

Flag chapters whose average sentence length deviates by more than 4 words from the profile target range (i.e., average below 8 or above 22 for spiritual-default).

### 2.3 Anti-Pattern Detection

Check for each anti-pattern listed in the voice profile's Anti-Patterns section AND the Theological Framework section (for theological books).

**Specific checks for spiritual-default:**

| Anti-Pattern | Detection | Example |
|-------------|-----------|---------|
| Academic hedging | Phrases that qualify or soften claims unnecessarily | "some scholars believe", "it could possibly mean", "there is a view that", "it is important to note" |
| Religious cliches | Overused phrases that lack depth | "God won't give you more than you can handle", "everything happens for a reason", "let go and let God" |
| Passive voice | Sentences where the subject receives the action | "was established by God" instead of "God established" |
| Performance-based guilt | Language that places the burden on human effort | "you need to pray more", "you should be doing", "if you just had enough faith" |
| Cessationist framing | Implying spiritual gifts have ceased | "in Bible times", "gifts were for the early church", "those things don't happen anymore" |
| AI voice indicators | Overly balanced, hedged, or neutral tone | "various perspectives", "many Christians believe", "some would argue", "it's important to consider" |
| Surface-level observations | Stating what a verse says without uncovering deeper meaning | Simply restating the verse text without word studies, cross-references, or revelation |

For non-theological voice profiles, skip the theological-specific patterns (performance-based guilt, cessationist framing) and check only the patterns listed in that profile's Anti-Patterns section.

### 2.4 Pacing Variety Score

Apply the Pacing Variety check as defined in `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` (Components → Pacing Variety).

### 2.5 Emotional Connection Audit

Apply the Emotional Connection check as defined in `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` (Components → Emotional Connection).

### 2.5.5 Reader Engagement Scoring

Apply the Reader Engagement check as defined in `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` (Components → Reader Engagement).

### 2.6 Tone Normalisation

For each flagged passage:
1. Rewrite to match the voice profile while preserving the argument and scripture references
2. Replace Avoid-list vocabulary with Use-list alternatives
3. Convert passive voice to active voice
4. Sharpen hedged language into direct declarations
5. Maintain the original meaning -- change the voice, not the content

### 2.7 Theological Guardrail Check

If the voice profile contains a Theological Framework section, validate each chapter against it:

- **Grace over Law:** Flag content that frames the Christian life as performance-based
- **Identity in Christ:** Flag content that defines the believer by behaviour rather than position
- **New Covenant lens:** Flag content that treats the Cross as the beginning of a process rather than a finished work
- **Authority of the believer:** Flag content that positions believers as begging rather than seated with Christ
- **Kingdom as present reality:** Flag content that relegates Kingdom power to the future only
- **Sonship over servanthood:** Flag content that positions believers as anxious servants rather than confident sons
- **Supernatural is active today:** Flag cessationist framing
- **Scripture is inerrant:** Flag content that suggests biblical contradictions rather than puzzles to solve

For non-theological books, skip this sub-check entirely.

### 2.8 Pass 1 Output

Save each edited chapter to `[project_directory]/edited/ch[NN]-pass1.md` with the voice audit metadata block appended at the end.

**Version stamp:** Every pass1 chapter file inherits its first two lines from the writer's draft — line 1 is `<!-- provenance: {source_path}:{line} -->` and line 2 is `<!-- generated-by: dag-book-crafter v1.1.0 -->`. Preserve both lines exactly. If either is missing when the editor reads the draft, prepend it before writing the pass1 file (the `<!-- generated-by: dag-book-crafter v1.1.0 -->` stamp must occupy line 2, immediately beneath the provenance comment). CRAFT-15 auto-fix is performed here, not rounded-tripped to the writer.

Chapter file structure emitted by Pass 1:

```markdown
<!-- VOICE AUDIT
chapter: [N]
vocabulary_violations: [count]
  - Line ~[N]: "[phrase]" ([Avoid rule])
avg_sentence_length: [number]
fragment_percentage: [number]%
anti_patterns_found:
  - Line ~[N]: [description] ([pattern name])
theological_flags: [list or "none"]
pacing_variety: [score 0-2, with dominant category and percentage]
emotional_connection: [present|absent, with markers found or "none"]
captivation_score: [1-10]
craft_check:
  CRAFT-01: pass
  CRAFT-02: pass (2 distinct terms: charis, dunamis; unpacking OK)
  CRAFT-05: pass
  CRAFT-07: fail (1 reader-thought line; flagged)
  CRAFT-15: pass
  CRAFT-08: fail (window p12-p15 ratio 0.6; flagged)
changes_made: [count]
severity: clean | minor | significant
-->
```

The `craft_check` field aggregates the deterministic results from §2.0 (craft-check.js) PLUS the LLM judgment results from §2.9-§2.12. Each entry is `pass` or `fail` followed by inline evidence. Pass 2 and the CRAFT-16 diagnostic step read this block directly — do not duplicate the information elsewhere in the chapter.

**Severity scale:**
- **clean** -- 0 violations, sentence length within range, no anti-patterns, captivation score 5+
- **minor** -- 1-3 total issues (vocabulary + anti-patterns), sentence length within range, captivation score 5+
- **significant** -- 4+ total issues, OR sentence length outside range, OR theological flags present, OR captivation score below 4, OR any auto-revise-class craft_check failure (CRAFT-01/02/05) not overridden by §2.10

### 2.9 Craft Density Check (CRAFT-02 unpacking adequacy)

**LLM judgment layered on top of §2.0's deterministic CRAFT-02 result.** craft-check.js has already confirmed distinct transliterated-term count is ≤3 (or auto-revise was triggered). This sub-section performs the judgment the script cannot: for each transliterated term used, confirm the next 3 sentences after its introduction actually *unpack* it with explanatory context — meaning, etymology, or concrete illustration — not just mention the term in passing.

**Procedure:**

1. Re-read the citation lines from `craft_check.CRAFT-02.citations` in the VOICE AUDIT block (these mark the term-introduction lines).
2. For each term, read the 3 sentences that follow and judge whether the term is genuinely unpacked. Indicators of real unpacking: a literal meaning ("charis literally means the joy of a received gift"), an etymology pointer ("from the same root as…"), or a concrete illustration that lands the idea in a scene or image.
3. Indicators of failure: the term is dropped without explanation, the 3 sentences rephrase the surrounding argument without defining the term, or the "unpacking" is another abstract synonym ("charis, which is God's grace").

**Failure mode:** Flag only. Add to the chapter's diagnostic report entry with the term, the line range, and a one-sentence note on what is missing. Update `craft_check.CRAFT-02` in the VOICE AUDIT block from `pass` to `pass (unpacking flagged: <term>)` so Pass 2 and CRAFT-16 see the nuance. Do NOT auto-revise — LLM judgment on unpacking quality is advisory per D-07 (forcing rewrites on judgment calls risks divergent-improvement regression).

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-02.

### 2.10 Pulpit Seam Detection (CRAFT-05 override pass)

**LLM counterpart to craft-check.js's deterministic regex.** §2.0's craft-check.js has already flagged any paragraph whose first word(s) match the CRAFT-05 banned-start regex. This sub-section reviews each flagged paragraph against the **permitted-usage counter-example list** in `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-05 and either confirms the fail or overrides it to a pass.

**Permitted-usage whitelist (do not flag):**

1. **Dialogue/quotation** -- the paragraph begins with a quoted speaker using the phrase (e.g. `"So," she said, "what do we do?"`).
2. **Explicit block quote** -- markdown blockquote paragraph where the phrase appears after `>`.
3. **Song/scripture citation lines** -- the paragraph is a direct citation, not exposition.
4. **Deliberate fragment used as a titled section** -- the paragraph is itself a heading or heading-like title (the checker skips headings, but a subtitle-as-first-word can still slip through).
5. **Second-person narration inside a remembered scene** -- e.g. "You see the light change" as a lived moment, not a sermon address.

**Procedure:**

1. Read each line in `craft_check.CRAFT-05.citations`.
2. For each flagged paragraph, evaluate whether it matches any of the permitted-usage cases above.
3. **If permitted usage applies:** override the craft-check fail to a pass. Note the override in the VOICE AUDIT block as `craft_check.CRAFT-05: pass (overridden at L<line>: <whitelist case>)` so the override is visible to Pass 2 and CRAFT-16. Cancel any auto-revise request queued by §2.0 for that paragraph.
4. **If permitted usage does NOT apply:** confirm the fail. Leave the §2.0 auto-revise request in place -- writer will rewrite that paragraph only, per D-06 (scope: paragraph; if structural, full chapter).

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-05.

### 2.11 Tension-Release Enforcement (CRAFT-07)

**Flag-only LLM pass layered on §2.0's deterministic regex count.** craft-check.js counts italicised or blockquote-wrapped reader-thought lines using the CRAFT-07 regex. If the count is <2, raise a flag; do not auto-revise (per D-07).

**Procedure:**

1. Read `craft_check.CRAFT-07.evidence` for the count and `citations` for any found lines.
2. If the count is ≥2: no action.
3. If the count is <2: append to the chapter's diagnostic report entry: "Chapter N has only X reader-thought lines; expected ≥2." Include the existing line citations (if any) for context.
4. Optionally, note 2-3 candidate insertion points in the VOICE AUDIT block under `craft_check.CRAFT-07.candidate_points` -- paragraphs where a psychological-tension line would land naturally (moments of unresolved question, emotional pivot, or reader-doubt). These suggestions are consumed by Pass 2 rewrite windows only if a Pass 2 transition rewrite touches that region anyway -- do NOT insert reader-thought lines in Pass 1.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-07.

### 2.12 Show-Don't-Tell Audit (CRAFT-08)

**Pure LLM judgment -- craft-check.js does NOT evaluate CRAFT-08.** Over a sliding window of 4 paragraphs, the concrete-to-abstract noun ratio must be ≥1:1. The goal is to catch stretches where the chapter drifts into sermon abstraction without a sensory anchor.

**Procedure:**

1. Slide a 4-paragraph window through the chapter (paragraphs 1-4, 2-5, 3-6, …).
2. In each window, count:
   - **Concrete nouns** -- physical objects, named people, named places, sensory words. Hint lexicon from bestseller-craft-rules.md § CRAFT-08: *chair, coffee, phone, car, door, hospital, kitchen, window, table, street, bed, room, cup, hand, face, eye, voice, book, letter, rain, sunlight*.
   - **Abstract nouns** -- theological or conceptual nouns with no physical referent. Hint lexicon: *grace, identity, righteousness, sonship, authority, kingdom, glory, anointing, faith, hope, love, peace, joy, salvation, redemption, sanctification, justification, mercy*.
3. Compute the concrete:abstract ratio for each window.
4. Any window where the ratio is <1:1 (abstract outnumbers concrete) is flagged with its paragraph range and the computed ratio.

**Failure mode:** **Flag only.** Do not auto-revise. Add to the chapter's diagnostic report entry: "Chapter N, paragraphs P-P+3: concrete:abstract ratio <ratio> -- too abstract." Update `craft_check.CRAFT-08` in the VOICE AUDIT block to `fail (<N> windows flagged)` with the worst-offending window cited inline.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-08.

## 3. Pass 2 -- Flow and Transitions

**Purpose:** Ensure every chapter ending connects naturally to the next chapter opening. This pass is ALWAYS sequential because each transition depends on both chapters.

**Requirement addressed:** EDIT-02 (flow/transitions)

**Critical rule:** This pass ONLY modifies the final 2-3 paragraphs of the current chapter and the first 2-3 paragraphs of the next chapter. Never change the body.

For each consecutive chapter pair (Ch1->Ch2, Ch2->Ch3, ...):

### 3.1 Read Transition Zone

1. Read the final 2-3 paragraphs of Chapter N from `edited/ch[NN]-pass1.md`
2. Read the first 2-3 paragraphs of Chapter N+1 from `edited/ch[N+1]-pass1.md`
3. Read both chapters' momentum positions from the outline

### 3.2 Evaluate Transition Quality

Check:
- Does the ending of Chapter N plant a seed that the opening of Chapter N+1 picks up?
- Does the momentum position shift feel right?
  - Foundation -> Building = escalation (deepening, not topic change)
  - Building -> Accelerating = intensification (arguments gaining force)
  - Accelerating -> Climax = convergence (everything coming together)
  - Climax -> Landing = resolution (practical application, send-off)
- Is there a natural bridge or does the reader feel a jarring disconnect?

### 3.3 Opening Engagement Check

Apply the Opening Engagement check as defined in `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` (Components → Opening Engagement).

**Scene-First Strictness (CRAFT-01 quality)**

`scripts/craft-check.js` has already verified the provenance comment exists and resolves (Pass 1 §2.0). In Pass 2, the editor performs LLM judgment on scene quality in the first 150 words of the chapter. Count words (whitespace-split) up to 150, then confirm ALL of:

1. A proper-noun human OR first-person narrator ("I", "me", "my") is present by word 150.
2. A time-marker phrase is present (examples: "at 2am", "last Tuesday", "the summer I was fourteen", "when I was eight", "three years ago").
3. A sensory or physical detail is present — light ("sunlight", "streetlight", "dim", "bright"), sound ("hum", "click", "silence", "rustle"), texture ("cold", "damp", "rough"), smell ("coffee", "rain", "smoke"), or a specifically named concrete object ("chair", "phone", "coffee cup", "window", "door", "car").

If any of (1)(2)(3) is missing, trigger auto-revise of the chapter opener only (per D-06): request the writer rewrite the first paragraph(s) up to 150 words to include the missing element, while preserving the provenance comment and the rest of the chapter. Write the revision request to `[project_directory]/revisions/ch[NN]-request.md` with `scope: opener`, `failed_check: CRAFT-01-scene-quality`, and the specific missing element(s) in `evidence`.

The 2-revision-per-chapter cap (CRAFT-17, wired in Plan 10-09) still applies. On exhaustion, keep the highest-scoring revision by captivation rubric total, flag the missing scene element in the diagnostic report, and continue.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-01.

### 3.4 Chapter-Ending Momentum Check

Apply the Chapter-Ending Momentum check as defined in `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` (Components → Chapter-Ending Momentum).

### 3.5 Rewrite Transitions (If Needed)

If the transition is jarring:
1. **Re-read the voice profile** before rewriting any text. Transition rewrites MUST match the voice.
2. Rewrite the chapter ending and/or opening to create a bridge
3. Preserve the core argument of both chapters
4. Only modify transitional language -- do not alter the substance of arguments

### 3.6 Pass 2 Output

Save each chapter to `[project_directory]/edited/ch[NN]-pass2.md`.

If no changes were needed for a chapter, copy the pass1 file as-is to pass2.

**Version stamp:** Pass 2 preserves the two header comments inherited from Pass 1 — line 1 provenance and line 2 `<!-- generated-by: dag-book-crafter v1.1.0 -->`. If either is missing when Pass 2 reads the pass1 file (e.g. because of an out-of-band edit), auto-fix by prepending the version stamp as line 2 (or line 1 if no provenance comment is present) before writing the pass2 file.

Write `[project_directory]/reports/flow-report.md`. **Prepend `<!-- generated-by: dag-book-crafter v1.1.0 -->` as the first line of `flow-report.md`** (line 1, above the `# Flow Report` heading). The flow report has no provenance comment, so the version stamp occupies line 1.

```markdown
# Flow Report: [Book Title]

| Transition | Status | Action Taken |
|-----------|--------|--------------|
| Ch 1 -> Ch 2 | smooth | none |
| Ch 2 -> Ch 3 | jarring | rewrote Ch 2 ending to bridge to Ch 3's argument |
```

**Pass 2 VOICE AUDIT extension.** For every chapter processed in Pass 2, append a `craft_pass2` block to its `<!-- VOICE AUDIT -->` metadata aggregating the §3.3 scene-first strictness result and the §3.7/§3.8/§3.9 audit results:

```
craft_pass2:
  central_image: pass | flag (zones missing: [opening | middle | closing])
  vulnerability_beat: pass | flag (missing | fabricated | seed_unresolved) | skipped_no_seed
  reader_moments: pass | flag (count: N; missing: [...]) | skipped_no_section
  scene_first_strictness: pass | revised
```

The CRAFT-16 diagnostic step (Plan 10-09) reads both `craft_check` (Pass 1, §2.8) and `craft_pass2` (Pass 2, this block) from each chapter's VOICE AUDIT to build the final per-chapter Bestseller Diagnostic matrix. Do not duplicate the information elsewhere.

### 3.7 Central Image Audit (CRAFT-03)

Read the chapter's `central_image` field from the outline (`chapter-outline.md`) and/or Book DNA (`book-dna.md`). Locate three zones in the chapter:

- **Opening:** first 200 words
- **Middle third:** from word `floor(total_words / 3)` through word `floor(2 * total_words / 3)` (word-count-based, not paragraph-count-based)
- **Closing:** final 200 words

Confirm the central image — or a semantically equivalent reference to it — appears in ALL THREE zones. Different registers are fine and expected: literal in the opening (the physical object), metaphor in the middle (the idea carried by the object), echo in the closing (a callback phrase or sensory repeat).

**Failure mode:** **Flag only** (per D-07). Add to the chapter's diagnostic report entry with the zones the image was missing from and the line ranges checked. Update `craft_pass2.central_image` in the VOICE AUDIT block from `pass` to `flag (zones missing: [...])`. Do NOT auto-revise — forcing rewrites here causes divergent-improvement failures (see 10-RESEARCH § Pitfall 4).

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-03.

### 3.8 Vulnerability Beat Audit (CRAFT-04)

Read the chapter's `vulnerability_beat_seed` field from the outline and/or Book DNA.

1. **Seed empty:** If the seed field is absent or empty, skip this audit and note `vulnerability_beat: skipped_no_seed` in `craft_pass2` of the VOICE AUDIT block. No diagnostic report entry needed beyond the skip marker.
2. **Seed present:** Resolve the seed pointer. `vulnerability_beat_seed` uses the same path:line syntax as provenance comments (D-19). Parse `source_path:line`, read the file, confirm the line exists.
   - If the path or line does not resolve, flag `vulnerability_beat: seed_unresolved` with the failing pointer in the diagnostic report entry.
3. **Locate the beat:** Search the chapter's middle third (per §3.7 word-count-based zone definition) for a first-person vulnerability beat — a named confession, doubt, or struggle in the narrator's voice ("I", "me", "my").
   - If no first-person beat is present in the middle third, flag `vulnerability_beat: missing`.
4. **Authenticity judgment:** If a beat is present, confirm it references or paraphrases the seed material. LLM judgment: does the beat traceably draw on the seed (shared specific detail, same named person/place/moment, paraphrased language), or does it appear fabricated (unrelated to the seed, generic confession, no shared detail)?
   - If the beat does not trace to the seed, flag `vulnerability_beat: fabricated`.

**Failure mode:** **Flag only.** Fabricated beats are the most serious flag but still flag-only, not auto-revise, because auto-revise on judgment checks risks divergent improvement (D-07 rationale and Pitfall 5: forcing a rewrite loops back to fabrication). Update `craft_pass2.vulnerability_beat` in the VOICE AUDIT block accordingly and add the specific flag to the chapter's diagnostic report entry with line citations and, for `fabricated`, a one-sentence note on why the beat does not trace to the seed.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-04.

### 3.9 Reader Moment Audit (CRAFT-06)

Read the voice profile's `Reader Moments` section (from `[project_directory]/voice-profile.md`).

1. **No section:** If the voice profile has no `Reader Moments` section, skip this audit and note `reader_moments: skipped_no_section` in `craft_pass2` of the VOICE AUDIT block (per D-16 — user-supplied custom profiles may omit the section). No diagnostic report entry needed beyond the skip marker.
2. **Section present:** Read the chapter's METADATA `reader_moments_used` field (written by the writer at draft time). Confirm ALL of:
   - **(a)** At least 2 moments are claimed in `reader_moments_used`.
   - **(b)** Each claimed moment actually appears in the chapter text (grep the chapter body for the moment phrase or a close paraphrase — LLM judgment on paraphrase equivalence).
   - **(c)** Each claimed moment is one of the moments listed in the voice profile's `Reader Moments` section (not an invented moment the writer made up mid-draft).
3. If any of (a)(b)(c) fails, record the specific failure:
   - Too few claimed: `flag (count: N < 2)`
   - Claimed but missing from text: `flag (missing: [moment names])`
   - Not in voice profile list: `flag (unlisted: [moment names])`

**Failure mode:** **Flag only.** Add to the chapter's diagnostic report entry with the count and list of missing/extra moments. Update `craft_pass2.reader_moments` in the VOICE AUDIT block accordingly. Do NOT auto-revise.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-06.

## 4. Pass 3 -- Cross-Chapter Validation

**Purpose:** Build indexes across all chapters and validate consistency. This pass reads all chapters but works primarily from extracted indexes, not full text (important for context limits).

**Requirement addressed:** EDIT-04 (cross-chapter validation)

### 4.1 Term Index

Extract key terms and jargon from all chapters (`edited/ch*-pass2.md`). Cross-reference against Book DNA Key Terms section.

Flag:
- Terms used with inconsistent definitions
- Spelling variations (e.g., "sonship" vs "Sonship")
- Capitalisation drift (e.g., "Kingdom authority" vs "kingdom authority")
- Terms defined in Book DNA but not introduced before first use

### 4.2 Reference Validation

Find all forward and backward references using pattern matching:
- "we'll explore this in chapter [N]"
- "as we saw in chapter [N]"
- "later in the book"
- "as we discussed earlier"
- "in the next chapter"
- "in the previous chapter"
- "chapter [N]" (general mentions)

For each reference:
- Verify the referenced chapter delivers on the promise
- Flag vague references ("as we saw earlier") and recommend specifying the chapter number
- Flag broken references (pointing to non-existent content)

### 4.3 Scripture Consistency

For theological books:
- Verify the same scripture passage is not quoted with different wording in different chapters
- All quotes should use the same translation (default NKJV per the voice profile's Scripture Handling section)
- Flag translation mismatches

### 4.4 Theme Tracking

Cross-reference against Book DNA Running Themes section:
- Verify each theme is introduced in its designated chapter
- Verify each theme is developed through its designated chapters
- Verify each theme reaches its climax in the designated chapter
- Flag themes that appear to be dropped or never resolved

### 4.4.5 Novelty and Dedup Audit

> Hybrid deterministic + LLM judgment pass. Follows the CRAFT-02/05/07 layering pattern (§2.0 → §2.9-§2.12 verbatim shape): deterministic script anchors the verdict, LLM judgment layer catches paraphrase and semantic reuse the regex can't see. Combined verdict: script-fail OR LLM-fail → `novelty_dedup: fail`. This section is the editor's structural fix for the repetition blindspot that triggered Phase 13.

**Scope:** `front-matter/*.md` + `edited/ch*-final.md` (Tier 1) AND `enrichments/*.md` / `enriched/*.md` (Tier 2). Both tiers feed the same `novelty_dedup` verdict. Run this audit exactly once per editor invocation — it is manuscript-level, not per-chapter.

**Step A — Deterministic invocation:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js" \
  --novelty \
  --tier both \
  --dna "[project_directory]/book-dna.md" \
  "[project_directory]"
```

Parse the JSON output. The shape is:
```
{ mode: "novelty", tier, project_dir, repeated_spans, cross_artefact_hits, central_image_reuse, refrain_overuse, tier2_hits, flag, novelty_dedup }
```

If `result.flag` is true, Step C must emit a `rewrite_targets` block per D-12. Even if `result.flag` is false, continue to Step B — the LLM judgment layer can still fail the chapter for semantic reuse the script could not catch.

**Step B — LLM judgment layer (editor reads manuscript directly):**

Read `front-matter/*.md` and every `edited/ch*-final.md` in the project directory. For each pair (foreword ↔ chapter, and every chapter pair), judge:

1. **Vulnerability-beat scene reuse (paraphrase-level):** Does the same *named moment* (same person, same remembered setting, same emotional beat) appear in two artefacts, even if the exact words differ? Example: foreword describes "standing at the kitchen counter at 3am with hands flat on the wood and nothing to say" and chapter 2 describes "I was at the counter, palms down, silent." These are the SAME SCENE in different phrasing — the deterministic 6-word shingler cannot see this, but a reader does.

2. **Central-image vehicle semantic collision:** For every chapter pair, read the opening 200 words, middle third, and closing 200 words (already extracted in Pass 2 §3.7). Judge whether the DOMINANT vehicle is the same even if the `central_image` field values differ. Example: ch1 declares `unlit bedside lamp` and ch3 declares `reading lamp on the nightstand`. Both render as "a lamp on a table in the dark" — same vehicle family, flag.

3. **Reader-moment reuse in adjacent chapters:** Did chapter N and chapter N+1 both use the same sourced reader moment (e.g. "the 2am phone-check")? Same-chapter reuse is legitimate; adjacent-chapter reuse is a flag.

Emit LLM-judgment flags as a parallel array:
```
llm_flags: [
  { type: "vulnerability_beat_scene_reuse", source: "front-matter/foreword.md", duplicate: "edited/ch02-final.md", note: "same 3am kitchen counter scene, paraphrased" },
  { type: "central_image_semantic_collision", files: ["edited/ch01-final.md", "edited/ch03-final.md"], note: "both render as a lamp on a table" },
  { type: "reader_moment_reuse_adjacent", files: ["edited/ch02-final.md", "edited/ch03-final.md"], moment: "the 2am phone-check" }
]
```

**Step C — Combined verdict and emit:**

Let `script_flag = result.flag`, `llm_flag = llm_flags.length > 0`. The verdict is:
```
novelty_dedup = (script_flag || llm_flag) ? "fail" : "pass"
```

**If `novelty_dedup == "pass"`:**
- Set `novelty_dedup_flags: []` in the `## Captivation Score` YAML block (see §504 template).
- Do not emit `rewrite_targets`.
- Continue to §4.5.

**If `novelty_dedup == "fail"`:**
- Populate `novelty_dedup_flags:` in the `## Captivation Score` YAML block with a merged list of script flags (from `repeated_spans`, `cross_artefact_hits`, `central_image_reuse`, `refrain_overuse`, `tier2_hits`) and LLM flags (from Step B). Each entry shape: `{file, type, note}`.
- Emit a `rewrite_targets` block into the consistency report, AND write the same block to `[project_directory]/reports/rewrite_targets.yaml` as a separate file (Research Open Q 2 — both inline for human review at the Stage 4 review gate AND separate file for Mode 7 machine consumption).
- Do NOT rewrite any chapter yourself. The editor is a judge, not an author (D-10). The orchestrator's Mode 7 `--rewrite-targets` (§skills/orchestrator/SKILL.md Mode 7) is the only path that re-runs flagged chapters.

**Rewrite targets block format (emit into consistency-report.md under the `## Rewrite Targets` heading, AND mirror into reports/rewrite_targets.yaml):**

```yaml
rewrite_targets:
  - file: edited/ch02-final.md
    span: "L21-L28"
    reason: "verbatim overlap with front-matter/foreword.md:L12-L18 — rewrite the vulnerability beat using a different sourced detail from the author notes at voice-profile.md:45"
    flagged_by: craft-check
  - file: edited/ch03-final.md
    span: "L40-L47"
    reason: "same central-image vehicle ('reading lamp') dominates ch01 and ch03 — substitute with a distinct vehicle from the motif family (grey seam of dawn per brief.md:37)"
    flagged_by: editor-pass3
```

**Mandatory `reason:` field contract (D-12):** every target MUST include a specific cross-reference to the duplicated location AND a directional instruction. Generic reasons like "too similar" or "rewrite this" are REJECTED — the orchestrator's Mode 7 will refuse to run if a target's reason does not contain both a source location (file or span reference) and the words "rewrite" / "substitute" / "replace" / "different".

`flagged_by:` must be one of `craft-check` (deterministic flag from Step A) or `editor-pass3` (LLM judgment flag from Step B).

**Hard-fail semantics (D-10):** `novelty_dedup: fail` is not a warning. It is a hard gate. The consistency report emits it, the sample skill's gate reads it and emits `SAMPLE FAIL — novelty_dedup fail: K flags`, and release.sh (when wired in Phase 12 or later) will refuse to build a release zip. There is no `--strict` override, no soft-warn mode, no "ship anyway" escape hatch. The phase 13 premise is that soft gates become invisible.

### 4.5 Pass 3 Output

Save final edited chapters to `[project_directory]/edited/ch[NN]-final.md`. If no changes were needed for a chapter in this pass, copy from pass2.

**Version stamp:** Each `edited/ch[NN]-final.md` preserves the two header comments inherited from Pass 2 — line 1 provenance and line 2 `<!-- generated-by: dag-book-crafter v1.1.0 -->`. If either is missing, auto-fix in place by prepending the missing comment(s) before writing the final file. The version stamp must end up as line 2 (or line 1 if the chapter truly has no provenance comment, which is itself a CRAFT-01 fail flagged in the VOICE AUDIT).

Write `[project_directory]/reports/consistency-report.md` with this exact structure. **Prepend `<!-- generated-by: dag-book-crafter v1.1.0 -->` as the first line of `consistency-report.md`** (line 1, above the `# Consistency Report` heading). The consistency report has no provenance comment, so the version stamp occupies line 1.

```markdown
# Consistency Report: [Book Title]

**Generated:** [date]
**Chapters analysed:** [N]
**Overall assessment:** [Clean / Minor Issues / Significant Issues]

## Captivation Score

> Single canonical scoring surface per `references/captivation-rubric.md` schema_version: 2. Fields below are machine-readable; the sample gate and release.sh read them via column-0 line-anchored bash grep. Do not indent this block. Do not wrap it in a collapsible or conditional. Emit it unconditionally on every editor run.

```yaml
schema_version: 2
captivation_total: <INT 0-16>
novelty_dedup: <pass|fail>
components:
  pacing_variety: <INT 0-2>
  emotional_connection: <INT 0-2>
  reader_engagement: <INT 0-2>
  opening_engagement: <INT 0-2>
  chapter_ending_momentum: <INT 0-2>
  craft_density: <INT 0-2>
  cross_chapter_craft: <INT 0-2>
  novelty_variation: <INT 0-2>
novelty_dedup_flags: []
```

**Field contract:**
- `schema_version: 2` — hard break from Phase 7/10/11 v1 shape. Never emit `schema_version: 1`.
- `captivation_total` — sum of all 8 component scores, clamped to [0, 16].
- `novelty_dedup` — binary verdict from §4.4.5 Novelty and Dedup Audit. `pass` if the hybrid deterministic + LLM judgment pass finds zero flags, else `fail`.
- `components` — flat object with exactly 8 keys matching the rubric frontmatter `components.*.key` values. Every key MUST be present on every emit, even if 0.
- `novelty_dedup_flags` — array of flag objects when `novelty_dedup: fail`, else empty array `[]`. Each entry shape: `{file, type, note}`. Type is one of: `repeated_span`, `vulnerability_beat_reuse`, `central_image_reuse`, `refrain_overuse`, `tier2_discussion_stem`, `tier2_prayer_point`, `tier2_vulnerability_bleed`, `tier2_vehicle_backmatter`.

**Contract for bash grep readers:** All four anchor lines (`schema_version:`, `captivation_total:`, `novelty_dedup:`, `novelty_dedup_flags:`) MUST appear at column 0 of their own line. The fenced ```yaml block does not interfere with `grep -E '^captivation_total:'` because the fence characters are on their own lines.

## Voice Consistency (Pass 1)

| Chapter | Violations | Avg Sentence Length | Fragment % | Captivation | Severity |
|---------|-----------|--------------------|-----------:|:-----------:|----------|
| Ch 1    | 0         | 15.2               | 22%        | 14/16       | clean    |

### Captivation Score Breakdown

Scoring aggregation and thresholds per `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` § Scoring Aggregation.

**Schema v2 canonicalisation (Phase 13):** The YAML block at `## Captivation Score` above is the single machine-readable surface for `skills/sample/SKILL.md §4` and any future release.sh gate. Prose references to `N/10` or `N/14` in this report are legacy and will be removed in a future phase. The rubric file at `${CLAUDE_PLUGIN_ROOT}/references/captivation-rubric.md` is the canonical schema (schema_version: 2, total_range [0, 16], 8 components, novelty_dedup binary dimension).

### Flagged Issues
1. **Ch [N], ~line [N]:** "[description]"

## Flow and Transitions (Pass 2)

| Transition | Status | Action Taken |
|-----------|--------|--------------|
| Ch 1 -> Ch 2 | smooth | none |

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
[Any translation mismatches]

## Bestseller Diagnostic
[Per-chapter CRAFT-01..08 + CRAFT-15 pass/fail matrix appended by §4.6]

## Unresolved Issues (Requires User Decision)
[Issues the editor could not auto-resolve]
```

### 4.6 Bestseller Diagnostic Assembly (CRAFT-16)

After Pass 3 cross-chapter validation completes, assemble the per-chapter bestseller diagnostic and append it to `reports/consistency-report.md`. This is the CRAFT-16 deliverable: every CRAFT-01..08 + CRAFT-15 result for every chapter, surfaced at the Stage 4 review gate alongside voice consistency flags.

**Step 1 — Re-invoke craft-check.js per chapter.** For each chapter, run the deterministic checker against the edited final file:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js [project_directory]/edited/ch[NN]-final.md
```

Parse the JSON output. The JSON shape is `{chapter_id, checks: {CRAFT-XX: {pass, evidence, citations}}}` per Plan 10-01. The deterministic checks covered are CRAFT-01 (provenance presence), CRAFT-02 (Greek/Hebrew density), CRAFT-05 (pulpit-seam), CRAFT-07 (reader-thought lines), and CRAFT-15 (version stamp).

**Step 2 — Gather Pass 2 judgment results.** Read each chapter's `<!-- VOICE AUDIT -->` metadata block from `edited/ch[NN]-final.md`. Extract the `craft_pass2:` block (written by Pass 2 §3.3, §3.7, §3.8, §3.9 and the §2.12 carry-through). It supplies the LLM judgment results for CRAFT-03 (central image), CRAFT-04 (vulnerability beat), CRAFT-06 (reader moments), and CRAFT-08 (concrete:abstract ratio carries from Pass 1 §2.12 via the merged `craft_check` block).

**Step 3 — Merge into a per-check matrix.** For each chapter, build a row per check by combining the deterministic and judgment results. Use the unified status set:

- `PASS` — all assertions for this check passed.
- `FAIL` — a hard-gate check failed (CRAFT-01 provenance, CRAFT-02 density, CRAFT-05 pulpit-seam, CRAFT-15 version stamp).
- `FLAG` — a flag-only judgment check did not pass (CRAFT-03, CRAFT-04, CRAFT-06, CRAFT-07, CRAFT-08, plus CRAFT-01 scene-quality strictness from Pass 2 §3.3).
- `SKIP` — check skipped because the prerequisite is absent (e.g. CRAFT-06 with no Reader Moments section in the voice profile, CRAFT-04 with empty `vulnerability_beat_seed`).

**Step 4 — Append `## Bestseller Diagnostic` to consistency-report.md.** Insert the section AFTER `## Cross-Chapter Consistency` (the Pass 3 Cross-Chapter block) and BEFORE `## Unresolved Issues` (if present). For each chapter, emit a sub-section in this exact shape:

```markdown
### Ch N: {title}

| Check | Pass/Fail | Evidence | Line |
|---|---|---|---|
| CRAFT-01 Scene-first opener | PASS/FAIL/FLAG | <evidence> | ch{NN}:<line> |
| CRAFT-02 Greek density | PASS/FAIL | <evidence> | ch{NN}:<line> |
| CRAFT-03 Central image | PASS/FLAG | <evidence> | ch{NN}:<range> |
| CRAFT-04 Vulnerability beat | PASS/FLAG/SKIP | <evidence> | ch{NN}:<line> |
| CRAFT-05 Pulpit seam | PASS/FAIL | <evidence> | ch{NN}:<line> or — |
| CRAFT-06 Reader moments | PASS/FLAG/SKIP | <evidence> | ch{NN}:<line> |
| CRAFT-07 Reader-thought lines | PASS/FLAG | <evidence> | ch{NN}:<line> |
| CRAFT-08 Concrete:abstract ratio | PASS/FLAG | <evidence> | ch{NN}:p<start>-p<end> |
| CRAFT-15 Version stamp | PASS/FAIL | <evidence> | ch{NN}:<line> |

**Severity:** <count> flags (judgment-only). Chapter meets/misses hard gates.
```

The "Evidence" column should quote the offending phrase or cite the JSON `evidence` field from craft-check.js for deterministic checks, and a one-clause judgment summary for flag-only checks. The "Line" column uses the `chNN:<line>` chapter-relative line citation pattern shared with the rest of the consistency report.

**Step 5 — Append revision-cap notes.** After the per-chapter sub-sections, append a `### Revision Cap Notes` block listing any chapters that hit the orchestrator's 2-revision cap (CRAFT-17, wired in this plan — see `skills/orchestrator/SKILL.md` "Revision Cap and Divergent-Improvement Detection"). Each note uses this shape:

```
- Chapter N hit the 2-revision cap on [check]. Accepted revision {M} (highest-scoring). Human review recommended at Stage 4.
```

If a chapter triggered divergent-improvement detection instead of cap exhaustion, use the alternate phrasing emitted by the orchestrator: `Chapter N: divergent improvement detected at revision {N}. Accepted revision {N-1} (component X dropped from A to B).`

**Step 6 — No auto-revise.** §4.6 is purely an assembly step. It re-invokes `scripts/craft-check.js` for the final pass/fail matrix but does NOT trigger any new revision passes — the 2-revision cap (CRAFT-17) has already been enforced upstream by the orchestrator's per-chapter revision loop. If §4.6 detects a hard-gate FAIL on a chapter that did not exhaust the revision cap, log the failure in the diagnostic report and let the Stage 4 review gate surface it to the user.

**Rule reference:** `${CLAUDE_PLUGIN_ROOT}/references/bestseller-craft-rules.md` § CRAFT-16.

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
- Voice profile path: `[project_directory]/voice-profile.md`
- Book DNA path: `[project_directory]/book-dna.md`
- Current chapter path: `[project_directory]/drafts/ch[NN]-draft.md`
- Previous chapter overlap (final 500 words of ch[N-1], or "none")
- Next chapter overlap (first 500 words of ch[N+1], or "none")

### 5.3 Parallelisation Rules

- **Pass 1 subagents** can run in parallel -- each chapter is independent for voice checking
- **Pass 2** is ALWAYS handled by the main editor skill sequentially (transitions need chapter pairs)
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

Run Pass 2 (flow/transitions) on the revised chapter AND its immediate neighbours:
- If revising Chapter N, check transitions for:
  - Ch[N-1] -> Ch[N] (if N > 1)
  - Ch[N] -> Ch[N+1] (if N < last chapter)
- Read the neighbour chapters from `edited/ch[NN]-pass2.md` (their previously edited versions)
- Save updated chapters to `edited/ch[NN]-pass2.md`

**One-hop limit:** Do NOT recursively check beyond immediate neighbours. If the Ch[N-1] ending was changed to accommodate the revised Ch[N], do NOT then check Ch[N-2] -> Ch[N-1]. Flag for the user if significant changes were made to adjacent chapters.

### 6.3 Targeted Pass 3

Run Pass 3 (cross-chapter validation) on affected references only:
- Scan the revised chapter for forward and backward references
- Validate those specific references against the referenced chapters
- Check term consistency for any new terms introduced in the revision
- Do NOT rebuild the full cross-chapter index -- only validate the changed chapter's references

### 6.4 Update Reports

Update `reports/consistency-report.md` with the revision results:
- Replace the row for the revised chapter in the Voice Consistency table
- Update transition rows involving the revised chapter in the Flow table
- Update affected entries in Cross-Chapter Consistency tables

## 7. Output Summary

After all passes complete (or after revision mode completes), return a summary to the orchestrator:

```
Editing complete for [Book Title].
Chapters edited: [N]
Voice consistency: [Clean/Minor/Significant] ([X] issues found, [Y] auto-resolved)
Captivation: avg [X.X]/16 ([N] chapters below threshold)
Transitions: [X]/[N-1] smooth
Cross-references: [X] validated, [Y] flagged
Report: [project_directory]/reports/consistency-report.md
```

## 8. Anti-Patterns

- Do NOT edit body text during the flow pass (Pass 2) -- only touch final/first paragraphs of chapters
- Do NOT run passes in parallel -- passes MUST be sequential (Pass 2 needs Pass 1 output, Pass 3 needs Pass 2 output)
- Do NOT overwrite original drafts -- always write to the `edited/` directory
- Do NOT produce subjective voice flags -- every flag must cite a specific rule from the voice profile (vocabulary violation, anti-pattern match, sentence length deviation)
- Do NOT modify Book DNA, voice-profile.md, chapter-outline.md, or any shared file
- Do NOT spawn subagents from within subagents -- if running as a chapter-editor subagent, work directly
- Do NOT recursively check beyond one hop during revision adjacency checks
- Do NOT run the entire manuscript through all three passes when in revision mode -- only process the affected chapters and their immediate neighbours
- Do NOT treat Pass 3 findings as auto-fixable -- term inconsistencies and broken references should be flagged in the report for the user to decide, unless the fix is unambiguous (e.g., capitalisation drift)
