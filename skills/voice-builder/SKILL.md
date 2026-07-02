---
name: voice-builder
description: "Analyse a directory of markdown files to generate a custom voice profile. Can be invoked standalone or through the orchestrator during voice selection. Triggers on: 'build voice profile', 'analyse my writing', 'extract voice', 'voice from my content', 'generate voice profile'."
user-invocable: true
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Voice Builder

Analyses a directory of markdown files to extract the author's unique voice characteristics, then generates a custom voice profile conforming to `voice-profile-spec.md`. The generated profile is immediately usable by the book pipeline -- the orchestrator, writer agents, and editor all read it as-is.

This skill operates in two modes:
- **Standalone:** User invokes `dag-book-crafter:voice-builder` directly, pointing it at a directory of their writing. The profile is saved to `references/voice-profiles/` for future use.
- **Orchestrator-integrated:** During voice selection, the orchestrator offers "Build from source material" as an option. When selected, it invokes this skill, then resumes the pipeline with the generated profile.

## 1. On Invocation

Accept from the user (or orchestrator via `$ARGUMENTS`):

- **Required:** A directory path containing source material (markdown files). This is typically an Obsidian vault, a content folder, or any directory of `.md` files.
- **Optional:** A preferred profile name. If not provided, the builder auto-generates a name (see Section 7).

**Input constraint:** Only `.md` files are supported. If the user provides a path to a `.docx`, `.txt`, `.pdf`, or other non-markdown file, respond:

> "The voice builder analyses markdown (.md) files only. If your source material is in another format, please convert it to markdown first. Obsidian vaults work out of the box since they're already markdown."

Do not attempt to parse or convert non-markdown files.

## 2. Corpus Assessment

Before analysis, assess whether the source material is sufficient for confident voice extraction.

**Step 1: Discover files**

Use Glob to find all `**/*.md` files recursively in the provided directory.

**Step 2: Measure corpus size**

Use Bash to count total files and total word count:

```bash
find [directory] -name "*.md" -type f | wc -l
find [directory] -name "*.md" -type f -exec cat {} + | wc -w
```

**Step 3: Assign confidence tier**

| Tier | Criteria | Action |
|------|----------|--------|
| **HIGH** | 10,000+ words AND 5+ files | Proceed without warnings. All profile sections generated with full confidence. |
| **MEDIUM** | 5,000-10,000 words OR 3-4 files | Warn the user: "Your corpus is below the recommended size (5+ files, 10,000+ words). I'll proceed but some profile sections may be marked `<!-- INFERRED -->` where confidence is lower. For best results, add more source material." |
| **LOW** | Under 5,000 words OR 1-2 files | Warn the user: "Your corpus is quite small. All profile sections will be marked `<!-- INFERRED -->`. I recommend adding more source material for a more accurate profile." |

**Step 4: Analyse everything**

Analyse ALL `.md` files in the directory. Do not filter out short files, outlines, rough notes, or incomplete drafts. Every file is treated as representative of the author's voice. The analysis handles noise by looking for patterns that recur across multiple files -- single-file quirks are naturally de-emphasised.

## 3. Pass 1 -- Statistical Extraction

Read source files in batches of 3-5 files at a time to manage context window usage. For each batch, extract patterns across four categories. After processing all batches, aggregate findings into a structured intermediate summary held in working memory.

### Category 1: Sentence Patterns and Rhythm

- **Average sentence length:** Count words per sentence across sampled paragraphs (sample at least 10 paragraphs per batch).
- **Sentence length distribution:** Percentage of short (<8 words), medium (8-20 words), and long (20+ words) sentences.
- **Fragment usage:** Frequency of sentences without a verb, under 5 words. Note whether fragments are used for emphasis, transition, or both.
- **Rhetorical questions:** Count per 1,000 words. Note whether they open paragraphs, close paragraphs, or appear mid-flow.
- **Repetition patterns:** Look for anaphora (repeated sentence starts), epistrophe (repeated endings), and parallel structures. Note frequency and contexts.
- **Intensity building:** Do paragraphs escalate in force? Do sections build to punchy conclusions? Note the pattern: gradual build vs sudden punch vs steady rhythm.

### Category 2: Vocabulary and Word Choice

- **Distinctive words:** Identify the 15-20 most frequent words that are NOT common stop words (the, a, is, it, and, but, in, to, of, etc.). These are the author's signature vocabulary.
- **Characteristic phrases:** 2-3 word combinations that recur across multiple files. These are the author's verbal fingerprints.
- **Register assessment:** Formal (passive voice, complex clauses, hedging language), conversational (contractions, direct address, fragments, first/second person), or mixed. Quantify: percentage of paragraphs with contractions, percentage with direct reader address ("you").
- **Domain-specific terminology:** Theological terms, leadership jargon, technical vocabulary, or niche language that reveals the author's domain.
- **Notable absences:** Words or constructions the author never uses despite having opportunities. These become the "Avoid" list.

