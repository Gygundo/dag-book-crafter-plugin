---
name: formatter
description: "Convert edited markdown chapters into a professional .docx file with front matter, back matter, TOC, and page numbers. Called by the orchestrator during the formatting stage. Uses docx-js patterns."
user-invocable: false
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Book Formatter

Converts all `edited/ch[NN]-final.md` files into a single professional .docx file with front matter (half title, full title, copyright, dedication, foreword, TOC), body chapters with consistent typography and enrichment content (discussion questions, summaries, prayer points), and back matter (about the author, scripture index, glossary). Produces the final deliverable of the book pipeline.

## 1. Overview

- **Purpose:** Convert edited markdown chapters into a professional .docx document
- **Input:** Project directory path (received from orchestrator via `$ARGUMENTS`)
- **Output:** `[project_directory]/output/[Book Title].docx`
- **Prerequisites:** All `edited/ch[NN]-final.md` files exist, `book-dna.md` exists in the project directory
- **Optional inputs:** `enrichments/ch[NN]-enrichments.md` files (per-chapter discussion questions, summaries, prayer points) and `front-matter/foreword.md` (book foreword). If present, these are rendered inline after each chapter body and in the front matter respectively. If absent, the formatter proceeds without enrichments (backward compatible with pre-Phase 6 projects).

## 2. Pre-flight Checks

When invoked, perform these checks before generating the document:

**Step 1: Verify docx-js availability**

```bash
node -e "require('docx')" 2>/dev/null || npm install -g docx
```

**Step 2: Read Book DNA**

Read `[project_directory]/book-dna.md` and extract:
- **Title** -- from `**Title:**` in the Metadata section
- **Subtitle** -- from `**Subtitle:**` (may be empty or "[Optional subtitle]")
- **Author** -- from `**Author:**`
- **Chapter count** -- from `**Chapter count:**`
- **Key Terms table** -- from the "Key Terms and Jargon" section (Term | Definition | First Used)
- **Chapter Map table** -- from the "Chapter Map" section (Ch | Title | Core Argument | ...)
- **Style Rules** -- from the "Style Rules" section (spelling convention, scripture translation default)

**Step 3: Verify chapter files**

```bash
ls [project_directory]/edited/ch*-final.md | wc -l
```

Verify the count matches the Book DNA chapter count. If mismatched, report an error and stop.

**Step 4: Read voice profile**

Read `[project_directory]/voice-profile.md` for spelling convention rules (British/US) and any scripture translation defaults. If the voice profile contains a "Theological Framework" or "Theological/Domain Framework" section, note that the book is theological (used to determine whether to include the scripture copyright notice and scripture index).

**Step 5: Check for enrichment files**

Check for `[project_directory]/enrichments/ch[NN]-enrichments.md` files. If enrichment files exist:
- Set `has_enrichments = true`
- For each enrichment file, parse: Discussion Questions section, Chapter Summary section, Prayer Points section (may be absent for non-theological)
- Read `[project_directory]/front-matter/foreword.md` if it exists, set `has_foreword = true`

If no enrichment files exist, set `has_enrichments = false` -- the formatter proceeds without enrichments (backward compatible with pre-Phase 6 projects).

## 3. Markdown Parsing

### parseInlineFormatting(text)

Splits paragraph text into an array of `TextRun` objects with inline formatting:

```javascript
function parseInlineFormatting(text) {
  // Smart quote conversion first
  text = convertSmartQuotes(text);

  const runs = [];
  // Match bold+italic (***), bold (**), or italic (*) markers
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  for (const part of parts) {
    if (part.startsWith('***') && part.endsWith('***')) {
      runs.push(new TextRun({ text: part.slice(3, -3), bold: true, italics: true, font: "Georgia", size: 24 }));
    } else if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "Georgia", size: 24 }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true, font: "Georgia", size: 24 }));
    } else if (part) {
      runs.push(new TextRun({ text: part, font: "Georgia", size: 24 }));
    }
  }
  return runs;
}
```

### convertSmartQuotes(text)

Replaces straight quotes with typographic (smart) quotes based on position:

```javascript
function convertSmartQuotes(text) {
  // Double quotes: opening after whitespace/start, closing before whitespace/end/punctuation
  text = text.replace(/(^|[\s(])"([^"]*?)"/g, '$1\u201C$2\u201D');
  // Catch any remaining straight double quotes
  text = text.replace(/"([^"]*?)"/g, '\u201C$1\u201D');

  // Single quotes / apostrophes
  // Apostrophes within words (e.g., don't, it's, God's)
  text = text.replace(/(\w)'(\w)/g, '$1\u2019$2');
  // Opening single quote after whitespace/start
  text = text.replace(/(^|[\s(])'/g, '$1\u2018');
  // Closing single quote (remaining)
  text = text.replace(/'/g, '\u2019');

  return text;
}
```

### Strip HTML Comments (F-15 / D-21)

Before passing any chapter markdown to docx-js, the formatter MUST strip every HTML comment from the source. Chapters emitted upstream carry two mandatory header comments — `<!-- provenance: {source_path}:{line} -->` on line 1 and `<!-- generated-by: dag-book-crafter v1.0.0 -->` on line 2 — plus trailing `<!-- METADATA -->` and (from the editor) `<!-- VOICE AUDIT -->` blocks. None of these comments may reach the final `.docx`.

**Rule:** Run `content = content.replace(/<!--[\s\S]*?-->/g, '')` over the chapter text immediately after reading the file and before any other parsing. This single regex covers provenance comments, `generated-by` version stamps, METADATA blocks, VOICE AUDIT blocks, and any other HTML comment an upstream skill may emit. Use `[\s\S]` (not `.`) so the pattern matches across newlines; use the non-greedy `*?` so adjacent comments do not collapse into one match.

**Post-condition assertion:** After the final `.docx` is written, the formatter asserts that the rendered document contains zero occurrences of the literal strings `generated-by` and `provenance:` in any text run. If either string survives into the document body, the .docx is considered corrupted and the formatter reports a F-15 formatter failure.

### parseChapterMarkdown(content)

Parses an entire chapter markdown file into an array of `Paragraph` objects. Detects three content types: normal paragraphs (rendered as Normal style), scripture block quotes (rendered as ScriptureBlockQuote + ScriptureReference styles), and pull quotes (rendered as PullQuote style):

