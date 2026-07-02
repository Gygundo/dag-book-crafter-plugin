---
name: sermon-adapter
description: "Transforms sermon transcripts and spoken-word source material into the written Dag teaching register. Numbered points, ALL-CAPS scripture emphasis, anaphora, and block-quoted scripture with commentary are the TARGET format and are PRESERVED or normalised -- not converted to flowing narrative. What is removed: congregational address, venue/date references, verbal interaction cues, filler, and rambling digressions. Called by the orchestrator as Stage 0.5 when sermon-format sources are detected."
user-invocable: false
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Sermon Adapter

Transforms spoken-rhythm source material into the written Dag teaching register before the outliner runs. This is Stage 0.5 of the book pipeline -- a conditional pre-processing step. Numbered points, anaphora, and block-quoted scripture are TARGET format and are preserved; what is removed is delivery ceremony: congregational address, venue/date references, verbal interaction cues, and filler.

## 1. Overview

**Purpose:** Transform spoken-rhythm source material into the Dag written register so that the outliner, researcher, writer, and editor all work with already-adapted content. This avoids threading sermon-awareness through every downstream skill.

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
- After: `Grace is not what most people think it is. It is not a licence to sin. It is not a safety net. Grace is the foundation. Everything else is built on it.`

**Key principle:** Fragments work in speech because the speaker's voice, pace, and body language carry the emphasis. In Dag written register, complete short declarative sentences stacked in sequence do that work -- subject-verb-object, rarely exceeding 18 words.

### Rule 2: Audience De-personalisation

**Input pattern:** Direct address to a specific congregation, temporal references to specific services, spatial references to the physical venue, relational references to the speaker's pastoral role.

**Transform:** Remove or universalise. Replace temporal references with timeless framing. Replace spatial references with universal context. Replace congregational address with reader address.

**Examples:**
- Before: `I want you to turn to your neighbour and say "I'm not who I used to be." As we've been walking through this series together...`
- After: `You are not who you used to be. That is not a wish. That is a declaration.`

- Before: `Last Sunday we talked about the power of identity. This morning I want to take it further.`
- After: `The previous chapter established the power of identity. Now we go deeper.`

- Before: `Here in our church, we believe in the supernatural. As your pastor, I want to tell you...`
- After: `The supernatural is not a relic of the early church. It is a present reality.`

**Key principle:** A book reader has no "last Sunday", no "this morning", no neighbour to turn to. Every reference must work for someone reading alone, in any time and place.

### Rule 3: Verbal Cue Normalisation

**Input pattern:** Spoken cues divide into two types:
- **Congregational interaction cues** (drop entirely): "Are you tracking with me?", "Say this with me", "Turn to your neighbour", "Can I get an amen?", "Somebody say..."
- **Attention framers** (normalise to Dag written equivalents): "Watch this", "Now look at this", "Here's what I love about this", "Let me tell you something", "Can I be honest with you for a moment?"

**Transform:** Drop congregational interaction cues without replacement. Normalise attention framers to Dag written framers: "Notice this", "Notice the Scripture:", "You see,", "In other words,", "Read it for yourself".

**Examples:**
- Before: `Now watch this. Here's where it gets good. Look at verse 15. Paul says...`
- After: `Notice what Paul says in verse 15.` *(Attention framer → Dag written equivalent; the ceremony is stripped.)*

- Before: `Are you tracking with me? Let me say it another way.`
- After: `In other words,` *(Congregational check-in dropped; plain Dag pivot retained.)*

- Before: `Can I be honest with you for a moment? This next part might challenge you.`
- After: *(The throat-clear is dropped; begin the challenging statement directly.)*

**Key principle:** Some preacher framers ARE written Dag voice ("Notice how...", "You see,", "In other words,", "Read it for yourself"). These survive adaptation. What is dropped is the congregational ceremony -- the cues that only work when a live audience is physically present.

### Rule 4: Anaphora Preservation

**Input pattern:** Anaphoric sequences -- 3–7 consecutive sentences or point bodies opening with the same phrase or stem, building a list of parallel truths through spoken rhythm. Also genuine rambling digressions: repetition of the same idea without advancing it, tangential asides, or circular restatements.

**Transform:** PRESERVE intentional anaphora. This is the signature emphasis engine of the Dag teaching register, not a preaching artefact to be cleaned away. Convert only the delivery form (spoken fragments → complete written sentences) without flattening the parallel structure. Cut only genuine digressions that dilute rather than build.