### Category 3: Tone and Emotional Register

- **Directness:** Ratio of declarative statements to hedged or qualified statements. Count hedging markers: "perhaps", "might", "could be", "some would say", "it seems".
- **Emotional warmth:** Frequency of personal pronouns (I, we, you), vulnerability markers ("I struggled with", "I didn't understand", "I failed"), and personal anecdotes.
- **Authority posture:** How often the author asserts (bold claims) vs explores (questions and ponderings) vs qualifies (hedges and caveats). Categorise as: authoritative, exploratory, balanced, or tentative.
- **Formality spectrum:** Contractions frequency, slang or colloquialisms, formal diction, sentence complexity.
- **Humour and wit:** Present or absent. If present: self-deprecating, observational, wordplay, sarcasm, dry wit. Note frequency (rare, occasional, frequent).

### Category 4: Structural Patterns

- **Paragraph length:** Average sentences per paragraph. Note whether the author uses single-sentence paragraphs for emphasis.
- **Argument building:** Deductive (claim then evidence), inductive (evidence then claim), or narrative (story then insight). Categorise the dominant pattern and note any secondary patterns.
- **Transition patterns:** Explicit connectors ("However", "Therefore", "Furthermore") vs implicit flow (new paragraph, new idea, reader infers connection). Count explicit transition words per 1,000 words.
- **Story and anecdote frequency:** How often personal stories, illustrations, or examples appear. Count per file or per 1,000 words.
- **Emphasis techniques:** Use of bold text, italics, repetition, short standalone sentences, exclamation marks, capitalisation for emphasis. Note which techniques are frequent vs rare.

### Aggregation

After all batches are processed, aggregate the per-batch findings into a single intermediate summary. For numerical metrics, calculate means and note the range. For categorical findings, note the dominant pattern and any significant variation. This summary is the input for Pass 2 -- it is not written to disk.

For very large directories (100+ files), process in batches and aggregate incrementally. Never attempt to read all files at once.

## 4. Pass 2 -- Profile Synthesis

Using the Pass 1 intermediate summary, generate each section of the voice profile. Every claim must be backed by specific evidence from Pass 1. Generic descriptions are not acceptable -- the profile must reflect THIS author's ACTUAL voice.

### Output File Structure

```markdown
# Voice Profile: [Auto-Generated Name]

> Built from [N] source files ([M] words) in [directory path].
> Generated by dag-book-crafter:voice-builder on [YYYY-MM-DD].

<!-- Validated against voice-profile-spec.md. All required sections (1-5) present. -->
```

### Required Sections

**## Tone**

Synthesise from Category 3 (Tone and Emotional Register) findings. Use specific evidence:
- "Bold and direct -- 73% of statements are declarative with no hedging."
- "Warm -- personal pronouns appear every 2-3 sentences on average."
- "Conversational register -- contractions in 82% of paragraphs."

Do not write generic tone descriptions. Every adjective must be backed by a number or pattern from Pass 1.

**## Sentence Patterns**

Synthesise from Category 1 (Sentence Patterns and Rhythm). Include specific metrics:
- Average sentence length (word count)
- Sentence length distribution percentages (short/medium/long)
- Fragment usage frequency and purpose
- Rhetorical question frequency
- Repetition patterns with examples
- Intensity building patterns

Format as actionable instructions: "Average sentence length: 14 words. Use fragments (18% of sentences) for emphasis after key claims. Rhetorical questions: 2-3 per 1,000 words, primarily to open new sections."

**## Vocabulary**

**### Use**

From Category 2, list 10-15 characteristic words and phrases. For each, include at least one example from the source material showing the word in context:
- "declares" -- "The finished work declares your identity" (from notes-on-grace.md)
- "picture this" -- recurring phrase in 4 of 7 files, used to set up illustrations

**### Avoid**

Infer from what the author does NOT do (Category 2 notable absences plus anti-patterns from Category 3). List at least 5 items with reasoning:
- Academic hedging ("some scholars believe", "it could possibly mean") -- author never hedges; 94% of claims are direct assertions
- "Firstly, secondly, thirdly" -- author uses narrative flow, never numbered arguments

**## Emphasis Techniques**

From Categories 1 and 4 combined. List 4-6 techniques with brief descriptions and source examples:
- **Short standalone sentences after flowing paragraphs** -- "That's the truth." appears 3 times across 5 files, always following a longer explanatory paragraph
- **Repetition for emphasis** -- Key phrases restated in slightly different words, stacking weight

**## Anti-Patterns (Never Do This)**