```javascript
function parseChapterMarkdown(content) {
  // Strip the METADATA block but extract scriptures_used first
  const metadataMatch = content.match(/<!--\s*METADATA[\s\S]*?-->/);
  let scripturesUsed = [];
  if (metadataMatch) {
    const scripturesMatch = metadataMatch[0].match(/scriptures_used:\s*(.+)/);
    if (scripturesMatch) {
      scripturesUsed = scripturesMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }
    content = content.replace(/<!--\s*METADATA[\s\S]*?-->/, '').trim();
  }

  // Also strip VOICE AUDIT blocks from edited chapters
  content = content.replace(/<!--\s*VOICE AUDIT[\s\S]*?-->/, '').trim();

  // Strip ALL remaining HTML comments (provenance, generated-by version stamps,
  // and any other upstream comments). This covers both
  // <!-- provenance: sources/ch01.md:12 --> and
  // <!-- generated-by: dag-book-crafter v1.0.0 -->.
  // Per F-15 / D-21, no HTML comment may survive into the .docx.
  content = content.replace(/<!--[\s\S]*?-->/g, '').trim();

  const lines = content.split('\n');
  const paragraphs = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) { i++; continue; }

    // Skip chapter heading
    if (/^#\s+Chapter\s+\d+/.test(line)) { i++; continue; }

    // Detect pull quote block: :::pullquote ... :::
    if (line === ':::pullquote') {
      i++;
      const pullLines = [];
      while (i < lines.length && lines[i].trim() !== ':::') {
        if (lines[i].trim()) pullLines.push(lines[i].trim());
        i++;
      }
      if (i < lines.length) i++; // skip closing :::
      if (pullLines.length > 0) {
        paragraphs.push(new Paragraph({
          style: "PullQuote",
          children: [new TextRun({ text: pullLines.join(' '), font: "Georgia", size: 28, italics: true })],
        }));
      }
      continue;
    }

    // Detect scripture block quote: > *text* followed eventually by > -- Reference
    if (line.startsWith('> ') && isScriptureBlock(lines, i)) {
      const scriptureLines = [];
      let refLine = null;
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        const stripped = lines[i].trim().replace(/^>\s*/, '');
        if (stripped.match(/^--\s*.+/)) {
          refLine = stripped.replace(/^--\s*/, '').trim();
        } else {
          // Remove wrapping * for italic (formatter applies italic via style)
          scriptureLines.push(stripped.replace(/^\*|\*$/g, '').trim());
        }
        i++;
      }
      if (scriptureLines.length > 0) {
        paragraphs.push(new Paragraph({
          style: "ScriptureBlockQuote",
          children: [new TextRun({ text: scriptureLines.join(' '), font: "Georgia", size: 22, italics: true })],
        }));
      }
      if (refLine) {
        paragraphs.push(new Paragraph({
          style: "ScriptureReference",
          children: [new TextRun({ text: refLine, font: "Georgia", size: 20, bold: true })],
        }));
      }
      continue;
    }

    // Detect numbered point heading (DAG-03 list chapter): **N. Full sentence.**
    // Also handles ### N. Full sentence. writer convention.
    if (/^\*\*\d+\..+\*\*\s*$/.test(line) || (/^#{2,3}\s+\d+\./.test(line))) {
      const headingText = line.replace(/^\*\*|\*\*\s*$/g, '').replace(/^#{2,3}\s+/, '').trim();
      paragraphs.push(new Paragraph({
        style: "NumberedPointHeading",
        children: [new TextRun({ text: headingText, bold: true, font: "Georgia", size: 26 })],
      }));
      i++;
      continue;
    }

    // Detect section heading (DAG-03 flowing chapter): ## or ### Short Title Case
    if (/^#{2,3}\s+/.test(line)) {
      const headingText = line.replace(/^#{2,3}\s+/, '').trim();
      paragraphs.push(new Paragraph({
        style: "SectionHeading",
        children: [new TextRun({ text: headingText, bold: true, font: "Georgia", size: 24 })],
      }));
      i++;
      continue;
    }

    // Collect regular paragraph (may span multiple non-empty lines until blank line)
    const paraLines = [];
    while (i < lines.length && lines[i].trim()
      && !lines[i].trim().startsWith(':::')
      && !isScriptureBlockStart(lines, i)
      && !/^\*\*\d+\..+\*\*\s*$/.test(lines[i].trim())
      && !/^#{2,3}\s+/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      const text = paraLines.join(' ');
      paragraphs.push(new Paragraph({
        style: "Normal",
        spacing: { line: 360, after: 120 },
        children: parseInlineFormatting(text),
      }));
    }
  }

  return { paragraphs, scripturesUsed };
}

// Helper: Check if a > block is a scripture block (has a > -- Reference line)
function isScriptureBlock(lines, startIndex) {
  for (let i = startIndex; i < lines.length && lines[i].trim().startsWith('> '); i++) {
    if (lines[i].trim().match(/^>\s*--\s*.+/)) return true;
  }
  return false;
}

// Helper: Check if current line starts a scripture block
function isScriptureBlockStart(lines, index) {
  return lines[index].trim().startsWith('> ') && isScriptureBlock(lines, index);
}
```

### parseEnrichmentMarkdown(content)

Parses an enrichment file into structured data for .docx rendering:

```javascript
function parseEnrichmentMarkdown(content) {
  const result = { questions: [], summary: '', prayerPoints: [] };

  // Extract Discussion Questions (numbered lines after ## Discussion Questions)
  const questionsMatch = content.match(/## Discussion Questions\n\n([\s\S]*?)(?=\n## |$)/);
  if (questionsMatch) {
    result.questions = questionsMatch[1].trim().split(/\n/).filter(l => /^\d+\./.test(l.trim())).map(l => l.replace(/^\d+\.\s*/, '').trim());
  }

  // Extract Chapter Summary (text after ## Chapter Summary)
  const summaryMatch = content.match(/## Chapter Summary\n\n([\s\S]*?)(?=\n## |$)/);
  if (summaryMatch) {
    result.summary = summaryMatch[1].trim();
  }

  // Extract Prayer Points (bulleted lines after ## Prayer Points)
  const prayerMatch = content.match(/## Prayer Points\n\n([\s\S]*?)(?=\n## |<!--|$)/);
  if (prayerMatch) {
    result.prayerPoints = prayerMatch[1].trim().split(/\n/).filter(l => /^-/.test(l.trim())).map(l => l.replace(/^-\s*/, '').trim());
  }

  return result;
}
```

### Prayer Point Bullet Numbering Config

**IMPORTANT:** Do NOT use Unicode bullet characters (e.g. `\u2022`) for prayer point list items. Per CLAUDE.md, Unicode bullet characters in docx-js create invalid Word documents. Instead, define a proper numbering config and apply it via the `numbering` property on each Paragraph.

Add this numbering config to the Document's `numbering.config` array:

```javascript
// Add to the Document numbering.config array alongside any existing numbering definitions
{
  reference: "prayer-bullets",
  levels: [
    {
      level: 0,
      format: LevelFormat.BULLET,
      text: "\u2022",  // This is safe INSIDE LevelFormat config -- docx-js handles it correctly here
      alignment: AlignmentType.LEFT,
      style: {
        paragraph: {
          indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
        },
        run: { font: "Symbol", size: 24 },
      },
    },
  ],
}
```

### renderEnrichmentParagraphs(enrichment)

Converts parsed enrichment data into an array of `Paragraph` objects to append after each chapter's body. Uses proper docx-js numbering for prayer point bullets (NOT Unicode bullet TextRun -- per CLAUDE.md that creates invalid Word documents).

