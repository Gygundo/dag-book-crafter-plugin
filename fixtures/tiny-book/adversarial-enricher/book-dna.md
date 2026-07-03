<!-- generated-by: dag-book-crafter v1.0.0 -->
<!-- READ-ONLY during parallel chapter generation. Updated only between pipeline stages by the orchestrator. -->

# Book DNA - You Can Be Strong (Enricher Fixture)

> Master context document for the adversarial enricher tier-2 fixture. The edited chapters are clean - tier-1 flaws are absent. Tier-2 flaws are planted only in the enrichments files. This fixture is NEVER shipped in the release zip.

## Metadata

- **Title:** You Can Be Strong
- **Subtitle:** Three Keys to Spiritual Strength
- **Author:** [fixture - no real author]
- **Size tier:** booklet
- **Target word count:** ~3000
- **Chapter count:** 3
- **Created:** 2026-07-02

## Voice Profile

dag-default. See `voice-profile.md` in this fixture directory (copied from `references/voice-profiles/dag-default.md`).

### Tone
Authoritative preacher-teacher, blunt and certain, speaking directly to a believer. Pastoral warmth through relentless direct address, warnings, and blessings.

### Sentence Patterns
Short declarative stacking. Anaphora at high-emotion points. Rhetorical question volleys (3–6 consecutive). Exclamation punchlines closing paragraphs.

### Vocabulary
**Use:** "strength in the Lord", "Watch out for...", "It is time to...", "Decide to...", "May you...", "You must..."
**Avoid:** academic hedging, scholarly apparatus, sensory scene-setting, meta-scaffolding.

## Book Arc

Chapter 1 defines strength. Chapter 2 motivates with three reasons. Chapter 3 gives four practical paths. Understanding to Urgency to Action.

## Chapter Map

- **Ch 1: What It Means to Be Strong**
  - Core point: Strength in the Lord is a capacity built through connection with God, not a feeling you wait for.
  - opener_type: definition
  - Anchor scripture: (none - definition opener)
  - Key scriptures: Ephesians 6:10, Joshua 1:9, Deuteronomy 31:6
  - list_structure: flowing (2–3 short title-case section headings)
  - key_statement: "Strength is a decision before it is a feeling."
  - testimony_seed: (empty - no testimony available; use biblical retelling, everyday analogy, or third-party anecdote)
  - Connects to: Ch 2 (motivation), Ch 3 (action)
  - Momentum position: Foundation

- **Ch 2: Three Reasons Why You Must Be Strong**
  - Core point: God's command, the enemy's strategy, and the needs of those around you all demand that you be strong now.
  - opener_type: anchor_scripture
  - Anchor scripture: Ephesians 6:10
  - Key scriptures: Ephesians 6:10, 1 Peter 5:8, Isaiah 40:29, Hebrews 12:12
  - list_structure: stem "You must be strong because...", count 3
  - key_statement: "God does not command what He does not also enable."
  - testimony_seed: (empty - no testimony available; use biblical retelling, everyday analogy, or third-party anecdote)
  - Connects to: Ch 1 (applies definition), Ch 3 (motivates action)
  - Momentum position: Building

- **Ch 3: Four Ways to Become Strong**
  - Core point: Strength is built through the Word, prayer, fellowship, and tested endurance.
  - opener_type: plain_declaration
  - Anchor scripture: (none - plain declaration opener)
  - Key scriptures: Joshua 1:8, Isaiah 40:31, Hebrews 10:25, Psalm 27:14
  - list_structure: stem "Become strong by...", count 4
  - key_statement: "The believer who builds daily builds permanently."
  - testimony_seed: (empty - no testimony available; use biblical retelling, everyday analogy, or third-party anecdote)
  - Connects to: Ch 1 (builds definition), Ch 2 (implements motivation)
  - Momentum position: Landing

## Refrains

```yaml
refrains:
  - phrase: "Strength is a decision before it is a feeling."
    max_uses: 2
    scope: whole_book
  - phrase: "You must be strong because..."
    max_uses: 3
    scope: chapter_body
  - phrase: "Become strong by..."
    max_uses: 4
    scope: chapter_body
```

## Running Themes

- **Strength as decision:** Introduced Ch 1, applied Ch 2, implemented Ch 3.
- **God's enabling power:** Referenced in all three chapters.

## Key Terms and Jargon

| Term | Definition | First Used |
|------|-----------|------------|
| strength in the Lord | Spiritual capacity to endure, resist, and advance in God's power | Ch 1 |

## Cross-Chapter Continuity

- Ephesians 6:10 is the anchor verse, appearing in Ch 1 and as the opener of Ch 2. Scripture block repetition is EXEMPT from dedup audit.
- "May you..." benediction closes Ch 2 and Ch 3. Benediction formula repetition is EXEMPT from dedup audit.
- List stems are within their declared budgets - EXEMPT from dedup audit.

## Style Rules

- British/SA spelling throughout
- KJV default, unlabelled. Alternates labelled.
- Bold numbered full-sentence point headings for list chapters
- No em dashes; no italics-for-emphasis in prose
