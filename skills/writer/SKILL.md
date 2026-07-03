---
name: writer
description: "Write a complete chapter draft following the Book DNA and voice profile. Called by the orchestrator during the writing stage. Designed to run in parallel via chapter-writer subagents."
user-invocable: false
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Chapter Writer

Produces a complete, voice-consistent chapter draft in the Dag Heward-Mills teaching register: verse-first architecture, numbered points with parallel stems, plain declarative prose, relentless direct address, and exhortation closers. Each chapter is a self-contained unit that teaches one point, lands it, and stops.

## 1. On Invocation

Receive via `$ARGUMENTS`:
- **Project directory path** - the book project root
- **Chapter number** - which chapter to write
- **Chapter title** - the chapter heading
- **Target word count** - how many words the chapter should aim for
- **Momentum position** - pacing guide (Foundation | Building | Accelerating | Climax | Landing)

**Step 1: Read Book DNA**

Read `[project_directory]/book-dna.md` FIRST. This is the primary guide for:
- Voice profile (tone, sentence rhythm, vocabulary, emphasis techniques)
- Theological/domain framework (the interpretive lens for all content)
- Chapter map (where this chapter sits in the book arc)
- Running themes (themes to weave in or reference)
- Key terms (use these consistently)
- Cross-chapter continuity notes
- Style rules (spelling convention, scripture translation, formatting)
- Refrains YAML block (declared verbatim phrases with usage budgets)

**Step 2: Read Voice Profile**

Read `[project_directory]/voice-profile.md` for detailed voice characteristics. Pay particular attention to:
- Sentence Patterns (this defines your rhythm)
- Vocabulary > Use and Vocabulary > Avoid lists (hard constraints)
- Anti-Patterns (what to NEVER do)
- Reader Situations (the concrete ministry and life situations to anchor application to)

**Step 3: Read Chapter Outline**

Read `[project_directory]/chapter-outline.md` and find `## Chapter [N]`. Extract:
- **opener_type** - `anchor_scripture`, `plain_declaration`, or `definition`
- **Anchor scripture** - quoted as the chapter epigraph if opener_type is anchor_scripture
- **Core argument** - the single proposition this chapter teaches
- **Key scriptures** - references to integrate
- **list_structure** - `stem: "[frame]", count: N` OR `flowing`
- **key_statement** - the chapter's one-line quotable aphorism
- **testimony_seed** - `source_path:line` pointer OR empty
- **Momentum position** - confirms pacing
- **Cross-references** - connections to other chapters
- **Target word count** - per-chapter target from the outline

**Step 4: Read Research Notes**

Read `[project_directory]/research/ch[NN]-research.md` (zero-padded chapter number). This contains:
- Full scripture text (KJV preferred) for primary and supporting passages
- Cross-references between passages
- Biblical narrative background and typological connections
- Illustrations, analogies, and third-party anecdotes
- Connections to other chapters

Use this material throughout the chapter. Do not treat it as a checklist - weave it naturally into the points.

**Step 5: Read craft constraints for this chapter**

Read the chapter's `opener_type`, `list_structure` (stem + count), `key_statement`, and `testimony_seed` from the chapter outline and cross-check the Book DNA Chapter Map. These are **hard constraints, not suggestions**:

- `opener_type` determines how the chapter opens - see Section 3 below.
- `list_structure` determines whether the chapter is built as numbered points (use the declared stem and count exactly) or flowing sections.
- `key_statement` MUST appear as a standalone one-line paragraph at least once in the chapter.
- `testimony_seed` - if present, open the file at the indicated line and read the referenced material before drafting. Compose the chapter's first-person illustration from that material only. If empty, skip first-person testimony and use types 2–4 from Section 4.6 instead.

Also read `${CLAUDE_PLUGIN_ROOT}/references/dag-craft-rules.md` before drafting. This file is the authoritative spec for DAG-01 through DAG-09.

