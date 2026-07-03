# Dag Craft Rules

> Voice-agnostic procedural rules enforced on every generated chapter, replacing the bestseller CRAFT-01..08 set with rules derived from an 8-book style analysis of Dag Heward-Mills' published teaching books. Read by writer (as constraints during drafting) and editor (as checks during Pass 1 and Pass 2). Deterministic checks are handled by `${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js`; judgment checks are handled by the editor LLM.

## Rule Summary

| ID | Rule | Mode | Enforcement |
|---|---|---|---|
| DAG-01 | Verse-or-declaration opener - no story/scene openers | deterministic (opener class) + LLM (quality) | auto-revise on story opener |
| DAG-02 | Scripture block density: ≥1 block per 350 words, floor 3 per chapter, KJV default, non-KJV labelled | deterministic + LLM | auto-revise on underflow |
| DAG-03 | List chapters use numbered full-sentence points with parallel stems; count matches title | deterministic + LLM | flag-only |
| DAG-04 | ≥1 standalone key statement per chapter + ≥1 ALL-CAPS emphasis inside a scripture quote | deterministic regex | flag-only |
| DAG-05 | Chapter body 600–2,500 words | deterministic word count | auto-revise on overflow |
| DAG-06 | Plain language: avg author-prose sentence ≤18 words, no hedging phrases, hard words defined | deterministic + LLM | auto-revise on hedging hit |
| DAG-07 | Direct address: ≥8 "you/your" per 1,000 words, ≥3 imperatives, exhortation close (no cliffhangers) | deterministic | flag-only |
| DAG-08 | 1–3 brief functional illustrations, each ≤300 words with lesson stated; first-person testimony ONLY from a sourced seed | LLM judgment + provenance resolution | flag-only |
| DAG-09 | AI-slop scan: no em dashes, ≤1 negation-pivot per chapter, banned AI-ism phrase list, no emoji | deterministic | auto-revise |

## DAG-01 - Verse-or-Declaration Opener

