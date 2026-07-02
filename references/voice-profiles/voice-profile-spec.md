# Voice Profile Specification

> Every voice profile (.md file in references/voice-profiles/) must follow this structure.
> The outliner validates profiles against this spec and fills missing optional sections with defaults.

## Required Sections

A voice profile is valid when sections 1-5 are present and non-empty.

### 1. Tone
Overall tonal quality. Describe the voice's character: bold/gentle, direct/reflective, formal/conversational, authoritative/exploratory. At least 2-3 sentences.

### 2. Sentence Patterns
Rhythm and structure guidance. Include:
- Average sentence length target
- Fragment usage (frequent/rare/never)
- Rhetorical question usage
- Repetition patterns
- Intensity building patterns

### 3. Vocabulary
Split into two subsections:

#### Use
Words, phrases, and language patterns characteristic of this voice. At least 5 examples.

#### Avoid
Words, phrases, and patterns that break this voice. At least 5 examples.

### 4. Emphasis Techniques
How the voice creates impact. At least 3 techniques with brief descriptions.

### 5. Anti-Patterns (Never Do This)
Behaviours that break the voice. At least 3 anti-patterns. These are the guardrails that prevent voice drift during parallel chapter generation.

## Optional Sections

### 6. Theological/Domain Framework
Interpretive lens for domain-specific content. Required for theological books. Contains the core beliefs, doctrinal positions, or domain expertise that shape content decisions. Omit for genre-neutral profiles.

### 7. Scripture Handling
Translation defaults, quoting style, citation conventions. Only for profiles that reference religious texts. Omit for secular profiles.

### 8. Reader Moments (recommended, optional for custom profiles)

A bulleted list of **at least 12 concrete everyday scenes** grouped by mood (anxiety, grief, doubt, joy, etc.). Writer selects ≥2 per chapter for CRAFT-06 enforcement — these moments anchor abstract theological or conceptual claims to experiences the reader has actually lived.

**Structure:** A `## Reader Moments` heading followed by `### [Mood]` subheadings. Each mood contains 2-4 one-line bullets describing a specific scene. Aim for ≥12 moments across ≥3 mood categories.

**Recommended for:** spiritual, pastoral, self-help, memoir, and any voice profile that will be used for CRAFT-06-enforced book projects.

**When absent from a profile:** Editor runs CRAFT-06 in flag-only mode — no hard fail, no auto-revise. Diagnostic report still notes missing reader-moment citations but the pipeline proceeds.

See `references/voice-profiles/spiritual-default.md` § Reader Moments for an example.

## Validation Rules

- Missing required section (1-5): WARN user, fill with "[Not specified -- using neutral, clear prose]" marked with <!-- DEFAULT -->
- Missing optional section (6-7): No warning, omit from Book DNA
- Empty required section (heading present but no content): Same as missing -- WARN and fill default
- Profile without any headings: REJECT -- not a valid voice profile

## Section Mapping to Book DNA

| Voice Profile Section | Book DNA Section |
|----------------------|------------------|
| Tone | Voice Profile > Tone |
| Sentence Patterns | Voice Profile > Sentence Patterns |
| Vocabulary | Voice Profile > Vocabulary |
| Emphasis Techniques | Voice Profile > Emphasis Techniques |
| Theological/Domain Framework | Theological/Domain Framework |
| Anti-Patterns | (Embedded in voice instructions to agents, not a separate Book DNA section) |
| Scripture Handling | Style Rules (merged) |