**Example:**
- Before: `You must decide. Decide today. Decide to follow God. Decide to honour your pastor. I said decide to honour your pastor. Decide to give. Decide to pray. Are you going to decide?`
- After:
  ```
  **1. Decide to follow God.**
  **2. Decide to honour your pastor.**
  **3. Decide to give.**
  **4. Decide to pray.**
  ```
  *(The repeated "Decide" opener is preserved as a parallel stem. "I said decide to honour your pastor" -- a non-advancing echo -- is removed. The congregational check "Are you going to decide?" is removed.)*

**Key principle:** Anaphora is not padding -- it is the primary means of emphasis in this register. Every repeated opener launches a new truth, not a restatement of the old one. If the opening phrase recurs without adding a new completion, cut it. If it recurs with a new completion, preserve it.

### Rule 5: Point Normalisation

**Input pattern:** Sermon-style numbered or labelled headings in various formats: `POINT 1:`, `1. THE POWER OF...`, `CONCLUSION`, `APPLICATION:`, ALL CAPS section titles.

**Transform:** PRESERVE the numbered point structure. Normalise each heading to the Dag format: a bold, complete, declarative or imperative sentence with a parallel stem running through all points in the chapter. Convert ALL CAPS section labels to sentence-case complete sentences. Do NOT convert numbered points to flowing prose.

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
  **1. Grace is the foundation of everything God has given you.**
  Everything starts with grace...

  **2. Identity flows from a proper understanding of grace.**
  Once you understand grace...

  **3. Authority flows from settled identity.**
  When your identity is settled...
  ```

**Normalisation checklist:**
- Remove `POINT N:` prefix -- use plain number and bold
- Convert ALL CAPS heading label to sentence case
- Make heading a complete declarative or imperative sentence (not a noun label or fragment)
- Check that all headings share a grammatical stem; if not, normalise to the dominant pattern
- `CONCLUSION`, `APPLICATION`, `CLOSING` headings → strip; convert their content to a natural chapter close

**Key principle:** The numbered point is load-bearing structure in this register. It stays. The scaffolding labels (`POINT N:`, ALL CAPS) were speaking aids -- normalise these to written Dag format without touching the underlying content or point count.

### Rule 6: Scripture Block Normalisation

**Input pattern:** Scripture quoted in various forms -- introduced with "Let's read...", "Turn to...", "Look at verse...", run into prose as inline quotes, or already block-formatted but without Dag markdown or ALL CAPS key phrase.

**Transform:** PRESERVE block-quote format. Normalise every scripture reference to Dag markdown. Set off from prose on its own lines. Identify the operative phrase the point hangs on and capitalise it in ALL CAPS inside the quote. Verify KJV is the default translation; label any non-KJV.

**Target format:**
```markdown
> *And raised us up together, and MADE US SIT TOGETHER in the heavenly places in Christ Jesus.*
> -- Ephesians 2:6
```

**Example:**
- Before:
  ```
  Let's read Ephesians 2:6:

  > "And raised us up together, and made us sit together in the heavenly places in Christ Jesus"

  Now look at what this says. He RAISED us up. Past tense. Done deal. And He made us SIT.
  ```
- After:
  ```
  > *And raised us up together, and MADE US SIT TOGETHER in the heavenly places in Christ Jesus.*
  > -- Ephesians 2:6

  He raised us up. Past tense. Done. He made us sit.
  ```
  *(The "Let's read..." introduction is stripped. The ALL CAPS key phrase is placed inside the quote. The follow-up commentary is preserved and tightened.)*

**Normalisation checklist:**
- Every scripture → block quote with reference on second line (`> -- Book Chapter:Verse`)
- Identify the operative phrase; capitalise it in ALL CAPS inside the quote
- KJV default, unlabelled; label any non-KJV (`> -- Reference (NASB)`)
- Add `<!-- VERIFY -->` if the exact wording is uncertain
- Strip "Let's read...", "Turn to...", "Look at verse..." introductions; replace with a Dag framer if a lead-in is needed ("Notice the Scripture:", "Paul says,") or nothing
- Preserve the follow-up commentary; ensure it restates in plain words then applies to "you"

**Key principle:** Block-quoted scripture followed by plain-words commentary is the atomic teaching unit of this register. The block format is the target, not a reading assignment to be absorbed into narrative. What is stripped is only the congregational invitation to open Bibles together.

### Rule 7: Emphasis Normalisation

**Input pattern:** Multiple exclamation marks (`!!!`, `!!`), ALL CAPS used for emphasis in prose body (not inside scripture quotes), excessive bold or italic in body text substituting for vocal emphasis.

**Transform:** In prose body, replace ALL CAPS words with sentence structure. Normalise multiple exclamation marks to a single `!` at paragraph closers where emotion warrants it, or remove them where the sentence itself carries the weight. Do NOT touch ALL CAPS inside scripture block quotes -- these are required by the Dag format and must be preserved or added (see Rule 6).

**Examples:**
- Before: `This is HUGE! You need to understand this!! Grace changes EVERYTHING!!!`
- After: `This truth is not peripheral. It is central. Grace changes everything!` *(Prose ALL CAPS removed; multiple `!!!` normalised to single `!` at the close.)*

- Before: `God is **NOT** angry with you. He is **FOR** you!!`
- After: `God is not angry with you. He is for you.` *(Bold emphasis stripped; sentence structure carries it.)*

- Do NOT change: `> *be ye stedfast, UNMOVEABLE, always abounding in the work of the Lord*` ← ALL CAPS inside a scripture quote is required Dag format; leave it intact.

**Key principle:** In prose body, sentence structure and word choice create emphasis, not formatting. Single exclamation marks at paragraph closers are authentic Dag style (roughly one per 150–300 words). Multiple marks and ALL CAPS in prose are spoken delivery artefacts; remove them. ALL CAPS inside scripture quotes are a distinct technique -- they are part of the normalisation target, not a problem to fix.

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
transforms_applied: fragment-completion, audience-depersonalisation, verbal-cue-normalisation, anaphora-preservation, point-normalisation, scripture-block-normalisation, emphasis-normalisation
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

**Do NOT treat this as find-and-replace.** Each transformation requires understanding context. "Let me tell you" cannot simply become "Notice this" -- the entire sentence rhythm must change. The surrounding sentences must also adapt to the new prose flow.

**Do NOT eliminate intentional anaphora.** Anaphora -- repeating the same sentence opener 3–7 times to build a list of parallel truths -- is the primary emphasis device of this register. Preserve it. What to cut is genuine digressions: non-advancing echoes, circular restatements, and tangential asides. Warning sign: if the anaphoric structure collapses into a single sentence, you have over-edited.

**Do NOT convert numbered points to flowing prose.** The numbered point structure is target format. Normalise the labels; preserve the skeleton.

**Do NOT weave scripture into narrative prose.** Block-quoted scripture followed by plain-words commentary is the atomic teaching unit of this register. Preserve the block format; normalise it to Dag markdown.

**Do NOT create a summary or outline.** The adapter preserves full content in adapted form. It is NOT an abridgement. Every idea, argument, illustration, and scripture in the source must appear in the output.

**Do NOT change theological content or interpretations.** Transform the FORM, not the SUBSTANCE. If the sermon says grace is the foundation, the adapted version says grace is the foundation. The argument stays identical; only the delivery style changes.

**Do NOT add content that was not in the source.** The adapter transforms what exists; the researcher skill adds depth later. The one exception is brief contextual phrases needed to complete a fragment (e.g., turning "Grace." into "Grace is the foundation" when the surrounding context makes this clear).

**Do NOT remove scripture references.** All scripture references in the source must appear in the adapted output. They are normalised to block format (Rule 6), never dropped.

**Do NOT flatten the argument structure.** The logical progression of ideas must survive adaptation. If the sermon builds from point A to point B to point C, the adapted version maintains that progression through its numbered structure.

## 6. Output Format

Each adapted file is a clean markdown document in the Dag teaching register:

- **Numbered bold parallel-sentence point headings** (normalised from sermon-style labels)
- **Block-quoted KJV scripture** with ALL CAPS operative phrase and reference line
- **Plain-words commentary** following each scripture block
- **Single exclamation marks** at paragraph closers only (multiple exclamation marks removed)
- **No ALL CAPS in prose body** (prose body uses sentence structure for emphasis)
- **No congregational address**, temporal references, spatial references, or verbal interaction cues
- **The `<!-- SERMON ADAPTED` metadata comment** at the end of each file

**Target quality:** Adapted content reads as Dag teaching register on the page. The numbered point structure, scripture blocks, and direct reader address are all present. What is absent is the delivery ceremony -- the congregational check-ins, the venue references, the spoken filler.

## 7. Edge Cases

**Mixed content:** If a source file contains both sermon-style and written-style passages (e.g., a transcript with editorial notes), apply transformations only to the spoken-style passages. Leave already-written passages intact.

**Scripture-heavy sources:** Some sermons are primarily scripture reading with brief commentary. Apply Rules 6 and 7 but be careful not to over-edit when the source is already mostly scripture text.

**Multiple speakers:** If the source indicates multiple speakers (e.g., a panel discussion transcript), adapt each speaker's content independently. Note in the metadata comment: `multiple_speakers: true`.

**Non-English content:** If source files contain non-English passages (e.g., Afrikaans phrases in a South African sermon), preserve them as-is. The adapter transforms delivery style, not language.