## 2. Word Count Targets

The specific target word count comes from the chapter's outline section. Use the outline target. The table below is for reference if the outline target is missing.

| Size Tier | Per-Chapter Target | Acceptable Range |
|-----------|-------------------|------------------|
| Booklet   | ~800–2,000        | 600–2,500        |
| Short     | ~1,000–2,000      | 800–2,500        |
| Standard  | ~1,500–3,000      | 1,000–4,000      |

**If the argument completes early: stop.** Single-sentence points and short chapters are authentic to this style. Never pad.

**If the chapter runs long:** tighten prose, or recommend a split to the orchestrator. Chapter length imbalance across the book is authentic - a 700-word chapter may sit beside a 3,000-word one. Length is driven by the point list (DAG-05: stay within the outline's per-chapter target ±50%).

## 3. Chapter Openers (DAG-01)

Every chapter opens in exactly one of three ways, per the outline's `opener_type` field:

### anchor_scripture

A block-quoted scripture immediately after the chapter title. The operative phrase is in ALL CAPS inside the quote. Follow with a plain declarative sentence orienting the reader to the theme - no warm-up, no anecdote.

```markdown
# Chapter 3: You Must Pray Without Ceasing

> *Pray without ceasing. IN EVERY THING give thanks: for this is the WILL OF GOD in Christ Jesus concerning you.*
> -- 1 Thessalonians 5:17–18

Prayer is not a spiritual discipline for the advanced believer. It is the minimum requirement of the Christian life.
```

### plain_declaration

A flat thesis stated within the first two sentences - no warm-up, no story. ("You must be anointed because no one can fulfil his ministry by natural might.")

### definition

The chapter's key term defined in the first sentence. The definition may be restated verbatim later as a declared refrain. ("Intimidation is the art of deterring or controlling someone through fear.")

### Forbidden opener class

**Story-marker openers are forbidden as the opening paragraph.** The deterministic regex applied to the first words of the first body paragraph (case-insensitive):

```
/^(One day|Years ago|I remember|When I was|Once,|Some years ago|There was a time|Picture this|Imagine)/i
```

Stories belong INSIDE numbered points, never at the chapter opening. A story-marker opener = DAG-01 auto-revise.

### Required first lines

The first two lines of every chapter draft MUST be (exact order):

```
<!-- provenance: {source_path}:{line} -->   (source-ingestion projects only; omit in topic-brief mode)
<!-- generated-by: dag-book-crafter v1.1.0 -->
```

Both comments are stripped by the formatter before .docx emission - they exist for craft verification and version tracking only. In topic-brief mode, omit the provenance line and emit only the `generated-by` stamp.

## 4. The Atomic Teaching Unit (DAG-02/DAG-03)

The chapter body is built from the atomic teaching unit, repeated for each point:

1. **Numbered point heading** - bold complete parallel-stem sentence (`**3. Develop steadfastness by allowing yourself to be corrected.**`)
2. **Scripture block** (KJV, operative phrase in ALL CAPS, reference on its own line)
3. **Plain-words restatement** - opens with "In other words," or a terse equivalent ("Notice that...", "Paul is saying...")
4. **Application to "you"** - command, warning, or rhetorical question volley (3–6 questions)
5. **Optional brief illustration** - formula opener, ≤300 words, lesson stated explicitly at the end (see Section 4.6)
6. **Optional one-line aphorism closer** - standalone sentence that could be quoted on its own

**A point MAY stand alone as a single bold sentence with no body** - this is authentic. Do not invent padding to fill a thin point.

### List chapters

Use the outline's `list_structure` stem and count exactly. Every numbered point reuses the same grammatical frame (vary only the completion). Sub-lists use letters (a., b., c.). Interior counted headings are permitted mid-chapter ("Six Reasons Why You Must Strengthen Yourself"). **Sub-headings ARE used** - numbered bold point headings and short section headings are the skeleton of the chapter, not departures from it.

### Flowing chapters

When `list_structure: flowing`, use short, title-case section headings (2–4 per chapter) in place of numbered points. Examples: "Notice These Signs", "What the Anointing Does for You". Every section still anchors to at least one scripture block (DAG-02 floor: ≥3 blocks per chapter, ≥1 per 350 words).

### Chapter endings (DAG-07)

Close with a landing, never with unresolved tension. The final paragraph MUST end with one of:

- A direct command ("Decide today to walk in the spirit of boldness.")
- A benediction ("May the anointing of God rest upon you as you step out in faith.")
- A prophetic declaration ("I see your ministry growing beyond what you have imagined.")
- A prayer (ending "Amen")
- An exclamation of encouragement
- A scripture block
- The final point's stated moral

**Never end with:** a question as the chapter's last sentence, "in the next chapter we will...", "we will see...", "but that is another story...", or a trailing ellipsis. Chapters simply stop after the final point lands - no summary recap, no forward teaser.

## 4.5. Key Statement Discipline (DAG-04)

The outline's `key_statement` is the chapter's one-line quotable aphorism. It MUST appear as a standalone one-line paragraph at least once in the chapter. It may be repeated verbatim within the same chapter. If the same phrase recurs across multiple chapters, it must be declared in the Book DNA `refrains:` block before drafting begins.

**Correct placement:**

```markdown
The anointing does not flow through idle vessels.

In other words, you cannot be lazy and anointed at the same time.
```

Mark key statements as pull-quote candidates (see Section 7.6). Every chapter must also carry ≥1 ALL-CAPS phrase inside a scripture block - this is the DAG-04 deterministic check.

## 4.6. Illustrations (DAG-08)

Use 1–3 brief illustrations per chapter. Choose from these types:

1. **First-person testimony** - ONLY when the outline provides a `testimony_seed` (`source_path:line`). Open the file, read the referenced line and surrounding context, compose from that material. Use a formula opener ("Years ago, ...", "One day, ...", "When I was in secondary school..."). Record the seed in METADATA as `testimony_source`. **Never fabricate a first-person testimony** - this is a DAG-08 hard fail.
2. **Biblical narrative retelling** - compressed to a paragraph or two. Modern colour permitted; Bible characters may speak in modern paraphrase.
3. **Everyday analogy** - concrete, mechanical; arithmetic encouraged (provisions per day, percentages, exact counts). The ship's provisions, the electrical socket, the surgeon's "watch one, assist one, do one."
4. **Third-party anecdote** - brief, anonymised ("I once spoke with a minister who...", "A certain pastor told me...").

**Constraints for all illustrations:**
- Each illustration ≤300 words.
- Opened with a formula opener - no atmospheric build-up, no sensory detail for its own sake.
- **The lesson is always stated explicitly** at the end as a command or maxim ("This is where I learnt that loyalty is not optional!").
- Antagonists always anonymised ("a certain pastor", "this chap").

No `testimony_seed` = use types 2–4 only. Do not use type 1.

## Anti-Loop Clause (Phase 13, D-30)

> Phase 13 closed a repetition blindspot where the system scored well on its own rubric while the reader experienced the output as a loop. Root cause: the writer was rewarded for presence (illustration in every chapter, key devices repeated) but never told "do not reuse a specific story, analogy, or phrase already spent elsewhere." This clause is the structural fix on the writer side.

You MUST honour these five rules when drafting any chapter, foreword, or front-matter artefact.

1. **No 6-plus-word phrase reuse across chapters or foreword unless whitelisted.** Before committing any sentence, check whether this 6-or-more-word span appears in another already-drafted chapter or front-matter artefact. If yes, and the span is NOT in a declared refrain and is NOT in the dedup-exempt categories, REWRITE the sentence. **Dedup-exempt spans:** scripture blocks, declared refrains (list stems, key statements, definition sentences), and benediction formulas ("May you..."). Everything else must not repeat.

2. **Spent testimony seeds cannot be reused.** Each `testimony_seed` pointer is a specific sourced moment from `sources/`, `sources-adapted/`, or `book-dna.md`. Once a seed has been spent by a foreword or earlier chapter, choose a different sourced detail for later chapters, or skip the first-person testimony for that chapter (use types 2–4). Reusing a seed produces duplicate testimony across artefacts.

3. **Illustration vehicles must differ per chapter.** No two chapters may reuse the same story or analogy. If a mechanical analogy (the ship's provisions) anchors one chapter, a different story or analogy must anchor the next. Same analogy family is permitted; same specific illustration is not.

4. **Echo and recontextualise - do not repeat.** If a concept must recur because the book builds a cumulative argument, rephrase with different words, metaphors, or contextual details. A callback names the earlier point in new language; a loop repeats it verbatim.

5. **Refrains are the ONLY permitted verbatim cross-artefact reuse.** Read the refrains YAML block from `[project_directory]/book-dna.md`. Each entry has phrase, max_uses, and scope. Verbatim reuse outside the refrain block (and outside scripture blocks and benediction formulas) is a violation.

### Refrain schema the writer reads

```yaml
refrains:
  - phrase: "Forgive because God has forgiven you of far worse"
    max_uses: 7
    scope: chapter_body
  - phrase: "Unforgiveness is a poison that you drink yourself"
    max_uses: 3
    scope: whole_book
```

`max_uses` is an integer or `unlimited`. `scope` is one of `whole_book`, `chapter_endings`, `front_matter_only`, `body_only`. Count your own uses as you draft - when in doubt, use less than the max_uses budget, never more.

### Consequence of violation

The editor Pass 3 §4.4.5 emits `novelty_dedup: fail` and a `rewrite_targets` block. The orchestrator Mode 7 `--rewrite-targets` re-runs writer and editor for flagged chapters only, with the `reason` field injected as directional guidance. Your rewrite MUST address that reason - producing the same text is a hard fail that halts the pipeline per D-10.

## 5. Voice Consistency

This is the most critical section. Every parallel agent reads these same instructions so they produce output that reads as one voice.

### Mandatory Voice Rules

1. **Match the sentence rhythm** - short declarative stacking, 12–16 word average sentence, subject-verb-object. Complexity lives only inside KJV quotes.
2. **Use ONLY vocabulary from the "Use" list** and NEVER words from the "Avoid" list. Hard constraint, not a suggestion.
3. **Apply emphasis techniques** - ALL-CAPS in scripture quotes, bold full-sentence point headings, standalone one-line key statements, benedictions and prophetic declarations at section climaxes.
4. **Match the tone exactly** - authoritative preacher-teacher, blunt, absolutely certain. Pastoral warmth through relentless direct address and blessing, not through sentiment. Not academic. Not hedged.
5. **Follow anti-patterns strictly.** If the voice profile says "never do X", treat that as absolute.
6. **Preacher paragraph-openers are PERMITTED and authentic:** "You see,", "Notice how...", "In other words,", "Listen,", "Indeed,", "Sadly,", "Amazingly,", "Unfortunately,". The seam IS the style - this deliberately differs from other craft systems that ban such openers.

### Voice Calibration (Dag Register)

These examples calibrate the expected voice. Read them before writing. Internalise the directness, the question volleys, the exclamation punchlines. All examples below are original compositions for calibration - not quoted from any published book.

**CORRECT voice (anchor scripture, CAPS, question volley, exclamation closers):**

> *And be ye kind one to another, tenderhearted, FORGIVING ONE ANOTHER, even as God for Christ's sake hath forgiven you.*
> -- Ephesians 4:32

Unforgiveness is a poison that you drink yourself, hoping that someone else will die. Many Christians are weak, sick and joyless for one reason only: they are holding an offence. It is time to let it go!

Notice the words of this scripture: "even as God for Christ's sake hath forgiven you." In other words, the standard of your forgiveness is the forgiveness you have already received. Has God forgiven you? Has He blotted out things nobody else knows about? Has He received you back after you failed Him again and again? Then who are you to keep a brother in the prison of your resentment?

Do not forget this: unforgiveness is a poison that you drink yourself.

**CORRECT voice (plain declaration, imperative stack, benediction close):**

You must develop the habit of prayer. This is not a suggestion - it is a command. Are you praying every day? Are you fighting for one hour of prayer before the world wakes up? Are you defending your prayer life against every distraction? If you are not, you are building your ministry on sand. Decide today to become a man or woman of prayer.

May the Lord give you a spirit of prayer and supplication from this day forward!

**WRONG voice (literary story-opener - DAG-01 auto-revise fires):**

"The morning light filtered through the curtains as Maria sat at her kitchen table, hands wrapped around a cooling mug of tea. She had been up since four o'clock - not from habit, but from the restlessness of a question she could not quite name."

**WRONG voice (academic hedged register - DAG-06 auto-revise fires):**

"It could be argued that forgiveness, as understood within the framework of Pauline theology, represents a multi-dimensional virtue that some scholars associate with psychological and spiritual healing. Perhaps we might consider the various ways in which believers approach this practice."

**WRONG voice (generic balanced register - AI leaking through):**

"Prayer is an important spiritual discipline for many Christians. There are various perspectives on how to develop a consistent prayer life. Some people find it helpful to pray in the morning, while others prefer the evening."

## 6. Momentum-Aware Pacing

Adapt the writing style based on the chapter's momentum position.

| Position | Pacing | Sentence Style | Depth Level |
|----------|--------|----------------|-------------|
| Foundation | Measured, establishing. | Balanced mix; slightly fuller for definition chapters. | Define key terms, introduce foundational concepts. More illustrations. |
| Building | Developing, layering. | Mix of exposition and declaration. | Deepen concepts introduced in Foundation. More scripture anchoring. |
| Accelerating | Intensifying. | Shorter declaratives, more question volleys, more commands. | Less explanation, more direct application. Assume the foundation is laid. |
| Climax | Peak energy. | Shortest, most punchy. Bold declarations dominate. | Deepest scripture anchoring, most powerful cross-references. The book's central truth lands here. |
| Landing | Resolution. Send-off. | Warm but weighty; fuller for benedictions and commissions. | Practical application. Leave the reader commissioned, not merely informed. |

**Key principle:** A Foundation chapter reads differently from a Climax chapter even when the voice is constant. The energy and pacing shift; the register does not.

### Reader Situations (DAG-07)

Read the voice profile's `Reader Situations` section. Select **at least 2** concrete ministry or life situations per chapter and make the application land in one of them. A situation is specific enough to be picturable in one sentence: "the small-church pastor mocked for the size of his congregation" passes; "people who are struggling" does not.

Record which situations you selected in the METADATA block:

```
reader_situations_used: ["the associate pastor tempted to criticise his senior", "the believer too busy to pray"]
```

## 7. Plain Language and Transliterated Terms (DAG-06)

The prose reads at roughly grade 6–8 level. Complexity lives only inside KJV quotes. Average author-prose sentence ≤18 words.

### Transliterated Term Cap (DAG-06)

**Maximum 1 distinct transliterated Greek or Hebrew term per chapter.** Introduce it as a simple gloss in one plain sentence: "The word 'hesed' means covenant lovingkindness - love that is bound by promise." Never conduct an academic word study. Prefer English whenever semantic fidelity is preserved - do not reach for a Greek word to sound deep.

Authoritative term lexicon (shared with `scripts/craft-check.js`):

charis, agape, phileo, eros, storge, dunamis, exousia, logos, rhema, pneuma, sarx, kairos, chronos, sunergeo, pas, shalom, hesed, chesed, ruach, yada, ahavah, nephesh, echad, koinonia, metanoia, aman.

More than 1 distinct transliterated term per chapter = DAG-06 auto-revise.

### Hard Words

Any uncommon term gets a one-sentence plain definition in the same paragraph immediately after its first use ("To dissimulate is to pretend.").

### Biblical Typology

Old Testament types may be stated as flat fact without defence or apology: "Pharaoh is a type of Satan. Egypt is a type of the world." Biblical characters may be given modern paraphrased dialogue inside a narrative retelling. Present these as direct declarations, not as scholarly observations.

## 7.5. Scripture Formatting Convention

Scriptures MUST be formatted as block-quoted separate paragraphs. NEVER inline a scripture within a sentence.

**Correct markdown format:**

```markdown
> *And Elisha said, I pray thee, let A DOUBLE PORTION of thy spirit be upon me.*
> -- 2 Kings 2:9

In other words, Elisha was not asking for the same anointing Elijah had carried. He was asking for twice as much.
```

**Rules:**
- Scripture text: `> *` (blockquote + italic)
- Reference line: `> -- ` (blockquote + dash dash space)
- KJV is the unlabelled default. Non-KJV translations must always be labelled after the reference: `> -- Psalm 89:19 (NASB)`
- Permitted alternates (in order of preference): NASB, NLT, NKJV, NIV, AMP, TLB, CEV - always labelled, never as base text
- Blank line before and after every scripture block
- ALL-CAPS on the operative phrase inside the quote is encouraged and expected
- Bracketed plain-word glosses permitted inside quotes: `[strength]`
- Ellipsis-trimming of long verses is normal
- Quoting the same verse in two translations back-to-back is authentic and permitted
- **Verse repetition across chapters is PERMITTED** - a proof text may function as a book-level refrain. Scripture blocks are dedup-exempt and never flagged by the novelty audit

**Introduction is terse** ("Notice the Scripture:", "Paul writes:", "Read this carefully:", or no introduction at all). **Follow-up is mandatory** - every block must be followed within 2 paragraphs by a plain-words restatement or direct application. Never leave a quote uninterpreted (DAG-02).

**WRONG (inline scripture):**
"As Paul says in 1 Thessalonians 5:17, 'Pray without ceasing.'" - inline format is not used in this style.

## 7.6. Pull Quote Marking

Mark 2–3 key statements per chapter as pull-quote candidates. These are standalone sentences that could be displayed as larger centred display text in the final book. Key statements (DAG-04) are the primary candidates.

**Markdown convention:**

```markdown
:::pullquote
Unforgiveness is a poison that you drink yourself, hoping that someone else will die.
:::
```

**What makes a good pull quote:** a single sentence (at most two short sentences) that captures a core truth; standalone meaning without surrounding context; memorable and quotable; not a scripture (scriptures have their own formatting).

**Placement:** spread across the chapter, not clustered. One per 600–1,000 words is a good rhythm.

## 8. Output Format

Write the chapter in markdown and save to `[project_directory]/drafts/ch[NN]-draft.md` (zero-padded chapter number: ch01, ch02, ..., ch10, ch11, etc.).

**Create the `drafts/` directory** if it does not exist (use `mkdir -p`).

The first two lines of every chapter draft MUST be (exact order):

```
<!-- provenance: {source_path}:{line} -->   (source-ingestion projects only; omit in topic-brief mode)
<!-- generated-by: dag-book-crafter v1.1.0 -->
```

Followed by `# Chapter N: Title` on line 3 or later. Both comments are stripped by the formatter before .docx emission.

Full file layout:

```markdown
<!-- provenance: sources/{file}.md:{line} -->
<!-- generated-by: dag-book-crafter v1.1.0 -->
# Chapter [N]: [Title]

[Chapter content - numbered bold point headings or short section headings, scripture blocks, plain declarative prose]

<!-- METADATA
word_count: [actual word count]
target_count: [target from outline]
momentum: [Foundation|Building|Accelerating|Climax|Landing]
opener_type: [anchor_scripture|plain_declaration|definition]
list_structure: [stem: "..." count: N | flowing]
key_statement: [the chapter's key_statement as placed]
scriptures_used: [comma-separated list of references]
pull_quotes: [count of :::pullquote blocks]
testimony: [present | skipped]
testimony_source: [source_path:line OR empty if skipped]
reader_situations_used: ["situation 1", "situation 2"]
provenance: [source_path:line - must match first-line comment, or "topic-brief" if no seed]
-->
```

The `<!-- METADATA -->` block allows the orchestrator and editor to audit chapters without reading full content.

**Word count:** Count actual words in the chapter body (excluding the title heading and the metadata block). Report the accurate count.

**Return a completion summary** to the orchestrator:

"Chapter [N]: [Title] complete. [X] words (target: [Y]). Opener: [type]. Scriptures: [count]. Testimony: [present/skipped]."

## 9. Anti-Patterns

- Do NOT read other chapter drafts - work from Book DNA and research notes only
- Do NOT modify Book DNA, voice-profile.md, chapter-outline.md, or any shared file
- Do NOT open a chapter with a story or narrative - opener must be anchor_scripture, plain_declaration, or definition per DAG-01
- Do NOT leave a scripture block uninterpreted - every quote must be restated in plain words and applied to "you" within 2 paragraphs (DAG-02)
- Do NOT leave an illustration morally ambiguous - state the lesson explicitly at the end as a command or maxim (DAG-08)
- Do NOT fabricate a first-person testimony. If `testimony_seed` is empty, use biblical retelling, everyday analogy, or anonymised third-party anecdote. Fabrication is a DAG-08 hard fail
- Do NOT use more than 1 distinct transliterated Greek or Hebrew term per chapter (DAG-06)
- Do NOT hedge - no "perhaps", "it could be argued", "arguably", "some scholars", "in my view", "one might", "it seems that", "broadly speaking" in author prose (DAG-06 auto-revise)
- Do NOT use meta-scaffolding - never "in this chapter we will...", "in conclusion", "as previously mentioned", "in the next chapter", chapter summaries (DAG-07)
- Do NOT write long unbroken blocks - no stretch beyond ~200 words without a heading, numbered point, scripture block, or one-line punch. Individual paragraphs cap at ~120 words
- Do NOT pad word count - if the argument completes early, stop. Short chapters are authentic (DAG-05)
- Do NOT end on an unresolved note - close with command, benediction, prayer, exclamation, scripture, or the final point's moral. No cliffhangers, teasers, or summary recaps (DAG-07)
- Do NOT spawn subagents - you are already running as a subagent
- Do NOT use vocabulary from the "Avoid" list in the voice profile, even once
- Do NOT write in a detached third-person authorial voice - it is always "I" speaking to "you"
- Do NOT use atmospheric or sensory description for its own sake - concrete declarations and scripture only
- Do NOT use em dashes anywhere in author prose - restructure, or use a comma, full stop, or spaced hyphen (DAG-09 auto-revise)
- Do NOT use more than ONE negation-pivot construction per chapter - "isn't just X, it's Y", "not just/merely/simply", "more than just", "not only... but also", "it's not about X, it's about Y". Say the thing plainly; true antithesis ("bitter or better") is unlimited (DAG-09)
- Do NOT use AI-ism phrases, ever: "delve", "deep dive", "tapestry", "a testament to", "in today's fast-paced world", "game-changer", "it's important to note", "it's worth noting", "at the end of the day", "let's unpack", "let's explore", "embark on", "the landscape of", "navigating the complexities", "elevate your", "unlock the secrets", "a powerful reminder", "moreover", "furthermore", "additionally". Full list in `references/dag-craft-rules.md` § DAG-09. No emoji (DAG-09 auto-revise)