```javascript
function renderEnrichmentParagraphs(enrichment) {
  const paragraphs = [];

  // Discussion Questions heading
  paragraphs.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "Discussion Questions", font: "Calibri", size: 32, bold: true })],
    spacing: { before: 480, after: 240 },
  }));

  // Numbered questions
  for (let i = 0; i < enrichment.questions.length; i++) {
    paragraphs.push(new Paragraph({
      style: "Normal",
      spacing: { line: 360, after: 120 },
      children: [new TextRun({ text: `${i + 1}. `, bold: true, font: "Georgia", size: 24 }), ...parseInlineFormatting(enrichment.questions[i])],
    }));
  }

  // Chapter Summary heading
  paragraphs.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "Chapter Summary", font: "Calibri", size: 32, bold: true })],
    spacing: { before: 480, after: 240 },
  }));

  // Summary text (italic)
  paragraphs.push(new Paragraph({
    style: "Normal",
    spacing: { line: 360, after: 120 },
    children: [new TextRun({ text: enrichment.summary, italics: true, font: "Georgia", size: 24 })],
  }));

  // Prayer Points (only if present)
  if (enrichment.prayerPoints.length > 0) {
    paragraphs.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Prayer Points", font: "Calibri", size: 32, bold: true })],
      spacing: { before: 480, after: 240 },
    }));

    // Use proper LevelFormat.BULLET numbering -- NOT Unicode bullet characters (per CLAUDE.md)
    for (const point of enrichment.prayerPoints) {
      paragraphs.push(new Paragraph({
        spacing: { line: 360, after: 120 },
        numbering: { reference: "prayer-bullets", level: 0 },
        children: [...parseInlineFormatting(point)],
      }));
    }
  }

  return paragraphs;
}
```

## 4. Document Styles

**Typography convention (per D-11):** Chapter headings use Calibri (sans-serif) for visual contrast; numbered point headings and section headings use Georgia bold for the Dag teaching style. Body text, front matter, back matter, and all non-heading text use Georgia (serif) for readability. This mixed-font approach is standard in modern Christian non-fiction publishing.

Define the complete styles object for the Document:

```javascript
const bookStyles = {
  default: {
    document: {
      run: { font: "Georgia", size: 24 }, // 12pt body
    },
  },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1",
      basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 48, bold: true, font: "Calibri" }, // Sans-serif for chapter headings per D-11
      paragraph: {
        spacing: { before: 480, after: 240 },
        outlineLevel: 0, // REQUIRED for TOC pickup
      },
    },
    {
      id: "Normal", name: "Normal",
      run: { font: "Georgia", size: 24 }, // 12pt
      paragraph: {
        spacing: { line: 360, after: 120 }, // 1.5 line spacing, 6pt after
      },
    },
    {
      id: "ScriptureBlockQuote",
      name: "Scripture Block Quote",
      basedOn: "Normal",
      run: { font: "Georgia", size: 22, italics: true }, // 11pt italic
      paragraph: {
        indent: { left: convertInchesToTwip(0.5), right: convertInchesToTwip(0.5) },
        spacing: { before: 360, after: 120, line: 360 }, // full blank-line gap before block
      },
    },
    {
      id: "ScriptureReference",
      name: "Scripture Reference",
      basedOn: "Normal",
      run: { font: "Georgia", size: 20, bold: true }, // 10pt bold
      paragraph: {
        alignment: AlignmentType.RIGHT,
        indent: { left: convertInchesToTwip(0.5), right: convertInchesToTwip(0.5) },
        spacing: { after: 360 }, // full blank-line gap after block
      },
    },
    {
      id: "NumberedPointHeading",
      name: "Numbered Point Heading",
      basedOn: "Normal",
      run: { font: "Georgia", size: 26, bold: true }, // 13pt bold -- DAG-03 numbered point
      paragraph: {
        spacing: { before: 360, after: 120 },
      },
    },
    {
      id: "SectionHeading",
      name: "Section Heading",
      basedOn: "Normal",
      run: { font: "Georgia", size: 24, bold: true }, // 12pt bold centred -- DAG-03 flowing chapter
      paragraph: {
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 120 },
      },
    },
    {
      id: "PullQuote",
      name: "Pull Quote",
      basedOn: "Normal",
      run: { font: "Georgia", size: 28, italics: true }, // 14pt italic
      paragraph: {
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 480 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
      },
    },
  ],
};
```

## 5. Document Assembly

Assemble the document in order. Each sub-section below defines one `sections[]` entry in the final Document.

### 5a. Half Title Page

Single page with only the book title, centred, pushed down approximately 3 inches. No headers, no footers.

```javascript
{
  properties: {
    page: {
      size: { width: 12240, height: 15840 }, // US Letter
      margin: { top: 2160, right: 1440, bottom: 2160, left: 1440 },
    },
  },
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 4320 }, // Push title down ~3 inches
      children: [new TextRun({
        text: bookTitle,
        bold: true,
        size: 72, // 36pt
        font: "Georgia",
      })],
    }),
  ],
}
```

### 5b. Full Title Page

Title, subtitle (if present), and author name. Centred. No headers, no footers.

```javascript
{
  properties: {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 2160, right: 1440, bottom: 2160, left: 1440 },
    },
  },
  children: [
    // Book title
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 3600, after: 480 }, // Push down ~2.5 inches
      children: [new TextRun({
        text: bookTitle,
        bold: true,
        size: 72, // 36pt
        font: "Georgia",
      })],
    }),
    // Subtitle (include only if present and not a placeholder)
    ...(bookSubtitle ? [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 960 },
      children: [new TextRun({
        text: bookSubtitle,
        italics: true,
        size: 36, // 18pt
        font: "Georgia",
      })],
    })] : []),
    // Author name
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: bookSubtitle ? 0 : 960 },
      children: [new TextRun({
        text: authorName,
        size: 28, // 14pt
        font: "Georgia",
      })],
    }),
  ],
}
```

### 5c. Copyright Page

Left-aligned, Georgia 10pt. No headers, no footers.

```javascript
{
  properties: {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 2160, right: 1440, bottom: 2160, left: 1440 },
    },
  },
  children: [
    new Paragraph({ children: [new TextRun({ text: `Copyright \u00A9 ${currentYear} ${authorName}`, font: "Georgia", size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: "All rights reserved.", font: "Georgia", size: 20 })] }),
    new Paragraph({ children: [] }), // blank line
    new Paragraph({ children: [new TextRun({ text: "No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without the prior written permission of the author.", font: "Georgia", size: 20 })] }),
    new Paragraph({ children: [] }), // blank line
    // Scripture copyright notice -- include only if theological book
    ...(isTheological ? [
      new Paragraph({ children: [new TextRun({ text: `Unless otherwise indicated, all Scripture quotations are taken from the ${scriptureTranslation}. Copyright \u00A9 1982 by Thomas Nelson. Used by permission. All rights reserved.`, font: "Georgia", size: 20 })] }),
      new Paragraph({ children: [] }),
    ] : []),
    new Paragraph({ children: [new TextRun({ text: "ISBN: [To be assigned]", font: "Georgia", size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: `First edition, ${currentYear}`, font: "Georgia", size: 20 })] }),
  ],
}
```

The `scriptureTranslation` defaults to "New King James Version (NKJV)" unless the Style Rules in book-dna.md specify a different translation. `isTheological` is `true` if the voice profile contains a theological framework section.

### 5d. Dedication Page

Centred, italic, Georgia 14pt. Placeholder text. No headers, no footers.

```javascript
{
  properties: {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 2160, right: 1440, bottom: 2160, left: 1440 },
    },
  },
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 4320 }, // Push down ~3 inches
      children: [new TextRun({
        text: "[Dedication to be added]",
        italics: true,
        size: 28, // 14pt
        font: "Georgia",
      })],
    }),
  ],
}
```

