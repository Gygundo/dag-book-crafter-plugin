#!/usr/bin/env node
// scripts/craft-check.js — deterministic craft rule checker for DAG-01/02/04/05/06/07
// Zero dependencies. Usage: node scripts/craft-check.js <chapter-path>
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSLITERATED_TERMS = [
  'charis', 'agape', 'phileo', 'eros', 'storge',
  'dunamis', 'exousia', 'logos', 'rhema', 'pneuma',
  'sarx', 'kairos', 'chronos', 'sunergeo', 'pas',
  'shalom', 'hesed', 'chesed', 'ruach', 'yada',
  'ahavah', 'nephesh', 'echad', 'koinonia', 'metanoia'
];

const STORY_MARKER_RE   = /^(One day|Years ago|I remember|When I was|Once,|Some years ago|There was a time|Picture this|Imagine)/i;
const VERSION_STAMP_RE  = /^<!-- generated-by: dag-book-crafter v\d+\.\d+\.\d+ -->$/m;
const PROVENANCE_ANY_RE = /^<!-- provenance: /m;
const PROVENANCE_OK_RE  = /^<!-- provenance: .+:\d+ -->$/m;
const HEDGING_RE        = /\b(some scholars|it could be argued|arguably|studies suggest|research shows|one might|it seems that|in my view|perhaps we might|broadly speaking|to some extent|many believe)\b/i;
const KEY_STMT_RE       = /^[A-Z][^\n]{20,160}[.!]$/m;
const CAPS_QUOTE_RE     = /^>.*\b[A-Z]{3,}(?:[ ,][A-Z]{2,}){2,}/m;
const SCRIPTURE_REF_RE  = /^>\s*--\s*.+/;
const VERSE_RE          = /\b([1-3]\s)?[A-Z][a-z]+\.?\s\d+:\d+/;
const CLIFFHANGER_RE    = /(in the next chapter|we will see|but that is another|what comes next|we have not talked about|there is something we|\.\.\.\s*$)/i;

