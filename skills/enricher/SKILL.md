---
name: enricher
description: "Generates reader engagement content for each chapter: discussion questions, chapter summaries, prayer points (theological books only), and a book foreword. Called by the orchestrator as Stage 4.5 after editing is complete. Reads edited chapter files and Book DNA to produce enrichment artefacts."
user-invocable: false
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Content Enricher

Generates supplementary content that deepens reader engagement with each chapter. Produces per-chapter enrichments (discussion questions, summaries, prayer points for theological books) and a book foreword. Runs as Stage 4.5 in the pipeline, after editing and before formatting.

## 1. Overview

- **Purpose:** Generate supplementary content that deepens reader engagement with each chapter
- **Input:** Project directory path (received from orchestrator via `$ARGUMENTS`)
- **Reads:** `[project_directory]/edited/ch[NN]-final.md` files, `[project_directory]/book-dna.md`, `[project_directory]/voice-profile.md`
- **Output:** `[project_directory]/enrichments/ch[NN]-enrichments.md` per chapter + `[project_directory]/front-matter/foreword.md`
- **Prerequisites:** All `edited/ch[NN]-final.md` files exist (Stage 4 complete)

## 2. Pre-flight Checks

On invocation:

1. Read `book-dna.md` from project directory -- extract title, chapter count, chapter map, key terms
2. Read `voice-profile.md` -- determine if the book is theological (check for "Theological Framework" or "Theological/Domain Framework" section)
3. Count `edited/ch[NN]-final.md` files -- must match chapter count from Book DNA
4. Create output directories:
   ```bash
   mkdir -p [project_directory]/enrichments
   mkdir -p [project_directory]/front-matter
   ```
5. Set `is_theological` flag based on voice profile analysis

If the chapter count does not match, report an error and stop:
> "Enricher requires all edited chapters. Expected [N] chapters from Book DNA, found [M] in edited/. Stage 4 may be incomplete."

## 3. Discussion Questions (ENH-03)

For each chapter, generate 3-5 discussion questions.

**Input per chapter:** Read the full text of `edited/ch[NN]-final.md`

**Quality rules:**
- Each question MUST reference at least one specific concept, term, argument, scripture, illustration, or word study that appears in THAT chapter
- Questions must NOT be interchangeable between chapters -- if the question could apply to any chapter without modification, reject it and generate a replacement
- Questions should progress from comprehension to application to deeper exploration

### Cliche Test -- reject questions matching these patterns:

- "What does this chapter mean to you?" (too vague)
- "How can you apply this to your life?" (generic application)
- "What stood out to you most?" (lazy engagement)
- "Have you ever experienced something similar?" (generic experience)
- Any question that does not mention a specific concept, term, or argument from the chapter
- Any question that could be asked about a completely different book

### Good question patterns:

- "The chapter argues that [specific claim]. How does this challenge the common understanding that [counter-position]?"
- "[Author's term/concept] implies [implication]. If this is true, what practical difference should it make when [specific situation]?"
- "The author draws a distinction between [X] and [Y]. Where have you seen this distinction matter in [specific context]?"
- "In [specific passage/scripture from the chapter], [specific observation]. How does this connect to [related concept from the chapter]?"

### Self-check

After generating questions for a chapter, verify each question against the cliche test. For each question, confirm:
1. It names a specific concept, term, scripture, or argument from the chapter
2. It could NOT be asked about a different chapter in the same book without modification
3. It is not a rephrased version of any cliche test pattern

Replace any question that fails.

## 4. Chapter Summaries (ENH-04)

For each chapter, generate a 3-5 sentence summary.

**Quality rules:**
- The summary must capture: (1) the core argument of the chapter, (2) 1-2 key supporting points, and (3) the chapter's contribution to the overall book arc
- Read the chapter's entry in the Book DNA Chapter Map to understand its core argument and momentum position
- The summary is NOT a table of contents entry -- it captures the ARGUMENT, not just the topic
- Write in the same voice as the book (match the voice profile)

**Bad summary patterns (reject):**
- "This chapter is about [topic]." (topic summary, not argument summary)
- "The author discusses [X], [Y], and [Z]." (list of topics, no argument)

**Good summary patterns:**
- "[Core argument stated as a claim]. [Key supporting evidence]. [How this builds on/connects to the broader book arc]."

## 5. Prayer Points (ENH-05) -- Theological Books Only