### 5e. Table of Contents

Roman numeral page numbers in footer. This is the first section with page numbers.

**CRITICAL:** The Document must set `features: { updateFields: true }` for the TOC to auto-populate when opened in Word.

```javascript
{
  properties: {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      pageNumbers: {
        start: 1,
        formatType: NumberFormat.LOWER_ROMAN,
      },
    },
  },
  footers: {
    default: new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          children: [PageNumber.CURRENT],
          font: "Georgia",
          size: 18, // 9pt
        })],
      })],
    }),
  },
  children: [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Contents")],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-1",
    }),
  ],
}
```

### 5f. Body Section -- All Chapters

ONE section containing ALL chapters. Chapters are separated by `pageBreakBefore: true` on each chapter heading. Arabic page numbers restart at 1.

```javascript
{
  properties: {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      pageNumbers: {
        start: 1,
        formatType: NumberFormat.DECIMAL,
      },
    },
  },
  headers: {
    default: new Header({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: bookTitle,
          italics: true,
          font: "Georgia",
          size: 18, // 9pt
        })],
      })],
    }),
  },
  footers: {
    default: new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
          font: "Georgia",
          size: 18, // 9pt
        })],
      })],
    }),
  },
  children: buildChapterContent(chapterFiles, chapterTitles),
}
```

The `buildChapterContent` function iterates over each chapter file in order. Each chapter opens with a centred "Chapter N" label (page break before) followed by the chapter title as HEADING_1 (centred, in TOC). Only HEADING_1 paragraphs appear in the TOC; the label paragraph does not.

```javascript
function buildChapterContent(chapterFiles, chapterTitles) {
  const children = [];
  for (let i = 0; i < chapterFiles.length; i++) {
    const chapterContent = fs.readFileSync(chapterFiles[i], 'utf-8');
    const chapterTitle = chapterTitles[i];

    // "Chapter N" label -- centred, page break before, NOT in TOC
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true,
      spacing: { before: 720, after: 120 },
      children: [new TextRun({ text: `Chapter ${i + 1}`, font: "Calibri", size: 36, color: "555555" })],
    }));

    // Chapter title -- HEADING_1 centred (goes into TOC)
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun(chapterTitle)],
    }));

    // Parsed chapter content
    const { paragraphs } = parseChapterMarkdown(chapterContent);
    children.push(...paragraphs);
  }
  return children;
}
```

### 5g. Back Matter -- About the Author

Continues arabic page numbering (new section, no page number restart).

```javascript
{
  properties: {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    },
  },
  headers: {
    default: new Header({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: bookTitle,
          italics: true,
          font: "Georgia",
          size: 18,
        })],
      })],
    }),
  },
  footers: {
    default: new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
          font: "Georgia",
          size: 18,
        })],
      })],
    }),
  },
  children: [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new TextRun("About the Author")],
    }),
    new Paragraph({
      style: "Normal",
      children: [new TextRun({
        text: authorBio || "[Author bio to be added]",
        font: "Georgia",
        size: 24,
      })],
    }),
  ],
}
```

The `authorBio` is extracted from Book DNA's Metadata section (`author_bio` field). If absent or empty, the placeholder text is used.

### 5h. Back Matter -- Scripture Index

**Only include this section if scripture references are found.** For non-theological books with no scripture references, omit entirely.

Auto-extraction process:

1. Read each `edited/ch[NN]-final.md`
2. Extract from the METADATA block `scriptures_used` field (comma-separated list)
3. Also regex-scan the chapter body with: `/(?:\d\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:-\d+)?/g`
4. Build a Map of scripture reference -> Set of chapter numbers
5. Sort by canonical Bible book order using the BIBLE_BOOKS array (see Section 9)
6. Format as paragraphs with dot leaders

```javascript
function buildScriptureIndex(scriptureMap, chapterNumbers) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new TextRun("Scripture Index")],
    }),
  ];

  // Sort references by canonical book order
  const sortedRefs = Array.from(scriptureMap.entries()).sort((a, b) => {
    const bookA = getBookName(a[0]);
    const bookB = getBookName(b[0]);
    const indexA = BIBLE_BOOKS.indexOf(bookA);
    const indexB = BIBLE_BOOKS.indexOf(bookB);
    if (indexA !== indexB) return indexA - indexB;
    return a[0].localeCompare(b[0]);
  });

  for (const [reference, chapters] of sortedRefs) {
    const chapterList = Array.from(chapters).sort((a, b) => a - b).join(", ");
    children.push(new Paragraph({
      children: [
        new TextRun({ text: reference, font: "Georgia", size: 22 }),
        new TextRun({ children: [
          new PositionalTab({
            alignment: PositionalTabAlignment.RIGHT,
            relativeTo: PositionalTabRelativeTo.MARGIN,
            leader: PositionalTabLeader.DOT,
          }),
          `Chapter ${chapterList}`,
        ], font: "Georgia", size: 22 }),
      ],
    }));
  }

  return children;
}
```

### 5i. Back Matter -- Glossary

**Only include this section if the Book DNA Key Terms table has entries.** If the table is empty or absent, omit this section.

Source: Book DNA "Key Terms and Jargon" table. Format as a two-column table.

```javascript
function buildGlossary(keyTerms) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const rows = [
    // Header row
    new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 2800, type: WidthType.DXA },
          shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: "Term", bold: true, font: "Georgia", size: 22 })] })],
        }),
        new TableCell({
          borders,
          width: { size: 6560, type: WidthType.DXA },
          shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: "Definition", bold: true, font: "Georgia", size: 22 })] })],
        }),
      ],
    }),
    // Data rows
    ...keyTerms.map(term => new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 2800, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: term.name, bold: true, font: "Georgia", size: 22 })] })],
        }),
        new TableCell({
          borders,
          width: { size: 6560, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: term.definition, font: "Georgia", size: 22 })] })],
        }),
      ],
    })),
  ];

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new TextRun("Glossary")],
    }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2800, 6560], // Must sum to 9360
      rows,
    }),
  ];
}
```

## 6. Assembly and Output

Build the complete document:

1. Construct all sections in order: Half Title (5a), Full Title (5b), Copyright (5c), Dedication (5d), Foreword (5d2 -- if has_foreword), TOC (5e), Body (5f -- with enrichments after each chapter if has_enrichments), About the Author (5g), Scripture Index (5h -- if applicable), Glossary (5i -- if applicable)
2. Create the Document:
   ```javascript
   const doc = new Document({
     features: { updateFields: true }, // CRITICAL for TOC
     styles: bookStyles,
     numbering: {
       config: [
         {
           reference: "prayer-bullets",
           levels: [{
             level: 0,
             format: LevelFormat.BULLET,
             text: "\u2022",
             alignment: AlignmentType.LEFT,
             style: {
               paragraph: { indent: { left: 720, hanging: 360 } },
               run: { font: "Symbol", size: 24 },
             },
           }],
         },
       ],
     },
     sections: allSections,
   });
   ```
3. Generate the .docx:
   ```javascript
   const outputDir = path.join(projectDirectory, 'output');
   if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

   const outputPath = path.join(outputDir, `${bookTitle}.docx`);
   const buffer = await Packer.toBuffer(doc);
   fs.writeFileSync(outputPath, buffer);
   ```
