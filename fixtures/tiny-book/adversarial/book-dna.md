<!-- generated-by: dag-book-crafter v1.0.0 -->
<!-- READ-ONLY during parallel chapter generation. Updated only between pipeline stages by the orchestrator. -->

# Book DNA — You Can Be Strong

> Master context document for the adversarial tier-1 fixture. Every chapter agent reads this document at draft time. This fixture is NEVER shipped in the release zip — `scripts/release.sh` Gate 3b asserts the adversarial directory did not leak into staging.

## Metadata

- **Title:** You Can Be Strong
- **Subtitle:** Three Keys to Spiritual Strength
- **Author:** [fixture — no real author]
- **Size tier:** booklet
- **Target word count:** ~3000
- **Chapter count:** 3
- **Created:** 2026-07-02

## Voice Profile

dag-default. See `references/voice-profiles/dag-default.md` for full profile.

### Tone
Authoritative preacher-teacher, blunt and certain, speaking directly to a believer who wants what the book offers. Pastoral warmth through relentless direct address, warnings, and blessings — never sentiment.

### Sentence Patterns
Short declarative stacking. Anaphora at high-emotion points. Rhetorical question volleys (3–6 consecutive). Exclamation punchlines closing paragraphs.

### Vocabulary
**Use:** "the anointing", "man of God", "the ministry", "strength in the Lord", "the power of his might", "do not be intimidated", "Watch out for...", "It is time to...", "Decide to...", "May you...", "I see you..."
**Avoid:** academic hedging, scholarly apparatus, irony, sensory scene-setting for its own sake, meta-scaffolding.

## Book Arc

Chapter 1 defines strength so the reader knows what is being built. Chapter 2 provides motivation — three compelling reasons why the reader has no choice but to be strong. Chapter 3 hands the reader four actionable paths to strength. The arc moves from understanding through urgency to action.

## Chapter Map

- **Ch 1: What It Means to Be Strong**
  - Core point: Strength is not a feeling you wait for — it is a decision you make, then a capacity you build.
  - opener_type: definition
  - Anchor scripture: (none — definition opener; Ephesians 6:10 used mid-chapter)
  - Key scriptures: Ephesians 6:10, Deuteronomy 31:6, Joshua 1:9
  - list_structure: flowing (2–3 short title-case section headings)
  - key_statement: "Strength is a decision before it is a feeling."
  - testimony_seed: (empty — no testimony available; use biblical retelling, everyday analogy, or third-party anecdote)
  - Connects to: Ch 2 (motivation to act on Ch 1 definition), Ch 3 (builds on both)
  - Momentum position: Foundation

- **Ch 2: Three Reasons Why You Must Be Strong**
  - Core point: Scripture, the enemy's activity, and the needs of those around you all demand that you be strong now.
  - opener_type: anchor_scripture
  - Anchor scripture: Ephesians 6:10
  - Key scriptures: Ephesians 6:10, 1 Peter 5:8, Isaiah 40:29
  - list_structure: stem "You must be strong because...", count 3
  - key_statement: "You cannot have victory unless you first decide to be strong."
  - testimony_seed: (empty — no testimony available; use biblical retelling, everyday analogy, or third-party anecdote)
  - Connects to: Ch 1 (applies the definition), Ch 3 (motivates the four ways)
  - Momentum position: Building

- **Ch 3: Four Ways to Become Strong**
  - Core point: Strength is grown through prayer, the Word, fellowship, and tested endurance.
  - opener_type: plain_declaration
  - Anchor scripture: (none — plain declaration opener)
  - Key scriptures: Isaiah 40:31, Psalm 27:14, Joshua 1:8, Hebrews 10:25
  - list_structure: stem "Become strong by...", count 4
  - key_statement: "Unless you decide to be strong, you cannot have victory."
  - testimony_seed: (empty — no testimony available; use biblical retelling, everyday analogy, or third-party anecdote)
  - Connects to: Ch 1 (applies the definition), Ch 2 (implements the motivation)
  - Momentum position: Landing

## Refrains

```yaml
refrains:
  - phrase: "Strength is a decision before it is a feeling."
    max_uses: 1
    scope: whole_book
  - phrase: "You must be strong because..."
    max_uses: 3
    scope: chapter_body
  - phrase: "Become strong by..."
    max_uses: 4
    scope: chapter_body
```

## Running Themes

- **Strength as decision:** Introduced Ch 1, applied Ch 2 (motivation to decide), implemented Ch 3 (decision expressed in four actions).
- **God's enabling power responding to human decision:** Referenced throughout all three chapters.

## Key Terms and Jargon

| Term | Definition | First Used |
|------|-----------|------------|
| strength in the Lord | The capacity to endure, resist, and advance in God's power rather than natural ability | Ch 1 |

## Cross-Chapter Continuity

- Ephesians 6:10 functions as the book's anchor verse — appears in Ch 1 and as the opener in Ch 2. Scripture block repetition is EXEMPT from dedup audit.
- "May you..." benediction closes Ch 2 and Ch 3. Benediction formula repetition is EXEMPT from dedup audit.
- The list stem "You must be strong because..." recurs three times in Ch 2 (max_uses: 3, within budget — EXEMPT). The list stem "Become strong by..." recurs four times in Ch 3 (max_uses: 4, within budget — EXEMPT).

## Style Rules

- British/SA spelling throughout: honour, favour, realise, whilst, practise, programme
- KJV default, unlabelled. Alternates labelled: NASB preferred, then NLT, NKJV, NIV, AMP, TLB
- Bold numbered full-sentence point headings for list chapters; short title-case section headings for flowing chapters
- Scripture as blockquotes with reference lines; no em dashes; no italics-for-emphasis in prose
- Target words per chapter: ~1000 words each (booklet tier — imbalance acceptable)