// DAG-09 — AI-slop scan (kept in sync with references/dag-craft-rules.md § DAG-09)
const EM_DASH_RE        = /—| – /;
const NEGATION_PIVOT_RES = [
  /\b(is not|isn't|was not|wasn't|are not|aren't|does not|doesn't)\s+(just|merely|simply)\b/gi,
  /\bnot\s+(just|merely|simply)\s/gi,
  /\bmore than just\b/gi,
  /\bnot only\b[^.!?\n]{0,80}\bbut also\b/gi,
  /\bit('|i)s not about\b[^.!?\n]{0,80}\bit('|i)s about\b/gi
];
const SLOP_PHRASES = [
  'delve', 'delves', 'delving', 'deep dive', 'dive into', 'dives into', 'diving into',
  'tapestry', 'a testament to', 'stands as a testament',
  "in today's fast-paced world", "in today's world", 'in an era of', 'in a world where',
  'game-changer', 'game changing', 'transformative power',
  'it is important to note', "it's important to note", 'it is worth noting', "it's worth noting",
  'at the end of the day', "let's unpack", 'let us unpack', "let's explore", 'let us explore',
  'in conclusion', 'embark on', 'embarking on', 'the landscape of',
  'navigating the complexities', 'elevate your', 'unlock the secrets', 'supercharge',
  'a powerful reminder', 'moreover', 'furthermore', 'additionally'
];
const SLOP_RE  = new RegExp('\\b(' + SLOP_PHRASES.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

function getBodyText(content) {
  return content
    .replace(/<!--\s*METADATA[\s\S]*?-->/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#.*$/gm, '');
}

function getAuthorProseText(content) {
  return getBodyText(content)
    .split('\n')
    .filter(l => { const t = l.trim(); return t && !t.startsWith('>') && !t.startsWith('#'); })
    .join(' ');
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// STAMP
// ---------------------------------------------------------------------------

function checkStamp(content) {
  if (VERSION_STAMP_RE.test(content)) {
    return { pass: true, evidence: 'version stamp present' };
  }
  return { pass: false, evidence: 'version stamp missing — must match <!-- generated-by: dag-book-crafter vX.Y.Z -->' };
}

// ---------------------------------------------------------------------------
// PROVENANCE
// ---------------------------------------------------------------------------

function checkProvenance(content) {
  if (!PROVENANCE_ANY_RE.test(content)) {
    return { pass: true, evidence: 'no provenance comment declared (topic-brief mode — OK)' };
  }
  if (PROVENANCE_OK_RE.test(content)) {
    return { pass: true, evidence: 'provenance comment present and well-formed' };
  }
  return { pass: false, evidence: 'provenance comment malformed — must be <!-- provenance: path:line -->' };
}

// ---------------------------------------------------------------------------
// DAG-01: Verse-or-Declaration Opener
// ---------------------------------------------------------------------------

function checkDag01(content) {
  for (const para of content.split(/\n\n+/)) {
    const t = para.trim();
    if (!t) continue;
    if (t.startsWith('<!--')) continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('>')) {
      return { pass: true, evidence: 'opener is a scripture blockquote (anchor_scripture type — valid)' };
    }
    if (STORY_MARKER_RE.test(t)) {
      const marker = t.split(/\s+/).slice(0, 4).join(' ');
      return { pass: false, evidence: `story-marker opener detected: "${marker}..."` };
    }
    return { pass: true, evidence: 'opener is a declaration or definition (not a story marker)' };
  }
  return { pass: true, evidence: 'no body paragraph found to check' };
}

// ---------------------------------------------------------------------------
// DAG-02: Scripture Block Density
// ---------------------------------------------------------------------------

function extractScriptureBlocks(content) {
  const lines  = content.split('\n');
  const blocks = [];
  let current  = [];

  const flush = () => {
    if (!current.length) return;
    const last        = current[current.length - 1];
    const hasRefLine  = SCRIPTURE_REF_RE.test(last);
    const hasVerseRef = current.some(l => VERSE_RE.test(l));
    if (hasRefLine || hasVerseRef) {
      const refLine        = current.find(l => SCRIPTURE_REF_RE.test(l)) || '';
      const hasTranslation = /\([A-Z]{2,5}\)\s*$/.test(refLine);
      blocks.push({ refLine, hasTranslation });
    }
    current = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('>')) { current.push(line.trim()); }
    else { flush(); }
  }
  flush();
  return blocks;
}

function checkDag02(content) {
  const bodyWords  = countWords(getBodyText(content));
  const blocks     = extractScriptureBlocks(content);
  const count      = blocks.length;
  const byDensity  = bodyWords > 0 ? Math.ceil(bodyWords / 350) : 0;
  const needed     = Math.max(3, byDensity);
  const ratio      = bodyWords > 0 ? (count / (bodyWords / 350)).toFixed(2) : 'N/A';
  const translated = blocks.filter(b => b.hasTranslation).length;

  return {
    pass: count >= needed,
    evidence: `${count} scripture block(s), ${bodyWords} body words, density ratio ${ratio} (need >=3 and >=1 per 350 words, so need ${needed})`,
    scripture_count: count,
    body_words: bodyWords,
    required: needed,
    translated_blocks: translated
  };
}

// ---------------------------------------------------------------------------
// DAG-04: Key Statement Emphasis (flag-only — always pass:true)
// ---------------------------------------------------------------------------

function checkDag04(content) {
  let hasKeyStatement = false;
  for (const para of content.split(/\n\n+/)) {
    const t = para.trim();
    if (!t || t.startsWith('>') || t.startsWith('#') || t.startsWith('<!--')) continue;
    const nonBlankLines = t.split('\n').filter(l => l.trim());
    if (nonBlankLines.length === 1 && KEY_STMT_RE.test(t)) {
      hasKeyStatement = true;
      break;
    }
  }
  const hasCapsInQuote = CAPS_QUOTE_RE.test(content);
  return {
    pass: true,
    evidence: `key_statement: ${hasKeyStatement}, caps_in_quote: ${hasCapsInQuote}`,
    has_key_statement: hasKeyStatement,
    has_caps_in_quote: hasCapsInQuote
  };
}

// ---------------------------------------------------------------------------
// DAG-05: Chapter Word Count
// ---------------------------------------------------------------------------

function checkDag05(content) {
  const body      = getBodyText(content);
  const wordCount = countWords(body);
  let target      = null;
  const metaM     = content.match(/<!--\s*METADATA([\s\S]*?)-->/i);
  if (metaM) {
    const tM = metaM[1].match(/target_count\s*:\s*(\d+)/);
    if (tM) target = parseInt(tM[1], 10);
  }
  const cap      = target ? Math.round(target * 1.5) : 2500;
  const tooShort = wordCount < 400;

  if (wordCount > cap) {
    return {
      pass: false,
      evidence: `word count ${wordCount} exceeds cap ${cap}${target ? ` (target ${target} x1.5)` : ' (default 2500)'}`,
      word_count: wordCount, cap, target, too_short: false
    };
  }
  return {
    pass: true,
    evidence: `word count ${wordCount}${tooShort ? ' (FLAG: < 400 — may be too short)' : ''}`,
    word_count: wordCount, cap, target, too_short: tooShort
  };
}

// ---------------------------------------------------------------------------
// DAG-06: Plain Language
// ---------------------------------------------------------------------------

function checkDag06(content) {
  const prose = getAuthorProseText(content);

  const hedgeM     = prose.match(HEDGING_RE);
  const hasHedging = !!hedgeM;

  const termRe    = new RegExp(`\\b(${TRANSLITERATED_TERMS.join('|')})\\b`, 'gi');
  const termHits  = [...prose.matchAll(termRe)];
  const distinct  = new Set(termHits.map(m => m[1].toLowerCase()));
  const termCount = distinct.size;
  const termFail  = termCount > 1;

  const rawSents   = prose.match(/[^.!?]*[.!?]+/g) || [];
  const sentLens   = rawSents.map(s => s.trim().split(/\s+/).filter(Boolean).length).filter(n => n > 0);
  const avgSentLen = sentLens.length ? sentLens.reduce((a, b) => a + b, 0) / sentLens.length : 0;
  const sentFlag   = avgSentLen > 18;

  return {
    pass: !hasHedging && !termFail,
    evidence: [
      hasHedging ? `hedging: "${hedgeM[0]}"` : 'no hedging',
      termFail
        ? `${termCount} distinct transliterated terms (cap 1): ${[...distinct].join(', ')}`
        : `${termCount} transliterated term(s)`,
      `avg sentence ${avgSentLen.toFixed(1)} words${sentFlag ? ' (FLAG: >18)' : ''}`
    ].join('; '),
    has_hedging: hasHedging,
    hedging_phrase: hasHedging ? hedgeM[0] : null,
    transliterated_term_count: termCount,
    distinct_terms: [...distinct],
    avg_sentence_length: parseFloat(avgSentLen.toFixed(1)),
    sentence_length_flag: sentFlag
  };
}

// ---------------------------------------------------------------------------
// DAG-07: Direct Address and Exhortation Close (flag-only — always pass:true)
// ---------------------------------------------------------------------------

function checkDag07(content) {
  const prose      = getAuthorProseText(content);
  const proseWords = countWords(prose);
  const youHits    = [...prose.matchAll(/\byou\b|\byour\b|\byourself\b/gi)];
  const youPer1k   = proseWords > 0 ? (youHits.length / proseWords) * 1000 : 0;
  const qCount     = (content.match(/\?/g) || []).length;

  const paras     = content.split(/\n\n+/).filter(p => p.trim());
  const finalPara = (paras[paras.length - 1] || '').trim();
  const cliffMatch = CLIFFHANGER_RE.test(finalPara);

  const sents   = finalPara.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  const lastSent = (sents[sents.length - 1] || '').trim();
  const cliffhanger = cliffMatch || lastSent.endsWith('?');

  return {
    pass: !cliffhanger,
    evidence: [
      `you-density: ${youPer1k.toFixed(1)}/1k (${youPer1k >= 8 ? 'OK' : 'FLAG: need >=8'})`,
      `questions: ${qCount} (${qCount >= 4 ? 'OK' : 'FLAG: need >=4'})`,
      `cliffhanger: ${cliffhanger ? 'FLAG' : 'OK'}`
    ].join('; '),
    you_density: parseFloat(youPer1k.toFixed(1)),
    you_count: youHits.length,
    question_count: qCount,
    cliffhanger,
    you_pass: youPer1k >= 8,
    question_pass: qCount >= 4
  };
}

// ---------------------------------------------------------------------------
// DAG-09 — AI-slop scan
// ---------------------------------------------------------------------------

function checkDag09(content) {
  // Author prose + headings, blockquotes excluded (KJV itself says "furthermore";
  // a quoted translation may legitimately contain an em dash).
  const nonQuote = getBodyText(content)
    .split('\n')
    .filter(l => !l.trim().startsWith('>'))
    .join('\n');
  const prose = getAuthorProseText(content);

  const emDash = EM_DASH_RE.test(nonQuote);

  // Count pivots with overlap dedup — "is not just" matches two patterns but is ONE pivot.
  const pivotRanges = [];
  const pivotSamples = [];
  for (const re of NEGATION_PIVOT_RES) {
    for (const m of prose.matchAll(re)) {
      const start = m.index, end = m.index + m[0].length;
      if (pivotRanges.some(([s, e]) => start < e && end > s)) continue;
      pivotRanges.push([start, end]);
      if (pivotSamples.length < 3) pivotSamples.push(m[0].slice(0, 60));
    }
  }
  const pivotCount = pivotRanges.length;

  const slopMatch  = prose.match(SLOP_RE);
  const emojiMatch = EMOJI_RE.test(nonQuote);

  const pass = !emDash && pivotCount <= 1 && !slopMatch && !emojiMatch;
  return {
    pass,
    evidence: [
      `em_dash: ${emDash ? 'FAIL' : 'OK'}`,
      `negation_pivots: ${pivotCount} (cap 1${pivotCount > 1 ? ' — FAIL' : ''})${pivotSamples.length ? ' [' + pivotSamples.join(' | ') + ']' : ''}`,
      `slop_phrase: ${slopMatch ? 'FAIL: "' + slopMatch[0] + '"' : 'OK'}`,
      `emoji: ${emojiMatch ? 'FAIL' : 'OK'}`
    ].join('; '),
    em_dash: emDash,
    negation_pivot_count: pivotCount,
    slop_phrase: slopMatch ? slopMatch[0] : null,
    emoji: emojiMatch
  };
}

// ---------------------------------------------------------------------------
// Main — single chapter mode
// ---------------------------------------------------------------------------

function main() {
  const chapterPath = process.argv[2];
  if (!chapterPath) {
    console.error('Usage: node craft-check.js <chapter-path>');
    process.exit(2);
  }
  let content;
  try { content = fs.readFileSync(chapterPath, 'utf8'); }
  catch (err) { console.error(`Error reading ${chapterPath}: ${err.message}`); process.exit(2); }

  const chapterId = path.basename(chapterPath, path.extname(chapterPath));
  const result = {
    chapter_id: chapterId,
    checks: {
      STAMP:      checkStamp(content),
      PROVENANCE: checkProvenance(content),
      'DAG-01':   checkDag01(content),
      'DAG-02':   checkDag02(content),
      'DAG-04':   checkDag04(content),
      'DAG-05':   checkDag05(content),
      'DAG-06':   checkDag06(content),
      'DAG-07':   checkDag07(content),
      'DAG-09':   checkDag09(content)
    }
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(Object.values(result.checks).some(c => !c.pass) ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Novelty / De-duplication engine
// ---------------------------------------------------------------------------

function parseNoveltyArgs(argv) {
  const args = argv.slice(2);
  const out  = { tier: 'both', dna: null, dir: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--novelty') continue;
    if (a === '--tier')    { out.tier = args[++i]; continue; }
    if (a === '--dna')     { out.dna  = args[++i]; continue; }
    if (!a.startsWith('--') && !out.dir) { out.dir = a; continue; }
  }
  if (!out.dir) {
    console.error('Usage: craft-check.js --novelty [--tier 1|2|both] [--dna <book-dna.md>] <project-dir>');
    process.exit(2);
  }
  if (!out.dna) out.dna = path.join(out.dir, 'book-dna.md');
  return out;
}

function readRefrainsFromDna(dnaPath) {
  if (!dnaPath || !fs.existsSync(dnaPath)) return [];
  const text    = fs.readFileSync(dnaPath, 'utf8');
  const lines   = text.split('\n');
  const refrains = [];
  let inBlock = false;
  let current = null;

  for (const raw of lines) {
    if (/^\s*refrains\s*:\s*$/.test(raw))           { inBlock = true; current = null; continue; }
    if (/^\s*refrains\s*:\s*\[\s*\]\s*$/.test(raw)) { return []; }
    if (!inBlock) continue;
    if (/^```/.test(raw.trim()))                     { inBlock = false; continue; }
    if (/^#{1,6}\s/.test(raw))                       { inBlock = false; continue; }
    if (/^[a-zA-Z_][\w-]*\s*:/.test(raw) && !/^\s/.test(raw)) { inBlock = false; continue; }
    if (/^\s*$/.test(raw)) { if (refrains.length > 0) inBlock = false; continue; }

    const em = raw.match(/^\s*-\s*phrase\s*:\s*(.+?)\s*$/);
    if (em) { if (current) refrains.push(current); current = { phrase: stripQ(em[1]), max_uses: 1, scope: 'whole_book' }; continue; }
    const mm = raw.match(/^\s*max_uses\s*:\s*(.+?)\s*$/);
    if (mm && current) { const v = stripQ(mm[1]); current.max_uses = v === 'unlimited' ? Infinity : parseInt(v, 10); continue; }
    const sm = raw.match(/^\s*scope\s*:\s*(.+?)\s*$/);
    if (sm && current) { current.scope = stripQ(sm[1]); continue; }
  }
  if (current) refrains.push(current);
  return refrains;
}

function stripQ(s) {
  s = s.trim();
  return ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    ? s.slice(1, -1) : s;
}

// Normalise text for shingling — strips comments, blockquotes, "May you" lines, markdown
function normaliseForShingling(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^>.*$/gm, ' ')
    .replace(/^May you .*$/gm, ' ')
    .replace(/[*_`#>\[\]()]/g, ' ')
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(tokens, n) {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push({ phrase: tokens.slice(i, i + n).join(' '), start: i });
  return out;
}

function findCrossFileRepeats(files, refrains, n) {
  const index        = new Map();
  const tokensByFile = new Map();

  for (const f of files) {
    const tokens = normaliseForShingling(f.text).split(' ').filter(Boolean);
    tokensByFile.set(f.path, tokens);
    for (const { phrase, start } of shingles(tokens, n)) {
      if (!index.has(phrase)) index.set(phrase, []);
      index.get(phrase).push({ file: f.path, start });
    }
  }

  const refrainShingleMap = new Map();
  for (const r of refrains) {
    const toks = normaliseForShingling(r.phrase).split(' ').filter(Boolean);
    if (toks.length < n) continue;
    for (const { phrase } of shingles(toks, n)) refrainShingleMap.set(phrase, r);
  }

  const refrainFirstShingle = new Map();
  for (const r of refrains) {
    const toks = normaliseForShingling(r.phrase).split(' ').filter(Boolean);
    if (toks.length < n) continue;
    refrainFirstShingle.set(r.phrase, toks.slice(0, n).join(' '));
  }

  const refrainOveruse = [];
  for (const r of refrains) {
    const fs2 = refrainFirstShingle.get(r.phrase);
    if (!fs2) continue;
    const locs        = index.get(fs2) || [];
    const distinctFiles = [...new Set(locs.map(l => l.file))];
    const maxUses     = r.max_uses === Infinity ? Infinity : r.max_uses;
    if (locs.length > maxUses) refrainOveruse.push({ phrase: r.phrase, max_uses: maxUses, actual_occurrences: locs.length, files: distinctFiles });
  }

  const rawSpans = [];
  for (const [phrase, locs] of index) {
    if (refrainShingleMap.has(phrase)) continue;
    const distinctFiles = new Set(locs.map(l => l.file));
    if (distinctFiles.size < 2) continue;
    let k = 0;
    while (true) {
      let ok = true, ref = null;
      for (const loc of locs) {
        const toks = tokensByFile.get(loc.file);
        if (loc.start + n + k >= toks.length) { ok = false; break; }
        const next = toks[loc.start + n + k];
        if (ref === null) ref = next; else if (next !== ref) { ok = false; break; }
      }
      if (!ok) break;
      k++;
    }
    const fl   = locs[0];
    const ftoks = tokensByFile.get(fl.file);
    rawSpans.push({ phrase: ftoks.slice(fl.start, fl.start + n + k).join(' '), occurrences: locs, span_length: n + k });
  }

  rawSpans.sort((a, b) => b.span_length - a.span_length);
  const kept = [];
  for (const sp of rawSpans) {
    let redundant = true;
    for (const loc of sp.occurrences) {
      let covered = false;
      for (const k of kept) {
        for (const kloc of k.occurrences) {
          if (kloc.file === loc.file && loc.start >= kloc.start && loc.start + sp.span_length <= kloc.start + k.span_length) { covered = true; break; }
        }
        if (covered) break;
      }
      if (!covered) { redundant = false; break; }
    }
    if (!redundant) kept.push(sp);
  }

  return { repeatedSpans: kept.map(sp => ({ phrase: sp.phrase, occurrences: sp.occurrences })), refrainOveruse };
}

// ---------------------------------------------------------------------------
// Illustration-echo check (replaces vulnerability-beat reuse)
// ---------------------------------------------------------------------------

const ILLUS_OPENER_RE = /^(Years ago|One day|Some years ago|I remember|When I was)\b/i;

function extractIllustrations(text) {
  return text.split(/\n\n+/).filter(p => ILLUS_OPENER_RE.test(p.trim()));
}

function findIllustrationEcho(files) {
  const rich  = files.map(f => ({ path: f.path, illustrations: extractIllustrations(f.text) })).filter(f => f.illustrations.length > 0);
  const hits  = [];
  for (let i = 0; i < rich.length; i++) {
    for (let j = i + 1; j < rich.length; j++) {
      const fa = rich[i], fb = rich[j];
      for (const illA of fa.illustrations) {
        const tokA = normaliseForShingling(illA).split(' ').filter(Boolean);
        const shinA = new Set();
        for (let k = 0; k + 6 <= tokA.length; k++) shinA.add(tokA.slice(k, k + 6).join(' '));
        for (const illB of fb.illustrations) {
          const tokB = normaliseForShingling(illB).split(' ').filter(Boolean);
          let found = false;
          for (let k = 0; !found && k + 6 <= tokB.length; k++) {
            if (shinA.has(tokB.slice(k, k + 6).join(' '))) found = true;
          }
          if (found) hits.push({ type: 'illustration_echo', source: fa.path, duplicate: fb.path, note: '6+ word overlap between time-marker illustration paragraphs' });
        }
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Key-statement distinctness (replaces vehicleDistinctness / central_image)
// ---------------------------------------------------------------------------

const KS_STOP = new Set([
  'the','a','an','of','on','in','over','to','and','at','is','are','was','were',
  'be','been','being','have','has','had','do','does','did','for','not','with',
  'this','that','it','he','she','they','we','you','i','my','your','his','her',
  'its','our','their','or','but','if','as','by','from','so'
]);

function parseKeyStatements(dnaText) {
  const out = [];
  const re  = /key_statement\s*:\s*(.+?)\s*$/gm;
  let m;
  while ((m = re.exec(dnaText)) !== null) {
    const stmt = m[1].trim().replace(/^["']|["']$/g, '');
    if (stmt) out.push(stmt);
  }
  return out;
}

function normKS(stmt) {
  return stmt.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t && !KS_STOP.has(t));
}

function jaccard(a, b) {
  const sa = new Set(a), sb = new Set(b);
  const inter = [...sa].filter(t => sb.has(t)).length;
  const union  = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

function findKeyStatementDuplicates(keyStatements, refrains) {
  if (keyStatements.length < 2) return [];
  const rfNorms = new Set(refrains.map(r => normKS(r.phrase).join(' ')));
  const norms   = keyStatements.map(normKS);
  const hits    = [];
  for (let i = 0; i < keyStatements.length; i++) {
    for (let j = i + 1; j < keyStatements.length; j++) {
      const ov = jaccard(norms[i], norms[j]);
      if (ov >= 0.8) {
        const na = norms[i].join(' '), nb = norms[j].join(' ');
        if (!rfNorms.has(na) && !rfNorms.has(nb)) {
          hits.push({ type: 'key_statement_duplicate', statement_a: keyStatements[i], statement_b: keyStatements[j], overlap: parseFloat(ov.toFixed(2)) });
        }
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Tier-2 enrichment checks (unchanged from original)
// ---------------------------------------------------------------------------

function parseChapterMap(dnaPath) {
  if (!dnaPath || !fs.existsSync(dnaPath)) return [];
  const text = fs.readFileSync(dnaPath, 'utf8');
  const out  = [];
  const re   = /^-\s+Ch\s+(\d+)\s+central_image:\s*(.+)$/gm;
  let m;
  while ((m = re.exec(text))) out.push({ chapter: parseInt(m[1], 10), vehicle: m[2].trim() });
  return out;
}

function runTier2(dir, chapterMap) {
  const enrichDir = fs.existsSync(path.join(dir, 'enrichments'))
    ? path.join(dir, 'enrichments') : path.join(dir, 'enriched');
  const hits = { discussion_question_stems: [], prayer_point_repetition: [], vulnerability_bleed_to_summary: [], vehicle_reuse_in_backmatter: [] };
  if (!fs.existsSync(enrichDir)) return hits;

  const enrichFiles = fs.readdirSync(enrichDir).filter(f => f.endsWith('.md')).map(f => ({
    path: path.join('enrichments', f),
    text: fs.readFileSync(path.join(enrichDir, f), 'utf8')
  }));

  // Rule 1: discussion-question stems
  const stemMap = new Map();
  for (const f of enrichFiles) {
    const items = [];
    const sm = f.text.match(/##\s*Discussion Questions[\s\S]*?(?=\n##\s|\n$|$)/i);
    if (sm) { for (const line of sm[0].split('\n')) { const lm = line.match(/^\s*(?:\d+\.\s+|[-*]\s+)(.+?)\s*$/); if (lm) items.push(lm[1]); } }
    for (const q of (f.text.match(/[^.!?\n]*\?/g) || [])) items.push(q);
    for (const q of items) {
      const norm = normaliseForShingling(q).split(' ').filter(Boolean);
      if (norm.length < 8) continue;
      const stem = norm.slice(0, 8).join(' ');
      if (!stemMap.has(stem)) stemMap.set(stem, new Set());
      stemMap.get(stem).add(f.path);
    }
  }
  for (const [stem, files] of stemMap) { if (files.size >= 2) hits.discussion_question_stems.push({ stem, files: [...files] }); }

  // Rule 2: prayer-point repetition (theological-gated)
  const vpPath = [path.join(dir, 'voice-profile.md'), path.join(dir, '..', 'voice-profile.md')].find(p => fs.existsSync(p));
  if (vpPath && /## Theological Framework/.test(fs.readFileSync(vpPath, 'utf8'))) {
    const cross = findCrossFileRepeats(enrichFiles, [], 6);
    for (const r of cross.repeatedSpans) {
      if (/\b(father|god|lord|ask|pray)\b/.test(r.phrase)) hits.prayer_point_repetition.push({ phrase: r.phrase, files: [...new Set(r.occurrences.map(o => o.file))], theological_gated: true });
    }
  }

  // Rule 3: vulnerability bleed
  const editedDir = path.join(dir, 'edited');
  if (fs.existsSync(editedDir)) {
    const vulnAnchors = ['i stood','i sat','i was','i felt','i remember','i tried','i could not','my hands','my chest','the counter','the kitchen'];
    for (const ef of fs.readdirSync(editedDir).filter(f => /^ch\d+-final\.md$/.test(f))) {
      const chNum     = (ef.match(/ch(\d+)/) || [])[1];
      const normEd    = normaliseForShingling(fs.readFileSync(path.join(editedDir, ef), 'utf8'));
      for (const enr of enrichFiles) {
        const enrCh = (enr.path.match(/ch(\d+)/) || [])[1];
        if (enrCh === chNum) continue;
        const normEnr = normaliseForShingling(enr.text);
        for (const anchor of vulnAnchors) {
          const idx = normEd.indexOf(anchor);
          if (idx < 0) continue;
          const sig = normEd.slice(idx).split(' ').filter(Boolean).slice(0, 10).join(' ');
          if (sig && normEnr.includes(sig)) hits.vulnerability_bleed_to_summary.push({ source_chapter: `ch${chNum}`, duplicate_file: enr.path, span: sig });
        }
      }
    }
  }

  // Rule 4: vehicle reuse in back matter
  for (const ch of chapterMap) {
    const vNorm = normaliseForShingling(ch.vehicle);
    if (!vNorm) continue;
    for (const enr of enrichFiles) {
      const enrChM = enr.path.match(/ch(\d+)/);
      if (!enrChM || parseInt(enrChM[1], 10) === ch.chapter) continue;
      if (normaliseForShingling(enr.text).includes(vNorm)) hits.vehicle_reuse_in_backmatter.push({ vehicle: ch.vehicle, source_chapter: `ch${ch.chapter}`, duplicate_file: enr.path });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// mainNovelty
// ---------------------------------------------------------------------------

function mainNovelty() {
  const opts      = parseNoveltyArgs(process.argv);
  const projectDir = path.resolve(opts.dir);
  if (!fs.existsSync(projectDir)) { console.error(`Project directory does not exist: ${projectDir}`); process.exit(2); }

  const refrains      = readRefrainsFromDna(opts.dna);
  const chapterMap    = parseChapterMap(opts.dna);
  const dnaText       = (opts.dna && fs.existsSync(opts.dna)) ? fs.readFileSync(opts.dna, 'utf8') : '';
  const keyStatements = parseKeyStatements(dnaText);

  const tier1Files = [];
  const fmDir = path.join(projectDir, 'front-matter');
  if (fs.existsSync(fmDir)) {
    for (const f of fs.readdirSync(fmDir).filter(f => f.endsWith('.md'))) {
      tier1Files.push({ path: path.join('front-matter', f), text: fs.readFileSync(path.join(fmDir, f), 'utf8') });
    }
  }
  const edDir = path.join(projectDir, 'edited');
  if (fs.existsSync(edDir)) {
    for (const f of fs.readdirSync(edDir).filter(f => /^ch\d+-final\.md$/.test(f))) {
      tier1Files.push({ path: path.join('edited', f), text: fs.readFileSync(path.join(edDir, f), 'utf8') });
    }
  }

  let repeatedSpans    = [];
  let illustrationEcho = [];
  let keyStatementDups = [];
  let refrainOveruse   = [];
  let tier2Hits = { discussion_question_stems: [], prayer_point_repetition: [], vulnerability_bleed_to_summary: [], vehicle_reuse_in_backmatter: [] };

  if (opts.tier === '1' || opts.tier === 'both') {
    const cross      = findCrossFileRepeats(tier1Files, refrains, 6);
    repeatedSpans    = cross.repeatedSpans;
    refrainOveruse   = cross.refrainOveruse;
    illustrationEcho = findIllustrationEcho(tier1Files);
    keyStatementDups = findKeyStatementDuplicates(keyStatements, refrains);
  }
  if (opts.tier === '2' || opts.tier === 'both') {
    tier2Hits = runTier2(projectDir, chapterMap);
  }

  const anyTier2 = Object.values(tier2Hits).some(arr => arr.length > 0);
  const flag     = repeatedSpans.length > 0 || illustrationEcho.length > 0 ||
                   keyStatementDups.length > 0 || refrainOveruse.length > 0 || anyTier2;

  const result = {
    mode: 'novelty',
    tier: opts.tier,
    project_dir: projectDir,
    repeated_spans: repeatedSpans,
    illustration_echo: illustrationEcho,
    key_statement_duplicates: keyStatementDups,
    refrain_overuse: refrainOveruse,
    tier2_hits: tier2Hits,
    tier2: tier2Hits,
    flag,
    novelty_dedup: flag ? 'fail' : 'pass'
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(flag ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (process.argv.includes('--novelty')) {
  mainNovelty();
} else {
  main();
}
