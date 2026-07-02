---
name: sermon-adapter
description: "Transforms sermon transcripts and spoken-word source material into written-rhythm prose suitable for book chapters. Converts spoken fragments to complete sentences, audience-specific references to universal ones, verbal cues to written transitions, and repetition-for-emphasis to revelation-for-emphasis. Called by the orchestrator as Stage 0.5 when sermon-format sources are detected."
user-invocable: false
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Sermon Adapter

Transforms spoken-rhythm source material into written-rhythm prose before the outliner runs. This is Stage 0.5 of the book pipeline -- a conditional pre-processing step that ensures sermon transcripts, spoken-word notes, and other oral-delivery content reads as written prose before entering the standard pipeline.

## 1. Overview

**Purpose:** Transform spoken-rhythm source material into written-rhythm prose so that the outliner, researcher, writer, and editor all work with already-adapted content. This avoids threading sermon-awareness through every downstream skill.

**Input:** Project directory path (received from orchestrator via `$ARGUMENTS`). Reads all `.md` files from `[project_directory]/sources/`.

**Output:** Adapted files written to `[project_directory]/sources-adapted/`. Each adapted file corresponds to a source file with the same filename.

**Prerequisites:**
- `sources/` directory exists in the project directory
- `sources/` contains at least one `.md` file
- The orchestrator has already confirmed (via detection or user indication) that these sources contain sermon-format content

## 2. Sermon Detection Heuristics

When the orchestrator calls this skill, it has already detected sermon indicators. However, the adapter should also confirm by scanning source files for these patterns:

**Structural indicators:**
- ALL CAPS headings (e.g., `POINT 1:`, `THE FOUNDATION OF GRACE`, `CONCLUSION`)
- Numbered point lists with sermon-style headings (`1. THE POWER OF...`, `POINT 3:`)
- Block-quoted scripture followed by commentary pattern ("Now look at what this says...")

**Audience-directed language:**
- First/second person plural audience address ("we", "us", "you" used as direct address to a congregation)
- Relational references: "as your pastor", "I've told you before", "my family"

**Verbal delivery cues:**
- Verbal cues: "Let me tell you", "Think about this", "Watch this", "Here's what I love about this", "Now look at this", "Are you tracking with me?", "Say this with me", "Turn to your neighbour"
- Temporal references: "this morning", "last Sunday", "tonight", "this week", "over the past few weeks"
- Spatial references: "here in this room", "in our church", "as we gather", "in this building"

**Emphasis patterns:**
- Multiple exclamation marks (`!!`, `!!!`)
- ALL CAPS words used for spoken emphasis (not headings)
- Repeated short fragments for spoken rhythm ("Grace. Grace! GRACE.")

**Threshold:** If fewer than 3 indicators found across all source files, warn:

> "These source files don't appear to be sermon transcripts. The adapter will still process them, but the output may not differ significantly from the originals."

If 3 or more indicators are found, proceed with full adaptation.

## 3. Transformation Rules

Apply these seven transformations to each source file, in order. Each transformation is a contextual rewriting pass -- not a regex substitution. Understanding the surrounding content is required to produce natural written prose.

### Rule 1: Fragment Completion

**Input pattern:** Short fragments, incomplete sentences, one-word emphatic statements used for spoken rhythm and emphasis.

**Transform:** Complete into full sentences that preserve the emphasis without relying on spoken delivery. The written version must carry the same weight through word choice and sentence construction, not through brevity and dramatic pauses.

**Example:**
- Before: `Grace. It's not what you think. Not a license. Not a safety net. It's the FOUNDATION.`
- After: `Grace is not what most people think it is. It is neither a licence to sin nor a safety net for when things go wrong. It is the foundation -- the bedrock upon which everything else is built.`

**Key principle:** Fragments work in speech because the speaker's voice, pace, and body language carry the emphasis. In writing, the sentence structure itself must do that work.

### Rule 2: Audience De-personalisation

**Input pattern:** Direct address to a specific congregation, temporal references to specific services, spatial references to the physical venue, relational references to the speaker's pastoral role.

**Transform:** Remove or universalise. Replace temporal references with timeless framing. Replace spatial references with universal context. Replace congregational address with reader address.

**Examples:**
- Before: `I want you to turn to your neighbour and say "I'm not who I used to be." As we've been walking through this series together...`
- After: `There comes a moment when a truth settles so deeply that it changes how you see yourself. You are not who you used to be.`

- Before: `Last Sunday we talked about the power of identity. This morning I want to take it further.`
- After: `The previous chapter established the power of identity. Now it is time to go deeper.`

- Before: `Here in our church, we believe in the supernatural. As your pastor, I want to tell you...`
- After: `The supernatural is not a relic of the early church. It is a present reality.`

**Key principle:** A book reader has no "last Sunday", no "this morning", no neighbour to turn to. Every reference must work for someone reading alone, in any time and place.