Based on what the source voice is NOT. List 4-6 guardrails:
- Anything the author consistently avoids (from Category 2 notable absences)
- Tonal opposites of the detected tone (if the author is conversational, academic lecture tone is an anti-pattern)
- Structural patterns absent from the source (if the author never uses numbered lists, that is an anti-pattern)

Each anti-pattern should include a brief "because" explaining why it violates this specific voice.

### Optional Sections

**## [Domain] Framework**

Only include if domain was detected AND user confirmed (see Section 6). Extract the domain-specific beliefs, positions, or framework from the source material. Use the same structure as the dag-default.md Theological/Domain Framework section: a bulleted list of core positions with brief explanations.

**## Reader Situations**

Always include this section when the corpus supports it. It enables DAG-07 enforcement in the editor -- the writer selects ≥2 concrete reader situations per chapter to anchor direct address and application commands.

During Pass 1 corpus analysis, extract concrete ministry and Christian-life situations the source material mentions or implies. Group them by category: ministry and calling, Christian living, warning situations, and any others that emerge from the corpus. Each situation must be a specific lived scenario (e.g. "the associate pastor tempted to criticise his senior in private", "the believer too busy to pray who checks the clock five minutes in") -- not an abstract feeling.

**Target output:** ≥12 situations across ≥3 categories. Format as a `## Reader Situations` section with `### [Category]` subheadings, matching the schema in `references/voice-profiles/voice-profile-spec.md` § 8 and the example shape in `references/voice-profiles/dag-default.md` § Reader Situations.

**Partial-corpus fallback:** If the source corpus does not yield enough concrete situations (fewer than 8), emit the `## Reader Situations` section with whatever was found and append an HTML comment: `<!-- reader_situations_partial: only N situations extracted from corpus; editor runs DAG-07 in flag-only mode -->`. The editor will honour that marker and skip hard-fail on DAG-07 for books generated with this profile.

**No-corpus fallback:** If fewer than 3 concrete situations can be extracted, omit the section entirely. Custom profiles without Reader Situations cause the editor to run DAG-07 in flag-only mode automatically (per voice-profile-spec.md § 8).

**## Calibration Examples**

Always include this section. It is the most powerful tool for maintaining voice consistency across parallel chapter agents.

**### Target Quality**

Select 3 passages (100-200 words each) from the source material, verbatim. Each should demonstrate a different aspect of the voice:
1. One showing characteristic tone and emotional register
2. One showing sentence rhythm and structural patterns
3. One showing vocabulary and emphasis techniques

Format each as:
```
**Example [N]: [What this demonstrates]**
> [Verbatim passage from source]
> -- From [filename]
```

**### What to Avoid**

Generate 3 synthetic counter-examples (100-150 words each) that show what this voice is NOT. Label each with the specific drift type:

1. **WRONG -- Academic drift:** Rewrite a source passage in formal academic style to show the contrast
2. **WRONG -- Generic AI drift:** Rewrite a source passage in bland, balanced, hedged AI voice
3. **WRONG -- Opposite-tone drift:** Write a passage that is the tonal opposite of the detected voice (e.g., if the author is bold, write something tentative)

### Confidence Marking

- **MEDIUM confidence corpus:** Mark any section where the supporting evidence comes from fewer than 3 files with `<!-- INFERRED -->` after the section heading.
- **LOW confidence corpus:** Mark ALL sections with `<!-- INFERRED -->` after the section heading.
- **HIGH confidence corpus:** No markers needed.

## 5. Domain Framework Auto-Detection

Before presenting the review summary, scan the Pass 1 findings for domain signals. Check for the following domains:

**Theological:** Scripture references (book chapter:verse patterns), theological terms (grace, covenant, faith, salvation, kingdom, redemption, sanctification, righteousness, atonement, justification), prayer language. **Threshold:** 5+ theological terms found across 3+ files.

**Leadership:** Management and organisational terminology (team, strategy, vision, execution, culture, hire, scale, growth, performance, accountability, delegation). **Threshold:** 5+ terms across 3+ files.

**Self-help / Personal Development:** Personal growth language (habits, mindset, growth, goals, routines, discipline, productivity, self-improvement, journaling). **Threshold:** 5+ terms across 3+ files.

**Teaching / Academic:** Citation patterns, formal argument structure, hedging language ("research suggests", "studies show"), passive voice usage exceeding 30%, footnote-style references. **Threshold:** 3+ indicators across 3+ files.

**Conversational / Memoir:** First-person narrative dominance (>50% of paragraphs begin with "I" or contain first-person anecdotes), chronological storytelling, emotional vulnerability as primary device. **Threshold:** Pattern present in 60%+ of files.

**Detection presentation:** Inform the user of what was detected:

> "I detected a **[domain]** framework in your writing (based on: [specific evidence -- e.g., 'theological terms like grace, covenant, and kingdom appear in 5 of 7 files, with 3 scripture references']). Should I include a [Domain] Framework section in your voice profile? You can also specify a different domain or skip this section."