**Skip this section entirely if `is_theological` is false.** When skipped, do not include the "Prayer Points" section in the enrichment file.

For each chapter of a theological book, generate 2-4 prayer points.

**Quality rules:**
- Prayer points must be written in prayer format -- addressed TO God, not about God
- Each prayer point must reference a specific revelation, scripture, or truth from the chapter
- Prayer points express RESPONSE (gratitude, declaration, request for deeper understanding), not summary of teaching
- Do NOT write prayers that start with "Help me to..." or "Lord, teach me about..." without referencing specific chapter content

### Bad prayer point patterns (reject):

- "Lord, help me understand grace better" (generic, no chapter reference)
- "Father, teach me Your ways" (could apply to any chapter)
- "Help me to walk in Your truth" (vague, no specific truth referenced)

### Good prayer point patterns:

- "Father, I thank You that [specific truth from chapter] is not a future promise but a present reality. I declare that [specific implication from the chapter's argument]."
- "Lord, I receive the truth that [specific revelation]. Like [biblical figure mentioned in chapter], I choose [specific response connected to chapter content]."
- "I pray for eyes to see that [specific reframing from chapter]. You are the God who [specific attribute explored in chapter], and I trust [specific aspect of the chapter's conclusion]."

### Prayer voice calibration

Prayer points must match the theological framework in the voice profile:
- Grace-based theology: prayers of gratitude and declaration, not striving or self-effort
- Identity in Christ: prayers that affirm who the believer IS, not what they must DO
- New Covenant lens: prayers that celebrate the finished work, not plead for what is already given
- Authority of the believer: prayers of bold declaration, not timid begging

## 6. Foreword (ENH-06)

Generate a single foreword for the entire book.

**Input:** Read `book-dna.md` (title, themes, arc, audience), the chapter outline from `chapter-outline.md`, and the chapter summaries already generated in this enrichment pass.

**Two modes:**

1. **Author voice** (default): Write the foreword in the same voice as the book. Frames the book's purpose and the author's motivation. 500-800 words.
2. **Endorser draft**: Write as if a respected third party is introducing the book. Uses a slightly more formal, external-observer tone. 500-800 words. Include a note: `<!-- This is a draft foreword. Replace with an actual endorser's words or use as-is. -->`

Default to author-voice mode unless the Book DNA metadata contains a "Foreword mode: endorser" instruction.

**Quality rules:**
- The foreword frames PURPOSE: why does this book exist? What gap does it fill? Who is it for? What transformation does it promise?
- The foreword does NOT summarise the book chapter by chapter
- The foreword does NOT mention specific chapter numbers
- The foreword does NOT give away climax revelations
- The foreword TEASES the journey without revealing destinations
- Match the book's voice profile for tone and vocabulary

## 6.1 Anti-Loop Clause (Foreword)

> The SC-6 proof run revealed that the enricher copies verbatim sentences from edited chapters into the foreword. Three 6+ word spans from ch01 bled into front-matter/foreword.md, causing craft-check.js --novelty to flag 4 repeated_spans. This clause is the structural fix on the enricher side — mirroring the writer's Anti-Loop Clause (Phase 13, D-30).

When generating the foreword, you read all edited chapters for context. You MUST NOT copy from them. Honour these rules:

1. **No 6+ word phrase reuse from any chapter or enrichment file.** Before committing any sentence in the foreword, check whether a 6-or-more-word span appears in any `edited/ch*-final.md` file or any `enrichments/ch*-enrichments.md` file. If yes, REWRITE the sentence using different words. The foreword frames PURPOSE — it does not quote chapters.

2. **No vulnerability beat reproduction.** If an edited chapter contains a first-person vulnerability beat (a named confession, doubt, fear, or struggle in the middle third), the foreword MUST NOT reproduce that scene — even paraphrased. The foreword may reference the THEME of vulnerability (e.g., "this book doesn't hide from the hard moments") but must not retell the specific scene. Vulnerability beats are single-use per Phase 13 D-30 rule 2.

3. **Central image vehicle distinctness.** If the foreword uses imagery from the book's motif family, it must use a DIFFERENT vehicle from any chapter's central_image. Read the Book DNA Chapter Map to see which vehicles are already assigned. The foreword's imagery should complement, not duplicate.