4. Output path: `[project_directory]/output/[Book Title].docx` (title from Book DNA metadata, spaces preserved)

## 7. Generation Script Template

Write the following Node.js script to a temporary file and execute it with `node`. This is the complete generation script the formatter writes and runs.

```javascript
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell,
  Header, Footer,
  AlignmentType, HeadingLevel, NumberFormat, PageNumber,
  TableOfContents, BorderStyle, WidthType, ShadingType,
  LevelFormat, convertInchesToTwip,
  PositionalTab, PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader,
} = require('docx');

// ---- Configuration (filled by formatter from Book DNA) ----
const PROJECT_DIR = '__PROJECT_DIR__';
const BOOK_TITLE = '__BOOK_TITLE__';
const BOOK_SUBTITLE = '__BOOK_SUBTITLE__'; // empty string if none
const AUTHOR_NAME = '__AUTHOR_NAME__';
const AUTHOR_BIO = '__AUTHOR_BIO__'; // empty string for placeholder
const IS_THEOLOGICAL = __IS_THEOLOGICAL__; // true or false
const SCRIPTURE_TRANSLATION = '__SCRIPTURE_TRANSLATION__';
const CURRENT_YEAR = new Date().getFullYear();

// Chapter titles in order (extracted from Book DNA chapter map)
const CHAPTER_TITLES = __CHAPTER_TITLES_JSON__;

// Key terms for glossary (extracted from Book DNA)
const KEY_TERMS = __KEY_TERMS_JSON__; // [{ name: "Term", definition: "Def" }, ...]

// ---- Canonical Bible Books (66 books) ----
const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
  "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Psalm",
  "Proverbs", "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
  "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon",
  "Hebrews", "James", "1 Peter", "2 Peter",
  "1 John", "2 John", "3 John", "Jude", "Revelation",
];

// ---- Smart Quote Conversion ----
function convertSmartQuotes(text) {
  text = text.replace(/(^|[\s(])"([^"]*?)"/g, '$1\u201C$2\u201D');
  text = text.replace(/"([^"]*?)"/g, '\u201C$1\u201D');
  text = text.replace(/(\w)'(\w)/g, '$1\u2019$2');
  text = text.replace(/(^|[\s(])'/g, '$1\u2018');
  text = text.replace(/'/g, '\u2019');
  return text;
}

// ---- Inline Formatting Parser ----
function parseInlineFormatting(text) {
  text = convertSmartQuotes(text);
  const runs = [];
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  for (const part of parts) {
    if (part.startsWith('***') && part.endsWith('***')) {
      runs.push(new TextRun({ text: part.slice(3, -3), bold: true, italics: true, font: "Georgia", size: 24 }));
    } else if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "Georgia", size: 24 }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true, font: "Georgia", size: 24 }));
    } else if (part) {
      runs.push(new TextRun({ text: part, font: "Georgia", size: 24 }));
    }
  }
  return runs;
}

// ---- Scripture Block Detection Helpers ----
function isScriptureBlock(lines, startIndex) {
  for (let i = startIndex; i < lines.length && lines[i].trim().startsWith('> '); i++) {
    if (lines[i].trim().match(/^>\s*--\s*.+/)) return true;
  }
  return false;
}

function isScriptureBlockStart(lines, index) {
  return lines[index].trim().startsWith('> ') && isScriptureBlock(lines, index);
}

// ---- Chapter Markdown Parser ----
function parseChapterMarkdown(content) {
  const metadataMatch = content.match(/<!--\s*METADATA[\s\S]*?-->/);
  let scripturesUsed = [];
  if (metadataMatch) {
    const sm = metadataMatch[0].match(/scriptures_used:\s*(.+)/);
    if (sm) scripturesUsed = sm[1].split(',').map(s => s.trim()).filter(Boolean);
    content = content.replace(/<!--\s*METADATA[\s\S]*?-->/, '').trim();
  }

  // Also strip VOICE AUDIT blocks from edited chapters
  content = content.replace(/<!--\s*VOICE AUDIT[\s\S]*?-->/, '').trim();

  // Strip ALL remaining HTML comments (provenance + generated-by version stamps).
  // Per F-15 / D-21, no HTML comment may survive into the .docx.
  content = content.replace(/<!--[\s\S]*?-->/g, '').trim();

  const lines = content.split('\n');
  const paragraphs = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) { i++; continue; }

    // Skip chapter heading
    if (/^#\s+Chapter\s+\d+/.test(line)) { i++; continue; }

    // Detect pull quote block: :::pullquote ... :::
    if (line === ':::pullquote') {
      i++;
      const pullLines = [];
      while (i < lines.length && lines[i].trim() !== ':::') {
        if (lines[i].trim()) pullLines.push(lines[i].trim());
        i++;
      }
      if (i < lines.length) i++; // skip closing :::
      if (pullLines.length > 0) {
        paragraphs.push(new Paragraph({
          style: "PullQuote",
          children: [new TextRun({ text: pullLines.join(' '), font: "Georgia", size: 28, italics: true })],
        }));
      }
      continue;
    }

    // Detect scripture block quote: > *text* followed eventually by > -- Reference
    if (line.startsWith('> ') && isScriptureBlock(lines, i)) {
      const scriptureLines = [];
      let refLine = null;
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        const stripped = lines[i].trim().replace(/^>\s*/, '');
        if (stripped.match(/^--\s*.+/)) {
          refLine = stripped.replace(/^--\s*/, '').trim();
        } else {
          // Remove wrapping * for italic (formatter applies italic via style)
          scriptureLines.push(stripped.replace(/^\*|\*$/g, '').trim());
        }
        i++;
      }
      if (scriptureLines.length > 0) {
        paragraphs.push(new Paragraph({
          style: "ScriptureBlockQuote",
          children: [new TextRun({ text: scriptureLines.join(' '), font: "Georgia", size: 22, italics: true })],
        }));
      }
      if (refLine) {
        paragraphs.push(new Paragraph({
          style: "ScriptureReference",
          children: [new TextRun({ text: refLine, font: "Georgia", size: 20, bold: true })],
        }));
      }
      continue;
    }

    // Detect numbered point heading (DAG-03 list chapter): **N. Full sentence.**
    // Also handles ### N. Full sentence. writer convention.
    if (/^\*\*\d+\..+\*\*\s*$/.test(line) || (/^#{2,3}\s+\d+\./.test(line))) {
      const headingText = line.replace(/^\*\*|\*\*\s*$/g, '').replace(/^#{2,3}\s+/, '').trim();
      paragraphs.push(new Paragraph({
        style: "NumberedPointHeading",
        children: [new TextRun({ text: headingText, bold: true, font: "Georgia", size: 26 })],
      }));
      i++;
      continue;
    }

    // Detect section heading (DAG-03 flowing chapter): ## or ### Short Title Case
    if (/^#{2,3}\s+/.test(line)) {
      const headingText = line.replace(/^#{2,3}\s+/, '').trim();
      paragraphs.push(new Paragraph({
        style: "SectionHeading",
        children: [new TextRun({ text: headingText, bold: true, font: "Georgia", size: 24 })],
      }));
      i++;
      continue;
    }

    // Collect regular paragraph (may span multiple non-empty lines until blank line)
    const paraLines = [];
    while (i < lines.length && lines[i].trim()
      && !lines[i].trim().startsWith(':::')
      && !isScriptureBlockStart(lines, i)
      && !/^\*\*\d+\..+\*\*\s*$/.test(lines[i].trim())
      && !/^#{2,3}\s+/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      const text = paraLines.join(' ');
      paragraphs.push(new Paragraph({
        style: "Normal",
        spacing: { line: 360, after: 120 },
        children: parseInlineFormatting(text),
      }));
    }
  }

  return { paragraphs, scripturesUsed };
}

// ---- Scripture Extraction ----
const scriptureRegex = /(?:\d\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:-\d+)?/g;

function getBookName(ref) {
  // Extract the book name portion from a reference like "1 Corinthians 13:4-7"
  const match = ref.match(/^((?:\d\s+)?[A-Za-z]+(?:\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)?)\s+\d/);
  return match ? match[1] : ref;
}

function extractScriptures(chapterFiles) {
  const scriptureMap = new Map(); // reference -> Set of chapter numbers

  for (let i = 0; i < chapterFiles.length; i++) {
    const chapterNum = i + 1;
    const content = fs.readFileSync(chapterFiles[i], 'utf-8');

    // Extract from METADATA block
    const metaMatch = content.match(/<!--\s*METADATA[\s\S]*?-->/);
    if (metaMatch) {
      const sm = metaMatch[0].match(/scriptures_used:\s*(.+)/);
      if (sm) {
        sm[1].split(',').map(s => s.trim()).filter(Boolean).forEach(ref => {
          if (!scriptureMap.has(ref)) scriptureMap.set(ref, new Set());
          scriptureMap.get(ref).add(chapterNum);
        });
      }
    }

    // Regex scan body text
    const bodyText = content.replace(/<!--\s*METADATA[\s\S]*?-->/, '');
    const matches = bodyText.match(scriptureRegex);
    if (matches) {
      matches.forEach(ref => {
        const trimRef = ref.trim();
        if (!scriptureMap.has(trimRef)) scriptureMap.set(trimRef, new Set());
        scriptureMap.get(trimRef).add(chapterNum);
      });
    }
  }

  return scriptureMap;
}

// ---- Enrichment Markdown Parser ----
function parseEnrichmentMarkdown(content) {
  const result = { questions: [], summary: '', prayerPoints: [] };
  const questionsMatch = content.match(/## Discussion Questions\n\n([\s\S]*?)(?=\n## |$)/);
  if (questionsMatch) {
    result.questions = questionsMatch[1].trim().split(/\n/).filter(l => /^\d+\./.test(l.trim())).map(l => l.replace(/^\d+\.\s*/, '').trim());
  }
  const summaryMatch = content.match(/## Chapter Summary\n\n([\s\S]*?)(?=\n## |$)/);
  if (summaryMatch) {
    result.summary = summaryMatch[1].trim();
  }
  const prayerMatch = content.match(/## Prayer Points\n\n([\s\S]*?)(?=\n## |<!--|$)/);
  if (prayerMatch) {
    result.prayerPoints = prayerMatch[1].trim().split(/\n/).filter(l => /^-/.test(l.trim())).map(l => l.replace(/^-\s*/, '').trim());
  }
  return result;
}

function renderEnrichmentParagraphs(enrichment) {
  const paragraphs = [];
  paragraphs.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "Discussion Questions", font: "Calibri", size: 32, bold: true })],
    spacing: { before: 480, after: 240 },
  }));
  for (let i = 0; i < enrichment.questions.length; i++) {
    paragraphs.push(new Paragraph({
      style: "Normal",
      spacing: { line: 360, after: 120 },
      children: [new TextRun({ text: `${i + 1}. `, bold: true, font: "Georgia", size: 24 }), ...parseInlineFormatting(enrichment.questions[i])],
    }));
  }
  paragraphs.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: "Chapter Summary", font: "Calibri", size: 32, bold: true })],
    spacing: { before: 480, after: 240 },
  }));
  paragraphs.push(new Paragraph({
    style: "Normal",
    spacing: { line: 360, after: 120 },
    children: [new TextRun({ text: enrichment.summary, italics: true, font: "Georgia", size: 24 })],
  }));
  if (enrichment.prayerPoints.length > 0) {
    paragraphs.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Prayer Points", font: "Calibri", size: 32, bold: true })],
      spacing: { before: 480, after: 240 },
    }));
    for (const point of enrichment.prayerPoints) {
      paragraphs.push(new Paragraph({
        spacing: { line: 360, after: 120 },
        numbering: { reference: "prayer-bullets", level: 0 },
        children: [...parseInlineFormatting(point)],
      }));
    }
  }
  return paragraphs;
}

// ---- Document Styles ----
const bookStyles = {
  default: {
    document: {
      run: { font: "Georgia", size: 24 },
    },
  },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1",
      basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 48, bold: true, font: "Calibri" }, // Sans-serif for chapter headings per D-11
      paragraph: {
        spacing: { before: 480, after: 240 },
        outlineLevel: 0,
      },
    },
    {
      id: "Normal", name: "Normal",
      run: { font: "Georgia", size: 24 },
      paragraph: {
        spacing: { line: 360, after: 120 },
      },
    },
    {
      id: "ScriptureBlockQuote",
      name: "Scripture Block Quote",
      basedOn: "Normal",
      run: { font: "Georgia", size: 22, italics: true }, // 11pt italic
      paragraph: {
        indent: { left: convertInchesToTwip(0.5), right: convertInchesToTwip(0.5) },
        spacing: { before: 360, after: 120, line: 360 }, // full blank-line gap before block
      },
    },
    {
      id: "ScriptureReference",
      name: "Scripture Reference",
      basedOn: "Normal",
      run: { font: "Georgia", size: 20, bold: true }, // 10pt bold
      paragraph: {
        alignment: AlignmentType.RIGHT,
        indent: { left: convertInchesToTwip(0.5), right: convertInchesToTwip(0.5) },
        spacing: { after: 360 }, // full blank-line gap after block
      },
    },
    {
      id: "NumberedPointHeading",
      name: "Numbered Point Heading",
      basedOn: "Normal",
      run: { font: "Georgia", size: 26, bold: true }, // 13pt bold -- DAG-03 numbered point
      paragraph: {
        spacing: { before: 360, after: 120 },
      },
    },
    {
      id: "SectionHeading",
      name: "Section Heading",
      basedOn: "Normal",
      run: { font: "Georgia", size: 24, bold: true }, // 12pt bold centred -- DAG-03 flowing chapter
      paragraph: {
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 120 },
      },
    },
    {
      id: "PullQuote",
      name: "Pull Quote",
      basedOn: "Normal",
      run: { font: "Georgia", size: 28, italics: true }, // 14pt italic
      paragraph: {
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 480 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
      },
    },
  ],
};

// ---- Build Document ----
async function main() {
  // Discover chapter files
  const editedDir = path.join(PROJECT_DIR, 'edited');
  const chapterFiles = fs.readdirSync(editedDir)
    .filter(f => /^ch\d+-final\.md$/.test(f))
    .sort()
    .map(f => path.join(editedDir, f));

  console.log(`Found ${chapterFiles.length} chapters`);

  // Check for enrichments
  const enrichmentsDir = path.join(PROJECT_DIR, 'enrichments');
  const has_enrichments = fs.existsSync(enrichmentsDir) && fs.readdirSync(enrichmentsDir).some(f => /^ch\d+-enrichments\.md$/.test(f));

  // Build chapter content for body section
  const bodyChildren = [];
  for (let i = 0; i < chapterFiles.length; i++) {
    const content = fs.readFileSync(chapterFiles[i], 'utf-8');
    // "Chapter N" label -- centred, page break before, NOT in TOC
    bodyChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true,
      spacing: { before: 720, after: 120 },
      children: [new TextRun({ text: `Chapter ${i + 1}`, font: "Calibri", size: 36, color: "555555" })],
    }));
    // Chapter title -- HEADING_1 centred (goes into TOC)
    bodyChildren.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun(CHAPTER_TITLES[i] || `Chapter ${i + 1}`)],
    }));
    const { paragraphs } = parseChapterMarkdown(content);
    bodyChildren.push(...paragraphs);

    // Append enrichment content after chapter body (if enrichments exist)
    if (has_enrichments) {
      const chapterNum = (i + 1).toString().padStart(2, '0');
      const enrichmentPath = path.join(enrichmentsDir, `ch${chapterNum}-enrichments.md`);
      if (fs.existsSync(enrichmentPath)) {
        const enrichmentContent = fs.readFileSync(enrichmentPath, 'utf-8');
        const enrichment = parseEnrichmentMarkdown(enrichmentContent);
        bodyChildren.push(...renderEnrichmentParagraphs(enrichment));
      }
    }
  }

  // Build scripture index
  const scriptureMap = extractScriptures(chapterFiles);
  const hasScriptures = scriptureMap.size > 0;

  // Build sections array
  const allSections = [];

  // 5a: Half Title Page
  allSections.push({
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 2160, right: 1440, bottom: 2160, left: 1440 },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 4320 },
        children: [new TextRun({ text: BOOK_TITLE, bold: true, size: 72, font: "Georgia" })],
      }),
    ],
  });

  // 5b: Full Title Page
  const titlePageChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 3600, after: 480 },
      children: [new TextRun({ text: BOOK_TITLE, bold: true, size: 72, font: "Georgia" })],
    }),
  ];
  if (BOOK_SUBTITLE) {
    titlePageChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 960 },
      children: [new TextRun({ text: BOOK_SUBTITLE, italics: true, size: 36, font: "Georgia" })],
    }));
  }
  titlePageChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: BOOK_SUBTITLE ? 0 : 960 },
    children: [new TextRun({ text: AUTHOR_NAME, size: 28, font: "Georgia" })],
  }));

  allSections.push({
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 2160, right: 1440, bottom: 2160, left: 1440 },
      },
    },
    children: titlePageChildren,
  });

  // 5c: Copyright Page
  const copyrightChildren = [
    new Paragraph({ children: [new TextRun({ text: `Copyright \u00A9 ${CURRENT_YEAR} ${AUTHOR_NAME}`, font: "Georgia", size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: "All rights reserved.", font: "Georgia", size: 20 })] }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [new TextRun({ text: "No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without the prior written permission of the author.", font: "Georgia", size: 20 })] }),
    new Paragraph({ children: [] }),
  ];
  if (IS_THEOLOGICAL) {
    copyrightChildren.push(
      new Paragraph({ children: [new TextRun({ text: `Unless otherwise indicated, all Scripture quotations are taken from the ${SCRIPTURE_TRANSLATION}. Copyright \u00A9 1982 by Thomas Nelson. Used by permission. All rights reserved.`, font: "Georgia", size: 20 })] }),
      new Paragraph({ children: [] }),
    );
  }
  copyrightChildren.push(
    new Paragraph({ children: [new TextRun({ text: "ISBN: [To be assigned]", font: "Georgia", size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: `First edition, ${CURRENT_YEAR}`, font: "Georgia", size: 20 })] }),
  );

  allSections.push({
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 2160, right: 1440, bottom: 2160, left: 1440 },
      },
    },
    children: copyrightChildren,
  });

  // 5d: Dedication Page
  allSections.push({
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 2160, right: 1440, bottom: 2160, left: 1440 },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 4320 },
        children: [new TextRun({ text: "[Dedication to be added]", italics: true, size: 28, font: "Georgia" })],
      }),
    ],
  });

  // 5d2: Foreword (if exists)
  const forewordPath = path.join(PROJECT_DIR, 'front-matter', 'foreword.md');
  const has_foreword = fs.existsSync(forewordPath);
  if (has_foreword) {
    let forewordContent = fs.readFileSync(forewordPath, 'utf-8');
    // Strip metadata comment and # Foreword heading
    forewordContent = forewordContent.replace(/<!--[\s\S]*?-->/g, '').replace(/^#\s+Foreword\s*\n/, '').trim();

    const forewordParas = forewordContent.split(/\n\s*\n/).filter(Boolean).map(para =>
      new Paragraph({
        style: "Normal",
        spacing: { line: 360, after: 120 },
        children: parseInlineFormatting(para.trim()),
      })
    );

    allSections.push({
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "Foreword", font: "Calibri", size: 48, bold: true })],
          spacing: { after: 480 },
        }),
        ...forewordParas,
      ],
    });
  }

  // 5e: Table of Contents
  allSections.push({
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], font: "Georgia", size: 18 })],
        })],
      }),
    },
    children: [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("Contents")],
      }),
      new TableOfContents("Table of Contents", {
        hyperlink: true,
        headingStyleRange: "1-1",
      }),
    ],
  });

  // 5f: Body Section -- All Chapters
  allSections.push({
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: BOOK_TITLE, italics: true, font: "Georgia", size: 18 })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
            font: "Georgia", size: 18,
          })],
        })],
      }),
    },
    children: bodyChildren,
  });

  // Back matter header/footer (shared)
  const backMatterHeader = new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: BOOK_TITLE, italics: true, font: "Georgia", size: 18 })],
    })],
  });
  const backMatterFooter = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
        font: "Georgia", size: 18,
      })],
    })],
  });

  // 5g: About the Author
  allSections.push({
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: BOOK_TITLE, italics: true, font: "Georgia", size: 18 })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
            font: "Georgia", size: 18,
          })],
        })],
      }),
    },
    children: [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun("About the Author")],
      }),
      new Paragraph({
        style: "Normal",
        children: [new TextRun({ text: AUTHOR_BIO || "[Author bio to be added]", font: "Georgia", size: 24 })],
      }),
    ],
  });

  // 5h: Scripture Index (only if references found)
  if (hasScriptures && IS_THEOLOGICAL) {
    const sortedRefs = Array.from(scriptureMap.entries()).sort((a, b) => {
      const bookA = getBookName(a[0]);
      const bookB = getBookName(b[0]);
      const indexA = BIBLE_BOOKS.findIndex(bk => bk === bookA || bk + 's' === bookA || bookA + 's' === bk);
      const indexB = BIBLE_BOOKS.findIndex(bk => bk === bookB || bk + 's' === bookB || bookB + 's' === bk);
      if (indexA !== indexB) return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      return a[0].localeCompare(b[0]);
    });

    const scriptureChildren = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun("Scripture Index")],
      }),
    ];

    for (const [reference, chapters] of sortedRefs) {
      const chapterList = Array.from(chapters).sort((a, b) => a - b).join(", ");
      scriptureChildren.push(new Paragraph({
        children: [
          new TextRun({ text: reference, font: "Georgia", size: 22 }),
          new TextRun({ children: [
            new PositionalTab({
              alignment: PositionalTabAlignment.RIGHT,
              relativeTo: PositionalTabRelativeTo.MARGIN,
              leader: PositionalTabLeader.DOT,
            }),
            `Chapter ${chapterList}`,
          ], font: "Georgia", size: 22 }),
        ],
      }));
    }

    allSections.push({
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: BOOK_TITLE, italics: true, font: "Georgia", size: 18 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
              font: "Georgia", size: 18,
            })],
          })],
        }),
      },
      children: scriptureChildren,
    });
  }

  // 5i: Glossary (only if key terms exist)
  if (KEY_TERMS.length > 0) {
    const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const borders = { top: border, bottom: border, left: border, right: border };

    const glossaryRows = [
      new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 2800, type: WidthType.DXA },
            shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Term", bold: true, font: "Georgia", size: 22 })] })],
          }),
          new TableCell({
            borders,
            width: { size: 6560, type: WidthType.DXA },
            shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Definition", bold: true, font: "Georgia", size: 22 })] })],
          }),
        ],
      }),
      ...KEY_TERMS.map(term => new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 2800, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: term.name, bold: true, font: "Georgia", size: 22 })] })],
          }),
          new TableCell({
            borders,
            width: { size: 6560, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: term.definition, font: "Georgia", size: 22 })] })],
          }),
        ],
      })),
    ];

    allSections.push({
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: BOOK_TITLE, italics: true, font: "Georgia", size: 18 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
              font: "Georgia", size: 18,
            })],
          })],
        }),
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: true,
          children: [new TextRun("Glossary")],
        }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 6560],
          rows: glossaryRows,
        }),
      ],
    });
  }

  // Create the document
  const doc = new Document({
    features: { updateFields: true },
    styles: bookStyles,
    numbering: {
      config: [
        {
          reference: "prayer-bullets",
          levels: [{
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 720, hanging: 360 } },
              run: { font: "Symbol", size: 24 },
            },
          }],
        },
      ],
    },
    sections: allSections,
  });

  // Generate output
  const outputDir = path.join(PROJECT_DIR, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${BOOK_TITLE}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  const fileSizeKB = Math.round(buffer.length / 1024);
  const frontMatterPages = 4 + (has_foreword ? 1 : 0) + 1; // half title + full title + copyright + dedication + foreword(?) + TOC
  const backMatterSections = (hasScriptures && IS_THEOLOGICAL ? 1 : 0) + (KEY_TERMS.length > 0 ? 1 : 0) + 1; // +1 for About the Author
  const enrichmentNote = has_enrichments ? ', enrichments after each chapter' : '';
  console.log(`Generated ${BOOK_TITLE}.docx (${fileSizeKB} KB) with ${chapterFiles.length} chapters, ${frontMatterPages} front matter pages, ${backMatterSections} back matter sections${enrichmentNote}`);
}

main().catch(err => { console.error('Error generating .docx:', err); process.exit(1); });
```