If no domain is detected above threshold, inform the user:

> "I didn't detect a strong domain-specific framework in your writing. The profile will be domain-neutral. If you'd like to add a domain framework section (theological, leadership, teaching, etc.), let me know."

## 6. Auto-Naming

Generate a profile filename from the detected characteristics:

1. **Domain component:** Take the detected domain (if any and confirmed): "pastoral", "leadership", "teaching", "memoir", "devotional", etc. If no domain detected, omit.
2. **Tone component:** Take the primary tone descriptor from Category 3 analysis: "conversational", "bold", "reflective", "direct", "warm", "authoritative", "intimate", etc.
3. **Combine:** `{domain}-{tone}.md` or just `{tone}.md` if no domain.
4. **Sanitise:** Lowercase, hyphens only, no special characters, no spaces.

Examples:
- `pastoral-conversational.md`
- `leadership-direct.md`
- `bold-narrative.md`
- `teaching-reflective.md`

If the user provided a preferred name, use that instead (sanitised to the same format).

## 7. Review Gate

Before saving the profile, present a review summary to the user. This mirrors the outliner's approval gate pattern.

### Review Summary Format

Present the following:

```
## Voice Profile Review

**Corpus:** [N] files, [M] words ([confidence tier] confidence)
**Suggested filename:** [auto-generated-name].md
**Detected domain:** [Domain] (or "None detected")

### Detected Voice Characteristics

**Tone:** [2-3 sentence summary from Pass 2 Tone section]
**Sentence patterns:** Average [N] words/sentence, [X]% fragments, [Y] rhetorical questions per 1,000 words
**Vocabulary register:** [Formal / Conversational / Mixed] -- [brief evidence]
**Top emphasis techniques:** [List 2-3 key techniques]
**Anti-patterns identified:** [List 2-3 key anti-patterns]

### Confidence Notes
[List any sections marked INFERRED, or "All sections at full confidence" for HIGH tier]
[Note any contradictory signals found across files, e.g., "Some files are formal while others are conversational -- the profile reflects the dominant pattern (conversational, 70% of files)"]
```

### User Options

1. **Approve** -- Save the profile to `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/[name].md`. Confirm to the user: "Voice profile saved to references/voice-profiles/[name].md. It's ready to use -- select it when starting a new book project."
2. **Adjust** -- The user requests specific changes (e.g., "Make the tone description more bold", "Add emphasis on storytelling", "Change the domain to leadership"). Apply the requested changes, then re-present the review summary.
3. **Regenerate** -- The user wants to start over (perhaps with a different directory or after adding more files). Return to Section 2 and re-run the full analysis.

### Filename Collision Handling

Before saving, check if a profile with the same name already exists in `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/`. If it does, append a number: `pastoral-conversational-2.md`, `pastoral-conversational-3.md`, etc. Always create a fresh profile -- never overwrite or merge with an existing one.

## 8. Constraints and Reminders

- **Markdown only.** Do not attempt to read, parse, or convert `.docx`, `.txt`, `.pdf`, or any non-markdown file format.
- **Analyse everything.** Do not skip short files, outlines, rough notes, or incomplete drafts. All `.md` files in the directory are part of the corpus.
- **New profile only.** Always create a fresh profile. Never merge with, update, or modify an existing voice profile. Users who want to incorporate additional source material should re-run the builder with all material in one directory.
- **Authenticity over polish.** The profile must reflect the author's ACTUAL voice, not an idealised or polished version. If the source material is rough, the profile should capture that roughness. If the author is inconsistent, note the inconsistency.
- **Evidence-backed claims only.** Every section of the generated profile must cite specific evidence from the corpus analysis. No generic descriptions like "warm and engaging" without numbers or examples to back it.
- **Contradictory signals.** If the source material contains contradictory voice signals (some files formal, others casual; some files use fragments heavily, others don't), note the range in the review summary and let the user decide. The profile should reflect the dominant pattern, with a note about the variation.
- **Large directories.** For directories with 100+ files, process in batches of 3-5 files. Aggregate incrementally. Never attempt to load all files into context at once.
- **Output location.** Generated profiles are saved to `${CLAUDE_PLUGIN_ROOT}/references/voice-profiles/[name].md`, making them immediately available for use by the orchestrator and all downstream skills.
- **Profile validation.** Before presenting the review summary, self-validate the generated profile against `voice-profile-spec.md`: all 5 required sections (Tone, Sentence Patterns, Vocabulary with Use and Avoid, Emphasis Techniques, Anti-Patterns) must be present and non-empty. If any section could not be populated from the corpus, fill with `"[Not specified -- using neutral, clear prose]"` and mark with `<!-- DEFAULT -->`.