### Rule 3: Verbal Cue Replacement

**Input pattern:** Spoken transitions and attention-grabbers: "Watch this", "Here's what I love about this", "Now look at this", "Let me tell you something", "Are you tracking with me?", "Say this with me", "Can I be honest with you?"

**Transform:** Replace with written transitions that serve the same function (building anticipation, flagging importance, shifting focus) but in prose form.

**Examples:**
- Before: `Now watch this. Here's where it gets good. Look at verse 15. Paul says...`
- After: `This is where Paul's argument takes a decisive turn. In verse 15, he writes...`

- Before: `Are you tracking with me? Let me say it another way.`
- After: `To put it more precisely...`

- Before: `Can I be honest with you for a moment? This next part might challenge you.`
- After: `What follows may challenge some deeply held assumptions.`

**Key principle:** Verbal cues exist because a speaker cannot bold, italicise, or restructure a sentence for emphasis. A writer can. Replace the verbal cue with the writing technique it was substituting for.

### Rule 4: Repetition Consolidation

**Input pattern:** Same idea stated 2-3 times in slightly different words within a paragraph or section. In spoken delivery, this gives the audience time to absorb. In writing, it reads as padding.

**Transform:** Keep the strongest version, enhance with depth (add word study, cross-reference, or implication), discard the echoes. The book version goes DEEPER once instead of WIDER three times.

**Example:**
- Before: `You are seated with Christ. Seated! Not standing in line. Not waiting outside. SEATED. You are IN Christ. Positioned. Established. Settled.`
- After: `The word Paul uses is "seated" -- past tense, completed action. Not standing in line hoping for an audience. Not waiting outside the throne room. Seated. The Greek word kathizo carries the sense of permanent establishment -- positioned, established, settled in a place of authority. This is not a future promise. It is a present reality.`

**Key principle:** Sermons use repetition-for-emphasis because the audience hears once and moves on. Books use revelation-for-emphasis because the reader can re-read. Go deeper, not wider.

### Rule 5: Structural De-numbering

**Input pattern:** Numbered points with ALL CAPS headings, sermon-style structure markers (`POINT 1:`, `POINT 2:`, `CONCLUSION`).

**Transform:** Convert to flowing prose with natural transitions between ideas. The numbered-point structure is a speaking aid that helps the audience track the argument. In writing, the argument's logic provides that structure naturally. Preserve the logical progression but let it flow as narrative, not bullet points.

**Example:**
- Before:
  ```
  POINT 1: GRACE IS THE FOUNDATION
  Everything starts with grace...

  POINT 2: IDENTITY FLOWS FROM GRACE
  Once you understand grace...

  POINT 3: AUTHORITY FLOWS FROM IDENTITY
  When your identity is settled...
  ```
- After:
  ```
  Everything starts with grace. It is the foundation upon which every other truth is built.

  Once grace is understood -- truly grasped, not merely acknowledged -- identity begins to shift. The believer who knows grace sees themselves differently...

  And from that settled identity, something remarkable emerges: authority. Not authority earned through effort, but authority that flows naturally from knowing who you are...
  ```

**Key principle:** Numbered points are scaffolding. In a finished building, you remove the scaffolding. The structure stands on its own.

### Rule 6: Scripture Re-integration

**Input pattern:** Block-quoted scripture presented as a reading assignment, followed by commentary that begins with "Now look at what this says..." or "Notice what Paul is saying here..."

**Transform:** Weave scripture into narrative flow. The verse should emerge as part of the argument, not precede it as a reading assignment. The commentary should feel like discovery, not instruction.

**Example:**
- Before:
  ```
  Let's read Ephesians 2:6:

  > "And raised us up together, and made us sit together in the heavenly places in Christ Jesus"

  Now look at what this says. He RAISED us up. Past tense. Done deal. And He made us SIT.
  ```
- After:
  ```
  Paul puts it this way in Ephesians 2:6 -- "raised us up together, and made us sit together in the heavenly places in Christ Jesus." Notice the tense. Not "will raise." Not "might raise one day." He raised. Past tense. A completed action. And the result is equally definitive: He made us sit. Seated. Established. This is not a promise for the future. It is a declaration about the present.
  ```

**Key principle:** In a sermon, "Let's read..." creates a shared moment of engagement. In a book, it creates a speed bump. Scripture should flow INTO the argument as evidence, not stand apart as a reading exercise.

### Rule 7: Exclamation and Emphasis Normalisation

**Input pattern:** Multiple exclamation marks, ALL CAPS used for emphasis (not headings), bold/italic overuse, emphatic formatting that substitutes for vocal emphasis.

**Transform:** Replace with prose-based emphasis. In writing, sentence structure and word choice create emphasis -- not formatting. A well-constructed sentence carries more weight than a capitalised word.

**Examples:**
- Before: `This is HUGE! You need to understand this!! Grace changes EVERYTHING!!!`
- After: `This truth is not peripheral. It is central. Grace does not merely adjust the edges of life. It changes everything.`