**Placeholder replacement:** Before writing the script to a temp file, replace the `__PLACEHOLDER__` values with actual data extracted from book-dna.md:
- `__PROJECT_DIR__` -- the project directory path
- `__BOOK_TITLE__` -- from Book DNA Metadata > Title
- `__BOOK_SUBTITLE__` -- from Book DNA Metadata > Subtitle (empty string if none or placeholder)
- `__AUTHOR_NAME__` -- from Book DNA Metadata > Author
- `__AUTHOR_BIO__` -- from Book DNA Metadata > author_bio (empty string if absent)
- `__IS_THEOLOGICAL__` -- `true` if voice profile has theological framework, `false` otherwise
- `__SCRIPTURE_TRANSLATION__` -- from Style Rules (default: "New King James Version (NKJV)")
- `__CHAPTER_TITLES_JSON__` -- JSON array of chapter titles from the Chapter Map table
- `__KEY_TERMS_JSON__` -- JSON array of `{ name, definition }` objects from Key Terms table

## 8. Post-Generation

After the script runs:

1. Verify the .docx file exists and is > 0 bytes:
   ```bash
   [ -f "[output_path]" ] && [ -s "[output_path]" ] && echo "OK" || echo "FAILED"
   ```
2. Report file size:
   ```bash
   ls -lh "[output_path]"
   ```