4. **Refrains are the ONLY permitted verbatim reuse.** Read the refrains YAML block from `[project_directory]/book-dna.md`. Each entry has phrase, max_uses, and scope. You may use each refrain phrase up to its max_uses budget in the declared scope. Every other verbatim span copied from a chapter is a violation.

### Consequence of violation

The orchestrator's post-enricher novelty gate (Stage 4.6) runs `craft-check.js --novelty --tier both` against the full corpus including the foreword. Any 6+ word span shared between the foreword and a chapter triggers `novelty_dedup: fail`, which hard-fails the sample gate. There is no override.

**Output format for foreword (`front-matter/foreword.md`):**

**Prepend `<!-- generated-by: dag-book-crafter v1.1.0 -->` as the first line of `front-matter/foreword.md`** (line 1, above the `# Foreword` heading). The version stamp is required on every generated artefact; the formatter strips all HTML comments before .docx emission.

```markdown
<!-- generated-by: dag-book-crafter v1.1.0 -->
# Foreword

[500-800 word foreword text]

<!-- FOREWORD METADATA
mode: author | endorser-draft
voice_source: book-dna
word_count: [N]
generated: [date]
-->
```

## 7. Output Format

For each chapter, write `enrichments/ch[NN]-enrichments.md` with this exact structure. **Prepend `<!-- generated-by: dag-book-crafter v1.1.0 -->` as the first line of every `enrichments/ch[NN]-enrichments.md` file** (line 1, above the `# Enrichments` heading). The version stamp is required on every generated artefact; the formatter strips all HTML comments before .docx emission.

```markdown
<!-- generated-by: dag-book-crafter v1.1.0 -->
# Enrichments: Chapter [N] - [Chapter Title]

## Discussion Questions

1. [Question 1 -- references specific chapter content]
2. [Question 2 -- references specific chapter content]
3. [Question 3 -- references specific chapter content]
4. [Question 4 -- references specific chapter content]
5. [Question 5 -- optional, for chapters with rich content]

## Chapter Summary

[3-5 sentence summary capturing core argument, key supporting points, and contribution to book arc]

## Prayer Points

[ONLY for theological books -- omit entire section for non-theological]
- [Prayer point 1 -- addressed to God, references specific chapter revelation]
- [Prayer point 2 -- references specific scripture or truth from chapter]
- [Prayer point 3 -- optional]
- [Prayer point 4 -- optional]

<!-- ENRICHMENT METADATA
chapter: [N]
title: [Chapter Title]
discussion_questions: [count]
has_summary: true
has_prayer_points: true | false
generated: [date]
-->
```

**Note on non-theological books:** When `is_theological` is false, omit the entire `## Prayer Points` section (not just the content -- remove the heading as well). The `has_prayer_points` field in the metadata block should be `false`.

## 8. Processing Workflow

1. Run pre-flight checks (Section 2)
2. Process chapters sequentially (1 through N):
   a. Read `edited/ch[NN]-final.md`
   b. Read the chapter's entry from Book DNA Chapter Map
   c. Generate discussion questions (Section 3)
   d. Self-check discussion questions against cliche test
   e. Generate chapter summary (Section 4)
   f. Generate prayer points if theological (Section 5)
   g. Write `enrichments/ch[NN]-enrichments.md`
   h. Report: "Enrichment [current]/[total]: Chapter [N] - [Title]"
3. After all chapters, generate foreword (Section 6)
4. Write `front-matter/foreword.md`
5. Report completion: "Content enrichment complete: [N] chapter enrichments + foreword generated"

## 9. Anti-Patterns

- Do NOT generate generic enrichments that could apply to any book. Every question, summary, and prayer point must be tied to specific chapter content.
- Do NOT write discussion questions from the summary alone -- read the FULL chapter text to find specific arguments, illustrations, and scriptures to reference.
- Do NOT write prayer points that are rephrased teaching. Prayer points are RESPONSES to revelation, not summaries of it.
- Do NOT write a foreword that summarises the book. A foreword frames PURPOSE.
- Do NOT break voice. All enrichment content must match the book's voice profile. Academic-sounding discussion questions on a conversational book will feel jarring.
- Do NOT include prayer points for non-theological books. Check the `is_theological` flag and skip entirely.
- Do NOT mention specific chapter numbers in the foreword. The foreword teases the journey, it does not provide a road map.
- Do NOT modify any input files (edited chapters, book-dna.md, voice-profile.md, chapter-outline.md). The enricher is read-only on all inputs.