Every chapter opens in one of exactly three ways (per the outline's `opener_type` field):

1. **anchor_scripture** - a block-quoted scripture immediately after the chapter title, key phrase in ALL CAPS inside the quote, followed by a plain declarative sentence orienting the reader to the theme.
2. **plain_declaration** - a flat thesis statement of the chapter's point within the first two sentences ("You must be anointed because no one can fulfil his ministry by natural might.").
3. **definition** - the chapter's key term defined in the first sentence ("Intimidation is the art of deterring or controlling someone through fear."), often announced again later as a refrain.

**Required first lines of every chapter draft (exact format, in order):**

```
<!-- provenance: {source_path}:{line} -->   (source-ingestion projects only; omit in topic-brief mode)
<!-- generated-by: dag-book-crafter v{version} -->
```

**Forbidden opener class:** narrative scene-setting. The first paragraph must NOT begin with a story marker. Deterministic regex (case-insensitive, first words of the first body paragraph):

```
/^(One day|Years ago|I remember|When I was|Once,|Some years ago|There was a time|Picture this|Imagine)/i
```

Stories belong INSIDE numbered points, never at the chapter opening.

**Failure mode:** story-marker opener = auto-revise. Opener not matching the outline's `opener_type` = flag for LLM review.

## DAG-02 - Scripture Block Density (Verse-First Architecture)

**Rule:** The atomic teaching unit is: point heading → scripture block → plain-language restatement → application to "you". Every major point must be anchored to at least one block-quoted scripture.

**Deterministic thresholds:**
- ≥1 scripture block per 350 words of chapter body
- Absolute floor: 3 scripture blocks per chapter
- Every block must carry a reference line

**Block format (markdown):**

```markdown
> *And Elisha said, I pray thee, let a double portion of thy spirit be upon me.*
> -- 2 Kings 2:9
```

Translation is KJV by default and unlabelled. Any non-KJV quote MUST be labelled in the reference line: `> -- Psalm 89:19 (NASB)`. Permitted alternates (in observed order of frequency): NASB (preferred), NLT, NKJV, NIV, AMP, TLB, CEV - always labelled, never as base text. Quoting the same verse in two translations back-to-back is authentic and permitted.

**ALL-CAPS emphasis inside quotes** is permitted and encouraged - capitalise the load-bearing phrase the point hangs on: `> *be ye stedfast, UNMOVEABLE, always abounding in the work of the Lord*`.

**Verse repetition across chapters is PERMITTED** - a proof text may function as a refrain (this differs deliberately from bestseller craft). Scripture blocks are excluded from the novelty/dedup audit.

**Follow-up requirement (LLM):** every block must be followed within 2 paragraphs by a plain-words restatement or direct application. Never leave a quote uninterpreted.

**Failure mode:** density underflow = auto-revise. Unlabelled non-KJV or uninterpreted block = flag.

## DAG-03 - Numbered Points with Parallel Stems

**Rule:** Chapters designated as list chapters in the outline (`list_structure` field) are built as numbered points:

- Numbered `1.`, `2.`, ... with the **entire point sentence in bold as the heading** - a complete declarative or imperative sentence, not a label ("**3. Develop steadfastness by allowing yourself to be corrected.**")
- **Parallel stems:** every point in the list reuses the same grammatical frame, declared in the outline as the `stem` (e.g. "Do not be intimidated from preaching against disloyalty because..."). Vary only the completion.
- **Counted titles:** when the chapter title declares a count ("Seven Ways to Deal with Familiarity"), the number of points MUST match the count.
- Point body follows the atomic unit of DAG-02 (scripture, restatement, application, optional illustration). A point MAY stand alone as a single bold sentence with no body - that is authentic to the style.
- Sub-lists use letters (a., b., c.).
- Interior counted headings are permitted mid-chapter ("Six Reasons Why You Must Strengthen Yourself").

**Refrain interaction:** the outliner MUST declare each list chapter's stem in the Book DNA `refrains:` block (scope: `chapter_body`, max_uses: the point count) so the dedup audit does not flag deliberate parallelism.

**Non-list chapters** (`list_structure: flowing`) use short, centred, title-case section headings instead ("Notice These Signs", "Sitting in My Chair") - 2–4 per chapter.

**Failure mode:** count mismatch with title = flag. Broken parallelism (stem drift across points) = flag.

## DAG-04 - Key Statement Emphasis

**Rule:** Each chapter must carry the repeatable one-line maxims that make this style quotable:

1. **≥1 standalone key statement** - a single-sentence paragraph stating the chapter's core truth as an aphorism ("The anointing is not something you learn, it is something you catch."). The chapter's primary key statement comes from the outline's `key_statement` field and may be repeated verbatim within the chapter (declare in refrains if reused across chapters).
2. **≥1 ALL-CAPS phrase inside a scripture block** (see DAG-02).
3. **Definition refrains:** if the chapter defines a term, the definition may be restated verbatim later ("Do not forget the definition of intimidation: ...").

**Deterministic regexes:**

```
Key statement:   /^[A-Z][^\n]{20,160}[.!]$/m   (single-sentence paragraph, flagged by editor for aphorism quality)
CAPS-in-quote:   /^>.*\b[A-Z]{3,}(?:[ ,][A-Z]{2,}){2,}/m
```

**Failure mode:** flag-only.

## DAG-05 - Short Chapter Discipline

**Rule:** Chapter length is driven by the point list, not a fixed shape - in the analysed corpus chapters range from ~400 words (a bare list) to ~7,000 (a 20-point list chapter), with a median of ~1,500–2,500. The chapter body (excluding title heading and METADATA block) must stay within **the outline's per-chapter target ±50%**, with an absolute default cap of **2,500 words for booklet tier** and 4,000 words for short/standard tiers unless the outline explicitly assigns a large point-count chapter a higher target.

**If the argument completes early:** stop. Single-sentence points and very short chapters are authentic. Never pad.

**If the chapter runs long:** tighten, or recommend a split into two chapters to the orchestrator. Chapter length imbalance across the book is authentic and acceptable - a 700-word chapter may sit beside a 3,000-word one.

**Failure mode:** > target+50% (or > tier cap) = auto-revise (tighten or split). < 400 words = flag (may be legitimate for a bare list chapter).

## DAG-06 - Plain Language

**Rule:** The prose reads at roughly grade 6–8 level. Complexity lives only inside KJV quotes.

- **Average author-prose sentence length ≤18 words** (computed excluding blockquote lines and headings). Base rhythm: short declarative stacking, subject-verb-object.
- **No academic hedging.** Banned phrases (deterministic, case-insensitive, word-boundary anchored, author prose only - note the trailing `\b` so authentic phrases like "Many believers" do not false-positive):

```
/\b(some scholars|it could be argued|arguably|studies suggest|research shows|one might|it seems that|in my view|perhaps we might|broadly speaking|to some extent|many believe)\b/i
```

- **Hard words defined immediately:** any uncommon term gets a one-sentence plain definition in the same paragraph ("To dissimulate is to pretend.").
- **Transliterated Greek/Hebrew:** maximum 1 distinct transliterated term per chapter, and only as a simple gloss ("'Aman' means 'to nurture', 'to foster as a parent'") - never an academic word study. Term lexicon shared with `scripts/craft-check.js`.
- British/SA spelling by default (honour, favour, realise, whilst).

**Failure mode:** hedging hit = auto-revise that sentence. Sentence-length overflow = flag. >1 transliterated term = auto-revise.

## DAG-07 - Direct Address and Exhortation Close

**Rule:** The book speaks TO the reader as a preacher, not a narrator.

- **≥8 instances of "you/your/yourself" per 1,000 words** of author prose (scripture excluded).
- **≥3 imperative commands per chapter** ("Decide to become an anointed person.", "Watch out for...", "Refuse to be intimidated.").
- **Rhetorical question volleys** (3–6 consecutive questions) are a signature device - target ≥4 questions per chapter (corpus median is 7–15).
- **Vocatives:** "Dear friend," / "Dear Christian friend," / role-specific "Dear pastor," "Dear leader," sparingly (roughly once every 2–3 chapters, never "beloved").
- **Preacher paragraph-openers are PERMITTED and authentic:** "You see,", "Notice how...", "In other words,", "Listen,", plus evaluative adverb openers ("Indeed,", "Sadly,", "Amazingly,", "Unfortunately,"). This deliberately inverts the bestseller pulpit-seam ban - the seam IS the style.
- **Chapter close = landing, never cliffhanger.** The final paragraph must end with one of: a direct command, a benediction ("May you..."), a prophetic declaration ("I see your ministry growing..."), a prayer (ending "Amen"), an exclamation of encouragement, a scripture block, or the final point's stated moral. Chapters simply stop after the final point lands - no summary recap, no "in the next chapter" teaser, no unresolved tension.

**Deterministic checks:** you-density count; imperative count (sentence-initial verb heuristic); question count; cliffhanger scan of final paragraph (banned: "in the next chapter", "we will see", "but that is another", "what comes next", "we have not talked about", "there is something we", trailing ellipsis, question as final sentence of the chapter).

**Failure mode:** flag-only.

## DAG-08 - Functional Illustrations

**Rule:** 1–3 brief illustrations per chapter, chosen from these types:

1. **First-person testimony** - ONLY when the outline provides a `testimony_seed` (`source_path:line` pointing at real source material supplied by the user). Opens with a time-marker formula ("Years ago, ...", "One day, ...", "When I was in secondary school..."). **NEVER fabricate a first-person testimony** - a generated book must not invent the author's life. No seed = use types 2–4 instead.
2. **Biblical narrative retelling** - compressed to a paragraph or two, with colloquial modern colour permitted (Bible characters may speak in modern paraphrase).
3. **Everyday analogy** - concrete, mechanical, often with arithmetic (the ship's provisions, the electrical socket, the surgeon's "watch one, assist one, do one").
4. **Third-party anecdote** - brief, anonymised ("I once spoke with a minister who...").

**Constraints:**
- Each illustration ≤300 words.
- Introduced abruptly with a formula opener - no literary scene-setting, no sensory description for its own sake.
- **The lesson is always stated explicitly** at the end of the story, as a command or maxim ("This is where I learnt the importance of strength!").
- Antagonists always anonymised ("a certain pastor", "this chap").

**Failure mode:** fabricated first-person testimony (no resolvable seed) = hard fail, auto-revise to a type 2–4 illustration. Missing lesson statement = flag.

## DAG-09 - AI-Slop Scan

**Rule:** Generated prose must not carry the telltale constructions of machine writing. All checks apply to **author prose only** (scripture blockquotes excluded - the KJV itself uses "furthermore"; a quoted translation may contain an em dash). Case-insensitive, word-boundary anchored.

### 1. Em dashes - banned outright

No em dash (`—`, U+2014) and no spaced en dash used as one (` – `) anywhere in author prose, headings included. Restructure the sentence, or use a comma, a full stop, or a spaced hyphen (` - `). Unspaced en dashes in ranges ("2–4 questions") are permitted.

```
/—| – /
```

**Failure mode:** any hit = auto-revise.

### 2. Negation-pivot constructions - capped at 1 per chapter

The "this isn't just X, it's Y" family. One instance per chapter is the ceiling; genuine antithesis without the pivot words ("Persecution makes you either bitter or better.") is unlimited and encouraged.

Counted patterns (summed):

```
/\b(is not|isn't|was not|wasn't|are not|aren't|does not|doesn't)\s+(just|merely|simply)\b/i
/\bnot\s+(just|merely|simply)\s/i
/\bmore than just\b/i
/\bnot only\b[^.!?\n]{0,80}\bbut also\b/i
/\bit('|i)s not about\b[^.!?\n]{0,80}\bit('|i)s about\b/i
```

**Failure mode:** count ≤1 = pass. count ≥2 = auto-revise (rewrite the excess as plain declarations).

### 3. Banned AI-ism phrases - zero tolerance

```
delve, delves, delving, deep dive, dive into, dives into, diving into,
tapestry, a testament to, stands as a testament,
in today's fast-paced world, in today's world, in an era of, in a world where,
game-changer, game changing, transformative power,
it is important to note, it's important to note, it is worth noting, it's worth noting,
at the end of the day, let's unpack, let us unpack, let's explore, let us explore,
in conclusion, embark on, embarking on, the landscape of,
navigating the complexities, elevate your, unlock the secrets, supercharge,
a powerful reminder, moreover, furthermore, additionally
```

(Kept in sync with the `SLOP_PHRASES` constant in `scripts/craft-check.js` - any change here requires the same change in the script.)

Deliberately NOT banned (authentic to the voice and to Christian writing generally): "the power of God", "journey", "unpack" as a bare verb in exegesis, "profound", antithesis and anaphora of every kind.

### 4. Emoji - banned

```
/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
```

**Failure mode for 3 and 4:** any hit = auto-revise.

## Cross-Rule Integration

- Deterministic checks (DAG-01/02/04/05/06/07/09 + version stamp) run via `node ${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js [chapter-path]` at editor Pass 1 start.
- Judgment checks (DAG-01 opener quality, DAG-02 follow-up, DAG-03 parallelism, DAG-08) run as LLM sub-sections in editor Pass 1 and Pass 2.
- Auto-revise rules: DAG-01 (story opener), DAG-02 (density underflow), DAG-05 (overflow), DAG-06 (hedging, transliteration overflow), DAG-08 (fabricated testimony), DAG-09 (em dash, slop phrase, emoji, ≥2 negation-pivots).
- Flag-only rules: DAG-03, DAG-04, DAG-07.
- Revision cap: 2 per chapter. Divergent improvement (score decreases) → accept previous revision and stop.
- **Dedup interaction:** scripture blocks, declared refrains (list stems, key statements, definitions), and benediction formulas ("May you...") are exempt from the 6+ word cross-artefact dedup. Everything else still must not repeat.

## Maintenance

- Changing this file also requires updating: `scripts/craft-check.js` (if regex or thresholds change), writer SKILL.md and editor SKILL.md (if rule text they cite drifts).
- Target file size: ≤220 lines. Prune ruthlessly.
