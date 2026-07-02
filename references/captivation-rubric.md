---
schema_version: 2
total_range: [0, 16]
components:
  - key: pacing_variety
    label: "Pacing Variety"
    range: [0, 2]
  - key: emotional_connection
    label: "Emotional Connection"
    range: [0, 2]
  - key: reader_engagement
    label: "Reader Engagement"
    range: [0, 2]
  - key: opening_engagement
    label: "Opening Engagement"
    range: [0, 2]
  - key: chapter_ending_momentum
    label: "Chapter-Ending Momentum"
    range: [0, 2]
  - key: craft_density
    label: "Craft Density"
    range: [0, 2]
  - key: cross_chapter_craft
    label: "Cross-Chapter Craft"
    range: [0, 2]
  - key: novelty_variation
    label: "Novelty / Variation"
    range: [0, 2]
dimensions:
  - key: novelty_dedup
    type: binary
    values: [pass, fail]
thresholds:
  sample_gate:
    captivation_total_min: 10
    novelty_dedup: pass
output_fields:
  - captivation_total
  - components
  - novelty_dedup
  - novelty_dedup_flags
  - rewrite_targets
---

# Captivation Rubric

> Captivation scoring for chapter-level quality. 8 components × 0-2 points = 0-16 total. Schema version 2 (Phase 13 — adds Novelty / Variation component and binary novelty_dedup dimension). Invoked by editor Pass 1 (§2.4, §2.5, §2.5.5) and Pass 2 (§3.3, §3.4) — scoring logic lives here as the single source of truth.

> **Rubric extended from 5 to 7 components in CRAFT-10.** Original 5-component scores must remain byte-identical on the baseline fixture per CRAFT-09. The first five component blocks below are locked — they must not be edited, reordered, or moved. Craft Density and Cross-Chapter Craft were appended at the end of the Components section; their scores are additive, not a re-weighting of the originals. Phase 13 extended 7 to 8 components by appending Novelty / Variation; all first-seven component bodies retain their semantic shape but reference 0-16 aggregation instead of 0-14.

## Components

### Pacing Variety

Measure paragraph length distribution across the chapter. Count the number of sentences per paragraph and categorise:
- **Short** (1-2 sentences): impact paragraphs, dramatic beats
- **Medium** (3-4 sentences): explanation, argument development
- **Long** (5-6 sentences): storytelling, scene-setting, extended illustrations

Calculate the dominant category percentage. Flag the chapter if 80% or more paragraphs fall in a single category.

**Scoring:**
- 2 points: Good mix (no category exceeds 60%)
- 1 point: Some variety (dominant category 60-80%)
- 0 points: Monotone (dominant category 80%+)

**Detection approach:** Split chapter text on blank lines to get paragraphs. Count sentences per paragraph (split on `.`, `!`, `?`). Categorise each paragraph. Calculate distribution.

### Emotional Connection

Check for the presence of personal stories, anecdotes, or vulnerability markers in the chapter. Look for indicators:
- Personal pronouns in narrative context: "I remember", "I recall", "I was", "I felt"
- Vulnerability phrases: "I didn't understand", "I failed", "I struggled", "I was wrong"
- Story markers: "there was a time", "picture this", "let me tell you about", "imagine"
- Scene-setting language: specific places, times, sensory details

Flag the chapter if NO vulnerability or personal story markers are found. Every chapter needs at least one human-experience moment per D-13.

**Scoring:**
- 2 points: Personal story/vulnerability present with specific detail
- 1 point: Some emotional connection (general references but no specific story)
- 0 points: No personal stories, anecdotes, or vulnerability markers found

**Soft threshold for teaching-heavy chapters:** A chapter in a "Building" momentum position with complex theological content may score 1 point here without triggering a rewrite. Only score 0 triggers a "significant" flag.

### Reader Engagement

Count instances of direct reader engagement language in the chapter:
- "you" / "your" / "yourself" used in direct address (not quoting scripture)
- Rhetorical questions (sentences ending in `?` that are not scripture)
- "imagine" / "picture" / "consider" as direct invitations

**Scoring:**
- 2 points: Frequent engagement (10+ instances per chapter)
- 1 point: Occasional engagement (3-9 instances)
- 0 points: Absent or rare (0-2 instances)

### Opening Engagement

For each chapter, validate that the first 200 words contain a story, anecdote, or vivid scene -- not a teaching statement, definition, or theological declaration.

