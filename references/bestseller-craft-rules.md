# Bestseller Craft Rules

> Voice-agnostic procedural rules enforced on every generated chapter. Read by writer (as constraints during drafting) and editor (as checks during Pass 1 and Pass 2). Deterministic checks are handled by `${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js`; judgment checks are handled by the editor LLM.

## Rule Summary

| ID | Rule | Mode | Enforcement |
|---|---|---|---|
| CRAFT-01 | Scene-first opener with provenance comment in first 150 words | deterministic (presence) + LLM (quality) | auto-revise on missing provenance |
| CRAFT-02 | ≤3 transliterated non-English terms per chapter, ≥3 unpacking sentences each | deterministic + LLM | auto-revise on overflow |
| CRAFT-03 | Dominant central image in opening 200 words, middle third, closing 200 words | LLM judgment | flag-only |
| CRAFT-04 | One first-person vulnerability beat in middle third, sourced not fabricated | LLM judgment + provenance resolution | flag-only |
| CRAFT-05 | No banned-start phrases at chapter or paragraph starts | deterministic regex | auto-revise on hit |
| CRAFT-06 | ≥2 concrete reader-moments per chapter, sourced from voice profile Reader Moments section | LLM judgment | flag-only |
| CRAFT-07 | ≥2 italicised/blockquote reader-thought lines per chapter | deterministic regex | flag-only |
| CRAFT-08 | Concrete:abstract noun ratio ≥1:1 over any 4-paragraph window | LLM judgment with lexicon hints | flag-only |

## CRAFT-01 — Scene-First Opener

**Required first line of every chapter draft (provenance comment), one of:**

```
<!-- provenance: sources/{file}.md:{line} -->
<!-- provenance: sources-adapted/{file}.md:{line} -->
<!-- provenance: book-dna.md:{line} -->
<!-- provenance: voice-profile.md:{line} -->
```

**Required within first 150 words:**
1. A named human OR first-person narrator ("I", "me", "my")
2. A time-marker (e.g. "at 2am", "last Tuesday", "the summer I was fourteen")
3. A sensory/physical detail (light, sound, texture, smell, or a specific named object)

**Failure mode:** Missing provenance = auto-revise. Missing any of (1)(2)(3) = flag for LLM review, auto-revise if not resolvable.

## CRAFT-02 — Transliterated Term Density Cap

**Rule:** ≤3 distinct transliterated terms per chapter. Each term must receive ≥3 sentences of unpacking in the same paragraph block.

**Transliterated term lexicon (living — extend as needed):**

charis, agape, phileo, eros, storge, dunamis, exousia, logos, rhema, pneuma, sarx, kairos, chronos, sunergeo, pas, shalom, hesed, chesed, ruach, yada, ahavah, nephesh, echad, koinonia, metanoia

(This list is kept in sync with `scripts/craft-check.js` TRANSLITERATED_TERMS constant — any change here requires the same change in the script.)

**Unpacking requirement markers:** A term is "unpacked" when the following 3 sentences contain ≥1 of: "means", "carries", "literally", "in [language]", "the word", "this is", "it's" (contextual explanation).

**Failure mode:** distinct > 3 → auto-revise. Any term under-unpacked → flag (LLM judgment).

## CRAFT-03 — Central Image Discipline

**Rule:** Outliner assigns one `central_image` per chapter. Writer threads it through three zones:
1. Opening 200 words
2. Middle third of the chapter
3. Closing 200 words

**Failure mode:** Missing from any zone → flag. Forcing rewrites here causes divergent-improvement regression (see 10-RESEARCH §Pitfall 4); editor flags only.

## CRAFT-04 — Vulnerability Beat

**Rule:** Exactly one first-person vulnerability beat (named confession, doubt, or struggle) in the middle third of the chapter, sourced from `vulnerability_beat_seed` (outliner field) — never fabricated.

**Authenticity requirement:** The beat must trace to a source file line, voice profile anecdote, or Book DNA fragment. Fabricated vulnerability = CRAFT-04 fail.

## CRAFT-05 — Pulpit Seam Detection

**Rule:** No paragraph (and no chapter) may START with:

`So`, `Now`, `And so`, `Let us`, `Let me`, `Here's where`, `Here's the thing`, `You see`, `Listen`, `Church`, `Friend`

Detection: case-insensitive, word-boundary, FIRST word(s) of paragraph only. Mid-paragraph occurrences are not flagged.

**Regex (authoritative, matches `scripts/craft-check.js`):**

```
/^(So|Now|And so|Let us|Let me|Here'?s where|Here'?s the thing|You see|Listen|Church|Friend)[\s,.!?]/i
```

**Permitted-usage counter-examples (whitelist — do NOT flag):**
1. Dialogue/quotation: a paragraph that begins with a quoted speaker using the phrase (e.g. `"So," she said, "what do we do?"`)
2. Explicit block quote: markdown blockquote paragraph containing the phrase after `>`
3. Song/scripture citation lines
4. Deliberate fragment used as titled section (headings skipped by checker)
5. Second-person narration inside a remembered scene ("You see the light change" as lived moment)

**Failure mode:** Any unwhitelisted hit → auto-revise that paragraph only; if structural, full chapter.

## CRAFT-06 — Reader Moments

**Rule:** Writer selects ≥2 concrete reader-moments from the voice profile's Reader Moments section per chapter. Each must be specific enough to pass a concreteness test (e.g. "the 2am phone-check" passes; "everyday struggles" fails).

**When voice profile has no Reader Moments section:** CRAFT-06 runs in flag-only mode (no fail).

## CRAFT-07 — Reader-Thought Lines

**Rule:** ≥2 italicised or blockquote-wrapped first-person reader-thought lines per chapter. These are psychological tension, not structural headers.

**Valid form:** `*"But what if grace isn't enough?"*` or `> *"If this is true, why do I still feel empty?"*`

**Regex:**

```
/(?:^>\s*\*"|^\*")[^"*]{5,200}\?["*]/gm
```

## CRAFT-08 — Show Don't Tell Ratio

**Rule:** Over any sliding window of 4 paragraphs, concrete:abstract noun ratio ≥1:1.

**Abstract noun hints:** grace, identity, righteousness, sonship, authority, kingdom, glory, anointing, faith, hope, love, peace, joy, salvation, redemption, sanctification, justification, mercy.

**Concrete noun hints:** chair, coffee, phone, car, door, hospital, kitchen, window, table, street, bed, room, cup, hand, face, eye, voice, book, letter, rain, sunlight.

**Enforcement:** LLM judgment with lexicon hints. Flag-only.

## Cross-Rule Integration

- Deterministic checks (CRAFT-01/02/05/07/15) run via `node ${CLAUDE_PLUGIN_ROOT}/scripts/craft-check.js [chapter-path]` at editor Pass 1 start.
- Judgment checks (CRAFT-03/04/06/08 + CRAFT-01 scene quality) run as LLM sub-sections in editor Pass 1 and Pass 2.
- Auto-revise rules: CRAFT-01 (missing provenance), CRAFT-02 (transliterated overflow), CRAFT-05 (pulpit seam).
- Flag-only rules: CRAFT-03, CRAFT-04, CRAFT-06, CRAFT-07, CRAFT-08.
- Revision cap: 2 per chapter. Divergent improvement (score decreases) → accept previous revision and stop.

## Maintenance

- Changing this file also requires updating: `scripts/craft-check.js` (if regex or lexicon changes), writer SKILL.md and editor SKILL.md (if rule text they cite drifts).
- Target file size: ≤200 lines. Prune ruthlessly.
