# Book DNA: [Book Title]

> This is the master context document for your book project. Every chapter agent reads this document to maintain voice consistency, theological alignment, and structural coherence. Updated between pipeline stages only -- READ-ONLY during parallel chapter generation.

## Metadata

- **Title:** [Book Title]
- **Subtitle:** [Optional subtitle]
- **Author:** [Author name]
- **Size tier:** [booklet | short | standard]
- **Target word count:** [Total target]
- **Chapter count:** [N]
- **Created:** [Date]

## Voice Profile

[Populated from the selected voice profile in references/voice-profiles/]

### Tone
[Description of overall tone]

### Sentence Patterns
[Short declarative stacking, anaphora, question volleys, exclamation punchlines, etc.]

### Vocabulary
**Use:** [Words and phrases characteristic of this voice]
**Avoid:** [Words and phrases that break this voice]

### Emphasis Techniques
[ALL-CAPS in scripture quotes, bold numbered points, key statements, benedictions, etc.]

## Theological/Domain Framework

[For spiritual books: scripture-plus-experience authority, supernatural-affirming, practical over systematic]
[For other genres: the interpretive lens and domain expertise that shapes content decisions]

## Book Arc

[Topical progression -- what the reader must understand/do first -> what builds on it -> the strongest chapters -> the commissioning close. Chapters are self-contained; the arc orders topics, it does not create suspense.]

## Chapter Map

Use one sub-list block per chapter. Every chapter MUST carry all fields below, including the Dag craft fields `opener_type`, `list_structure`, `key_statement`, and `testimony_seed`:

- **Ch 1: [Title]**
  - Core point: [one sentence -- the single proposition this chapter teaches]
  - opener_type: [anchor_scripture | plain_declaration | definition]
  - Anchor scripture: [reference -- quoted as the chapter epigraph if opener_type is anchor_scripture]
  - Key scriptures: [comma-separated references]
  - list_structure: [stem: "[the repeated point-opener frame]", count: N] OR [flowing]
  - key_statement: [the chapter's one-line quotable aphorism -- distinct across all chapters unless declared as a refrain]
  - testimony_seed: [source_path:line OR empty with note "no testimony available -- use biblical retelling, everyday analogy, or third-party anecdote"]
  - Connects to: [Ch X (builds on ...), Ch Y (applies ...)]
  - Momentum position: [Foundation | Building | Accelerating | Climax | Landing]
- **Ch 2: [Title]**
  - Core point: ...
  - opener_type: ...
  - Anchor scripture: ...
  - Key scriptures: ...
  - list_structure: ...
  - key_statement: ...
  - testimony_seed: ...
  - Connects to: ...
  - Momentum position: ...

The writer reads `opener_type`, `list_structure`, `key_statement`, and `testimony_seed` as hard constraints at draft time. See `references/dag-craft-rules.md` § DAG-01, § DAG-03, § DAG-04 and § DAG-08.

## Refrains

Deliberate repetition is native to this style. Declare every phrase that may recur verbatim, with a budget. List-chapter stems and chapter key statements that recur MUST be declared here (the outliner does this automatically for stems).

```yaml
refrains:
  - phrase: "[list stem, e.g. 'Forgive because...']"
    max_uses: [point count]
    scope: chapter_body
  - phrase: "[book-level maxim]"
    max_uses: 3
    scope: whole_book
```

Scripture blocks and benediction formulas ("May you...") are always exempt from dedup and need not be declared.

## Running Themes

- [Theme 1]: First taught Ch [X], applied Ch [Y], strongest treatment Ch [Z]

## Key Terms and Jargon

| Term | Definition | First Used |
|------|-----------|------------|

[Coined terms get their one-sentence plain definition here. The definition may be restated verbatim in chapters as a refrain.]

## Cross-Chapter Continuity

[Which verses function as book-level refrains, which coined terms recur, which chapters reference each other's points]

## Style Rules

- [Spelling convention: British/SA spelling default]
- [Scripture translation default: KJV -- alternates always labelled (NASB preferred, then NLT, NKJV, NIV, AMP, TLB)]
- [Formatting rules: bold numbered full-sentence point headings; scripture as blockquotes with reference lines; no em dashes; no italics-for-emphasis in prose]
- [Target words per chapter: X (driven by point count -- imbalance across chapters is acceptable)]