**Detection approach:** Read the first 200 words. Check for:
- Story/scene indicators: past tense narrative ("I was sitting", "She walked into"), sensory details, dialogue, specific places/times
- Teaching indicators: present tense declarative statements, definitions ("Grace is..."), "In this chapter" openings, thesis statements

**Scoring:**
- 2 points: Clear story/scene in first 200 words
- 1 point: Some narrative elements but mixed with teaching
- 0 points: Opens with pure theology, definition, or declaration (no narrative)

Flag chapters that score 0 -- they open with teaching instead of story per D-01.

### Chapter-Ending Momentum

For each chapter, check that the ending has either a cliffhanger seed or a reflective landing + forward hook. Read the chapter outline's ending_style field and validate the chapter delivers it.

**Detection approach:** Read the final 150 words. Check for:
- **cliffhanger_seed indicators:** Questions ("But what if...?"), tension points ("There's something we haven't addressed"), preview language ("What comes next changes everything"), unresolved threads
- **reflective_hook indicators:** Reflective/applicational tone in penultimate paragraph, followed by forward-looking language in the final 1-2 sentences ("And that truth? It's just the beginning")

**Scoring:**
- 2 points: Clear ending momentum matching the outline's ending_style
- 1 point: Some forward momentum but doesn't match the specified style
- 0 points: Chapter just stops -- no forward hook, no reflection, no momentum

Flag chapters that score 0 -- they end without any forward momentum per D-02.

### Craft Density

Maps to CRAFT-02/03/04 coverage. Measures how tightly the chapter earns its abstractions — does the scene-first craft actually thread through the whole chapter, or does it only appear at the opener before collapsing into teaching?

Two sub-checks, each worth 1 point:

- **Central image zonal presence (0-1):** Is the chapter's central image (per outline `central_image` field / Book DNA Chapter Map) present in at least two of the three chapter zones — opening (first 200 words), middle (middle third of the chapter body), closing (final 200 words)? One zone only = 0. Two or three zones = 1.
- **Vulnerability beat in middle third with resolved seed (0-1):** Is there an author vulnerability beat (first-person, specific, non-fabricated) in the middle third of the chapter, AND does it trace back to a `vulnerability_beat_seed` pointer (sources/, sources-adapted/, voice-profile.md, or book-dna.md)? Absent or ungrounded = 0. Present AND seeded = 1.

**Scoring:**
- 2 points: Both sub-checks pass
- 1 point: Exactly one sub-check passes
- 0 points: Neither sub-check passes

Half-point increments not allowed — the score is 0, 1, or 2.

Anchor to calibration exemplars at `${CLAUDE_PLUGIN_ROOT}/references/bestseller-calibration.md` § Score Level 3 / 6 / 9 (Craft Density column). Use the exemplars as calibration, not as templates.

### Cross-Chapter Craft

Evaluates cross-chapter coherence of craft rules. Unlike the first six components (which score a single chapter in isolation), this component is evaluated over the whole manuscript — but it is recorded on each chapter's scorecard so Pass 2 and the CRAFT-16 diagnostic step can surface it per chapter.

Two sub-checks, each worth 1 point:

- **Central-image distinctness across chapters (0-1):** Scan every chapter's `central_image` field. If any two chapters have near-identical images (same sensory anchor, same metaphor vehicle), that is a fail — images blur into each other and the reader loses the per-chapter craft signature. All distinct = 1. Any collision = 0.
- **Transliterated-term variety across chapters (0-1):** Scan the transliterated Greek/Hebrew terms actually invoked in each chapter (per CRAFT-02 cap). If the same 3 terms recur in every chapter (lexical fatigue — e.g. charis/pistis/agape in chapters 1-2-3-4-5), that is a fail. Variety across chapters = 1. Same 3 in ≥ 3 chapters = 0.

**Scoring:**
- 2 points: Both sub-checks pass across the manuscript
- 1 point: Exactly one sub-check passes
- 0 points: Neither sub-check passes

Anchor to calibration exemplars at `${CLAUDE_PLUGIN_ROOT}/references/bestseller-calibration.md` § Score Level 3 / 6 / 9 (Cross-Chapter Craft column). This is the only component where a single chapter's score depends on other chapters; editor Pass 2 computes it once and stamps the same value onto every chapter scorecard.

### Novelty / Variation

Measures how VARIED the chapter prose is across a whole-manuscript scan, not just whether craft elements are present. Independent from the binary `novelty_dedup` gate: this component scores on a gradient, the binary gate says whether a hard flag was found. Both exist; both read by the sample gate.