3. Note: "Run `python scripts/office/validate.py [output.docx]` if available for .docx validation"
4. Report: "Generated [Book Title].docx ([size] KB) with [N] chapters, 5 front matter pages, [M] back matter sections"

## 9. Canonical Bible Books Array

The full 66-book canonical order for scripture index sorting. "Psalm" is included as an alias for "Psalms".

```javascript
const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
  "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Psalm",
  "Proverbs", "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
  "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon",
  "Hebrews", "James", "1 Peter", "2 Peter",
  "1 John", "2 John", "3 John", "Jude", "Revelation",
];
```

## 10. Critical Rules

These rules are inherited from the existing docx skill and MUST be followed in every generation:

- **ALWAYS** use `WidthType.DXA` -- NEVER use `WidthType.PERCENTAGE` (breaks in Google Docs)
- **NEVER** use unicode bullet characters -- use `LevelFormat.BULLET` with numbering config if lists are needed
- **ALWAYS** use `ShadingType.CLEAR` for table shading -- NEVER use `ShadingType.SOLID`
- **ALWAYS** set page size explicitly: 12240 x 15840 DXA (US Letter)
- **ALWAYS** include `outlineLevel: 0` on Heading1 paragraph style -- required for TOC pickup
- **PageBreak** must be inside a Paragraph (use `pageBreakBefore: true` on the paragraph)
- **Tables need dual widths:** `columnWidths` on the Table AND `width` on each TableCell, both in DXA
- **Table width** must equal the sum of `columnWidths`
- Use `HeadingLevel` enum for headings -- no custom styles that break TOC
- **ALWAYS** set `features: { updateFields: true }` on the Document for TOC auto-population
- Never use `\n` for line breaks -- use separate Paragraph elements
- Cell `margins` are internal padding -- they reduce content area, not add to cell width

## 11. Anti-Patterns

- Do NOT modify Book DNA, voice-profile.md, chapter-outline.md, or any shared file
- Do NOT fabricate author biographical content -- use the placeholder if no bio is provided
- Do NOT hardcode absolute paths -- use `${CLAUDE_PLUGIN_ROOT}` for plugin paths and the project directory for book paths
- Do NOT use tables as dividers or rules in headers/footers -- use tab stops instead
- Do NOT include the Scripture Index section if no scripture references are found
- Do NOT include the Glossary section if the Key Terms table is empty
- Do NOT use `WidthType.PERCENTAGE` anywhere in the document
- Do NOT use unicode bullet characters (no `\u2022`, no `"* "` prefix)
- Do NOT spawn subagents -- the formatter runs as a single skill