- Before: `God is **NOT** angry with you. He is **FOR** you!!`
- After: `God is not angry with you. He is for you. Irrevocably, unshakeably, completely for you.`

**Key principle:** Exclamation marks are the written equivalent of shouting. A skilled author rarely shouts. Emphasis comes from the weight of the words themselves.

## 4. Processing Workflow

On invocation:

### Step 1: Read source files

Read all `.md` files from `[project_directory]/sources/` using:
```
ls [project_directory]/sources/*.md
```

If no `.md` files found, report: "No markdown source files found in sources/. The sermon adapter requires .md files." and exit.

### Step 2: Create output directory

```
mkdir -p [project_directory]/sources-adapted
```

### Step 3: Scan for sermon indicators

Before processing, scan all source files for sermon indicators (Section 2). Count the total number of distinct indicator types found. If fewer than 3, display the warning from Section 2.

### Step 4: Process each source file

For each source file:

a. **Read** the full content of the source file.

b. **Apply all 7 transformation rules** in order, as a single contextual rewriting pass. This is NOT seven separate regex passes. Read the entire file, understand its structure and argument, and rewrite it applying all seven rules simultaneously. The result should read as if it were originally written as prose, not as if it were mechanically processed.

c. **Write** the adapted content to `[project_directory]/sources-adapted/[original-filename]`.

d. **Append a metadata comment** at the end of each adapted file:

```
<!-- SERMON ADAPTED
source: [original filename]
date: [today's date in YYYY-MM-DD format]
transforms_applied: fragment-completion, audience-depersonalisation, verbal-cue-replacement, repetition-consolidation, structural-denumbering, scripture-reintegration, emphasis-normalisation
-->
```

### Step 5: Report completion

After all files processed, report:

> "Sermon adaptation complete: [N] source files transformed and saved to sources-adapted/"

Include a brief summary per file:
- Original filename
- Approximate word count change (original vs adapted)
- Number of sermon indicators found in that file

## 5. Anti-Patterns

**Do NOT treat this as find-and-replace.** Each transformation requires understanding context. "Let me tell you" cannot simply become "Consider this" -- the entire sentence rhythm must change. The surrounding sentences must also adapt to the new prose flow.

**Do NOT preserve sermon repetition.** If the same idea appears 2-3 times restated within a section, consolidate into one deeper treatment. The book version goes deep once, not wide three times. Warning sign: adapted word count is barely less than the original.

**Do NOT create a summary or outline.** The adapter preserves the full content length (possibly reducing it slightly by consolidation) in written form. It is NOT an abridgement. The adapted version should contain all the same ideas, arguments, illustrations, and scriptures -- just expressed in written rhythm instead of spoken rhythm.

**Do NOT change theological content or interpretations.** Transform the FORM, not the SUBSTANCE. If the sermon says grace is the foundation, the adapted version says grace is the foundation. The argument stays identical; only the delivery style changes.

**Do NOT add content that was not in the source.** The adapter transforms what exists; the researcher skill adds depth later. The one exception is brief contextual phrases needed to complete a fragment (e.g., turning "Grace." into "Grace is the foundation" when the surrounding context makes this clear).

**Do NOT remove scripture references.** All scripture references in the source must appear in the adapted output. They may be re-integrated into the narrative flow (Rule 6), but never dropped.

**Do NOT flatten the argument structure.** The logical progression of ideas must survive adaptation. If the sermon builds from point A to point B to point C, the adapted version must maintain that progression, even though the numbered-point scaffolding is removed.

## 6. Output Format

Each adapted file is a clean markdown document with:

- **No sermon-style formatting** (no ALL CAPS headings, no numbered points as structure, no excessive exclamation marks)
- **Preserved scripture references** in their original form (the researcher will handle proper formatting later)
- **Maintained logical flow** and argument structure of the original sermon, even though the presentation style changes completely
- **The `<!-- SERMON ADAPTED` metadata comment** at the end of each file

**Target quality:** Adapted content should read as if it were originally written as a book chapter draft, not transcribed from speech. A reader encountering only the adapted version should have no indication that the content began as a sermon.

## 7. Edge Cases

**Mixed content:** If a source file contains both sermon-style and written-style passages (e.g., a transcript with editorial notes), apply transformations only to the spoken-style passages. Leave already-written passages intact.

**Scripture-heavy sources:** Some sermons are primarily scripture reading with brief commentary. Apply Rules 6 and 7 but be careful not to over-edit when the source is already mostly scripture text.

**Multiple speakers:** If the source indicates multiple speakers (e.g., a panel discussion transcript), adapt each speaker's content independently. Note in the metadata comment: `multiple_speakers: true`.

**Non-English content:** If source files contain non-English passages (e.g., Afrikaans phrases in a South African sermon), preserve them as-is. The adapter transforms delivery style, not language.