This component is evaluated over the whole manuscript (same as Cross-Chapter Craft) and stamped onto every chapter's scorecard.

**Sub-checks (collapse into one 0-2 score):**

- **Central-image vehicle distinctness at descriptive-phrase level:** Compare each chapter's central_image field AND the actual descriptive prose used to render it in each zone. If any two chapters use the same DESCRIPTIVE VEHICLE (same sensory anchor, same metaphor family — not just concept), this sub-check fails.
- **Cross-artefact 6+ word span dedup:** Scan `front-matter/*.md` + `edited/ch*-final.md`. If any 6+ word span appears in ≥2 files (outside scripture blockquotes and declared refrains within their `max_uses` budget), this sub-check fails.
- **Vulnerability-beat single-location:** Each vulnerability beat (sourced per CRAFT-04) should appear in exactly one artefact. Reuse across foreword and a chapter, or across two chapters, fails this sub-check.

**Scoring:**
- **2 points:** All three sub-checks pass. Vehicles fully distinct per chapter; no 6+ word span repetition across artefacts; vulnerability beats single-location.
- **1 point:** Motif family consistent, vehicles mostly distinct, minor phrase echoes — but every echo falls under a declared refrain in Book DNA's `refrains:` block within its `max_uses` budget.
- **0 points:** Vehicle repetition caught by the central-image vehicle check OR a verbatim 6+ word cross-artefact span caught by Tier 1 OR a vulnerability beat reused across artefacts OR any Tier 2 rule flagged.

Anchor to the Tier 1 and Tier 2 rule sets documented in Editor Pass 3 §4.4.5 Novelty and Dedup Audit. The binary `novelty_dedup` dimension is an independent gate — a chapter can score 0 here AND ship a `novelty_dedup: fail` verdict simultaneously.

**Relationship to the binary `novelty_dedup` dimension:**
The 0-2 `novelty_variation` component contributes to `captivation_total`. The binary `novelty_dedup` is a SEPARATE output field per schema v2 `dimensions` block. The sample release gate requires BOTH `captivation_total >= captivation_total_min` AND `novelty_dedup == pass` — either failing hard-fails the release. This structurally prevents the "14/14 with duplicates ships" failure mode that triggered Phase 13.

## Scoring Aggregation

Each chapter receives a `captivation_total` (0-16) based on eight components (0-2 points each):

| Component | What it measures | Source |
|-----------|-----------------|--------|
| Opening engagement | Story/scene in first 200 words | Pass 2 |
| Ending momentum | Cliffhanger or reflective hook | Pass 2 |
| Pacing variety | Paragraph length distribution | Pass 1 |
| Emotional connection | Personal stories/vulnerability markers | Pass 1 |
| Reader engagement | "you", rhetorical questions, direct address | Pass 1 |
| Craft Density | Central image zonal presence + seeded vulnerability beat | Pass 1 |
| Cross-Chapter Craft | Image distinctness + transliterated-term variety across chapters | Pass 2 |
| Novelty / Variation | Vehicle distinctness + cross-artefact dedup + vulnerability-beat single-location | Pass 3 |

Total range: **0-16**.

**Thresholds (0-16 scale):**

| Total | Band | Meaning |
|-------|------|---------|
| 0-6   | Below craft floor | Chapter requires revision |
| 7-9   | Weak | Ships only if no hard gates fired and momentum position permits |
| 10-12 | Competent | Ships as-is |
| 13-16 | Strong | Bestseller-track quality |

**Momentum-aware threshold:** A chapter in a "Building" momentum position with teaching-heavy content can score in the 7-9 band without triggering a rewrite recommendation. Only chapters in the 0-6 band trigger a "significant" severity flag for captivation specifically.

**Sample release gate (schema v2):** The release gate requires BOTH `captivation_total >= 10` AND `novelty_dedup == pass`. Either failing hard-fails the release. See `skills/sample/SKILL.md §4-§5` for the canonical YAML read.

**Legacy 0-10 reference:** The original five components (Pacing Variety, Emotional Connection, Reader Engagement, Opening Engagement, Chapter-Ending Momentum) still sum to 0-10 at the prose-semantic level and the Phase 7 baseline still holds for that semantic shape. The sha256 lock on those five bodies has been regenerated for Phase 13 because the aggregation prose references 0-16 instead of 0-14; the component bodies themselves retain their original scoring logic.
