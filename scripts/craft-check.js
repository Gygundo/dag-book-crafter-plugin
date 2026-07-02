#!/usr/bin/env node
// scripts/craft-check.js — deterministic craft rule checker for CRAFT-01/02/05/07/15
// Zero dependencies. Usage: node scripts/craft-check.js <chapter-path>

const fs = require('node:fs');
const path = require('node:path');

const TRANSLITERATED_TERMS = [
  'charis', 'agape', 'phileo', 'eros', 'storge',
  'dunamis', 'exousia', 'logos', 'rhema', 'pneuma',
  'sarx', 'kairos', 'chronos', 'sunergeo', 'pas',
  'shalom', 'hesed', 'chesed', 'ruach', 'yada',
  'ahavah', 'nephesh', 'echad', 'koinonia', 'metanoia'
];

const PULPIT_SEAM_REGEX = /^(So|Now|And so|Let us|Let me|Here'?s where|Here'?s the thing|You see|Listen|Church|Friend)[\s,.!?]/i;
const PROVENANCE_REGEX = /^<!-- provenance: (.+):(\d+) -->$/;
const VERSION_STAMP_REGEX = /^<!-- generated-by: dag-book-crafter v\d+\.\d+\.\d+ -->$/m;
const READER_THOUGHT_REGEX = /(?:^>\s*\*"|^\*")[^"*]{5,200}\?["*]/gm;

function checkCraft01(content, chapterPath) {
  const firstLine = content.split('\n')[0];
  const match = firstLine.match(PROVENANCE_REGEX);
  if (!match) {
    return { pass: false, evidence: 'missing or malformed provenance comment', citations: ['line 1'] };
  }
  const refPath = match[1];
  const refLine = match[2];
  const projectRoot = path.dirname(path.dirname(path.resolve(chapterPath)));
  const resolved = path.resolve(projectRoot, refPath);
  if (!fs.existsSync(resolved)) {
    return { pass: false, evidence: `provenance path does not exist: ${refPath}`, citations: ['line 1'] };
  }
  const lines = fs.readFileSync(resolved, 'utf8').split('\n');
  if (lines.length < parseInt(refLine, 10)) {
    return { pass: false, evidence: `provenance line ${refLine} beyond end of ${refPath} (${lines.length} lines)`, citations: ['line 1'] };
  }
  return { pass: true, evidence: `provenance resolves to ${refPath}:${refLine}`, citations: ['line 1'] };
}

function checkCraft02(content) {
  const regex = new RegExp(`\\b(?:\\*)?(${TRANSLITERATED_TERMS.join('|')})(?:\\*)?\\b`, 'gi');
  const matches = [...content.matchAll(regex)];
  const distinct = new Set(matches.map(m => m[1].toLowerCase()));
  const citations = matches.slice(0, 5).map(m => `offset ${m.index}`);
  if (distinct.size > 3) {
    return { pass: false, evidence: `${distinct.size} distinct terms (cap 3): ${[...distinct].join(', ')}`, citations };
  }
  return { pass: true, evidence: `${distinct.size} distinct terms: ${[...distinct].join(', ') || 'none'}`, citations };
}

function checkCraft05(content) {
  const paragraphs = content.split(/\n\n+/);
  const hits = [];
  paragraphs.forEach((p, i) => {
    const trimmed = p.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#') || trimmed.startsWith('<!--')) return;
    if (PULPIT_SEAM_REGEX.test(trimmed)) {
      hits.push({ paragraph: i, phrase: trimmed.split(/\s+/).slice(0, 2).join(' ') });
    }
  });
  if (hits.length) {
    return {
      pass: false,
      evidence: `${hits.length} pulpit-seam starts detected`,
      citations: hits.map(h => `para ${h.paragraph}: "${h.phrase}"`)
    };
  }
  return { pass: true, evidence: '0 pulpit-seam starts detected', citations: [] };
}

function checkCraft07(content) {
  const matches = [...content.matchAll(READER_THOUGHT_REGEX)];
  if (matches.length < 2) {
    return {
      pass: false,
      evidence: `${matches.length} reader-thought lines (need >=2)`,
      citations: matches.map(m => `offset ${m.index}`)
    };
  }
  return {
    pass: true,
    evidence: `${matches.length} reader-thought lines`,
    citations: matches.map(m => `offset ${m.index}`)
  };
}

function checkCraft15(content) {
  // Version stamp must appear within first 3 lines.
  const firstThree = content.split('\n').slice(0, 3).join('\n');
  if (VERSION_STAMP_REGEX.test(firstThree)) {
    return { pass: true, evidence: 'version stamp present in first 3 lines', citations: [] };
  }
  return { pass: false, evidence: 'version stamp missing from first 3 lines', citations: [] };
}

function main() {
  const chapterPath = process.argv[2];
  if (!chapterPath) {
    console.error('Usage: node craft-check.js <chapter-path>');
    process.exit(2);
  }
  let content;
  try {
    content = fs.readFileSync(chapterPath, 'utf8');
  } catch (err) {
    console.error(`Error reading ${chapterPath}: ${err.message}`);
    process.exit(2);
  }
  const chapterId = path.basename(chapterPath, path.extname(chapterPath));
  const result = {
    chapter_id: chapterId,
    checks: {
      'CRAFT-01': checkCraft01(content, chapterPath),
      'CRAFT-02': checkCraft02(content),
      'CRAFT-05': checkCraft05(content),
      'CRAFT-07': checkCraft07(content),
      'CRAFT-15': checkCraft15(content)
    }
  };
  console.log(JSON.stringify(result, null, 2));
  const anyFail = Object.values(result.checks).some(c => !c.pass);
  process.exit(anyFail ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Phase 13 — Novelty / De-duplication engine (Tier 1 + Tier 2)
// ---------------------------------------------------------------------------

function parseNoveltyArgs(argv) {
  const args = argv.slice(2);
  const out = { tier: 'both', dna: null, dir: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--novelty') continue;
    if (a === '--tier') { out.tier = args[++i]; continue; }
    if (a === '--dna') { out.dna = args[++i]; continue; }
    if (!a.startsWith('--') && !out.dir) { out.dir = a; continue; }
  }
  if (!out.dir) {
    console.error('Usage: craft-check.js --novelty [--tier 1|2|both] [--dna <book-dna.md>] <project-dir>');
    process.exit(2);
  }
  if (!out.dna) {
    out.dna = path.join(out.dir, 'book-dna.md');
  }
  return out;
}

// Minimal flat YAML parser for the refrains block. Returns [] if the block
// is missing or malformed. Only handles the specific shape documented in
// Phase 13 RESEARCH Pattern 4 (a list of -phrase:/max_uses:/scope: entries
// under a top-level `refrains:` key).
function readRefrainsFromDna(dnaPath) {
  if (!dnaPath || !fs.existsSync(dnaPath)) return [];
  const text = fs.readFileSync(dnaPath, 'utf8');
  const lines = text.split('\n');
  const refrains = [];
  let inBlock = false;
  let current = null;
  for (const raw of lines) {
    // Detect the start of a `refrains:` key (top-level or inside a fenced
    // code block). Tolerate leading whitespace.
    if (/^\s*refrains\s*:\s*$/.test(raw)) {
      inBlock = true;
      current = null;
      continue;
    }
    // An already-inline empty list: `refrains: []` — treat as empty block.
    if (/^\s*refrains\s*:\s*\[\s*\]\s*$/.test(raw)) {
      return [];
    }
    if (!inBlock) continue;
    // End of block heuristics: blank line after we have parsed ≥1 entry, a
    // new top-level key, a markdown heading, or a code fence close.
    if (/^```/.test(raw.trim())) { inBlock = false; continue; }
    if (/^#{1,6}\s/.test(raw)) { inBlock = false; continue; }
    if (/^[a-zA-Z_][\w-]*\s*:/.test(raw) && !/^\s/.test(raw)) {
      // new top-level key — end block
      inBlock = false;
      continue;
    }
    if (/^\s*$/.test(raw)) {
      // blank line — only ends block if we already captured something
      if (refrains.length > 0) { inBlock = false; }
      continue;
    }
    // Entry line: `  - phrase: "..."`
    const entryStart = raw.match(/^\s*-\s*phrase\s*:\s*(.+?)\s*$/);
    if (entryStart) {
      if (current) refrains.push(current);
      current = { phrase: stripQuotes(entryStart[1]), max_uses: 1, scope: 'whole_book' };
      continue;
    }
    const maxMatch = raw.match(/^\s*max_uses\s*:\s*(.+?)\s*$/);
    if (maxMatch && current) {
      const v = stripQuotes(maxMatch[1]);
      current.max_uses = v === 'unlimited' ? Infinity : parseInt(v, 10);
      continue;
    }
    const scopeMatch = raw.match(/^\s*scope\s*:\s*(.+?)\s*$/);
    if (scopeMatch && current) {
      current.scope = stripQuotes(scopeMatch[1]);
      continue;
    }
  }
  if (current) refrains.push(current);
  return refrains;
}

function stripQuotes(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function normaliseForShingling(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')     // strip HTML comments
    .replace(/^>.*$/gm, ' ')               // strip blockquote lines (scripture) — BEFORE lowercase
    .replace(/[*_`#>\[\]()]/g, ' ')        // strip markdown punctuation
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(tokens, n) {
  const out = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    out.push({ phrase: tokens.slice(i, i + n).join(' '), start: i });
  }
  return out;
}

function findCrossFileRepeats(files, refrains, n) {
  const index = new Map();
  const tokensByFile = new Map();
  for (const f of files) {
    const tokens = normaliseForShingling(f.text).split(' ').filter(Boolean);
    tokensByFile.set(f.path, tokens);
    for (const { phrase, start } of shingles(tokens, n)) {
      if (!index.has(phrase)) index.set(phrase, []);
      index.get(phrase).push({ file: f.path, start });
    }
  }
  const repeatedSpans = [];
  const refrainOveruse = [];
  // Build a set of refrain-derived shingle prefixes (first n tokens of each
  // refrain phrase). Any shingle that matches a refrain prefix is tracked
  // against the refrain budget, not reported as a generic repeated_span.
  const refrainShingleMap = new Map(); // shinglePhrase -> refrain entry
  for (const r of refrains) {
    const tokens = normaliseForShingling(r.phrase).split(' ').filter(Boolean);
    if (tokens.length < n) continue;
    // Track every shingle that comes from the refrain so longer refrains
    // still get fully whitelisted.
    for (const { phrase } of shingles(tokens, n)) {
      refrainShingleMap.set(phrase, r);
    }
  }
  // Refrain occurrence counting: count how many times the FIRST shingle of
  // the refrain appears in the corpus — that is the refrain's occurrence
  // count (since each occurrence of the full refrain starts with that
  // first shingle exactly once).
  const refrainFirstShingle = new Map(); // refrain phrase -> first shingle
  for (const r of refrains) {
    const tokens = normaliseForShingling(r.phrase).split(' ').filter(Boolean);
    if (tokens.length < n) continue;
    refrainFirstShingle.set(r.phrase, tokens.slice(0, n).join(' '));
  }
  for (const r of refrains) {
    const firstShingle = refrainFirstShingle.get(r.phrase);
    if (!firstShingle) continue;
    const locs = index.get(firstShingle) || [];
    const distinctFiles = [...new Set(locs.map(l => l.file))];
    const maxUses = r.max_uses === Infinity ? Infinity : r.max_uses;
    if (locs.length > maxUses) {
      refrainOveruse.push({
        phrase: r.phrase,
        max_uses: maxUses,
        actual_occurrences: locs.length,
        files: distinctFiles
      });
    }
  }
  // Grow shingle matches into maximal common substrings. For each shingle
  // that appears in ≥2 distinct files, extend forward as long as the next
  // token matches at all locations in lock-step. Then dedupe by taking the
  // longest span that starts at each location.
  const rawSpans = [];
  for (const [phrase, locs] of index) {
    if (refrainShingleMap.has(phrase)) continue;
    const distinctFiles = new Set(locs.map(l => l.file));
    if (distinctFiles.size < 2) continue;
    // Grow: find max extension k such that at every location, tokens[start..start+n+k]
    // are identical.
    let k = 0;
    while (true) {
      let ok = true;
      let ref = null;
      for (const loc of locs) {
        const toks = tokensByFile.get(loc.file);
        if (loc.start + n + k >= toks.length) { ok = false; break; }
        const nextTok = toks[loc.start + n + k];
        if (ref === null) ref = nextTok;
        else if (nextTok !== ref) { ok = false; break; }
      }
      if (!ok) break;
      k++;
    }
    const firstLoc = locs[0];
    const firstToks = tokensByFile.get(firstLoc.file);
    const fullPhrase = firstToks.slice(firstLoc.start, firstLoc.start + n + k).join(' ');
    rawSpans.push({ phrase: fullPhrase, occurrences: locs, span_length: n + k });
  }
  // Dedupe: collapse sub-spans whose (file,start) pairs are entirely covered
  // by a longer span. Keep the longest distinct maximal span per occurrence set.
  rawSpans.sort((a, b) => b.span_length - a.span_length);
  const kept = [];
  const coveredKeys = new Set();
  for (const sp of rawSpans) {
    // A span is redundant if ALL of its occurrence keys are already covered
    // by a longer kept span. Use (file, start, span_length) key for the
    // specific match region.
    let redundant = true;
    for (const loc of sp.occurrences) {
      // Check if there is a kept span that covers (loc.file, loc.start)
      let covered = false;
      for (const k of kept) {
        for (const kloc of k.occurrences) {
          if (kloc.file === loc.file &&
              loc.start >= kloc.start &&
              loc.start + sp.span_length <= kloc.start + k.span_length) {
            covered = true; break;
          }
        }
        if (covered) break;
      }
      if (!covered) { redundant = false; break; }
    }
    if (!redundant) kept.push(sp);
  }
  for (const sp of kept) {
    repeatedSpans.push({ phrase: sp.phrase, occurrences: sp.occurrences });
  }
  return { repeatedSpans, refrainOveruse };
}

const VULN_ANCHORS = [
  'i stood', 'i sat', 'i was', 'i felt', 'i remember', 'i tried', 'i could not',
  'my hands', 'my chest', 'the counter', 'the kitchen'
];

function extractVulnParagraphs(text) {
  const paragraphs = text.split(/\n\n+/);
  const out = [];
  for (const p of paragraphs) {
    const normalised = normaliseForShingling(p);
    if (!VULN_ANCHORS.some(a => normalised.includes(a))) continue;
    // Pull every sentence that contains an anchor and emit a 6-word
    // signature starting at the anchor. This lets the same paragraph
    // contribute multiple signatures (e.g., "i stood" AND "my hands").
    const sentences = p.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      const sNorm = normaliseForShingling(s);
      // Emit a signature for EVERY anchor present in the sentence, so that
      // both "i stood" and "my hands" (if co-occurring) contribute separate
      // 10-word spans to the cross-file comparison.
      for (const anchor of VULN_ANCHORS) {
        const idx = sNorm.indexOf(anchor);
        if (idx < 0) continue;
        const tokens = sNorm.slice(idx).split(' ').filter(Boolean);
        if (tokens.length < 6) continue;
        const sig = tokens.slice(0, 10).join(' ');
        out.push({ paragraph: p, signature: sig });
      }
    }
  }
  return out;
}

function findVulnerabilityBeatReuse(files) {
  const hits = [];
  const vulnMap = [];
  for (const f of files) {
    for (const v of extractVulnParagraphs(f.text)) {
      vulnMap.push({ file: f.path, signature: v.signature });
    }
  }
  const seen = new Set();
  for (let i = 0; i < vulnMap.length; i++) {
    for (let j = i + 1; j < vulnMap.length; j++) {
      if (vulnMap[i].signature === vulnMap[j].signature &&
          vulnMap[i].file !== vulnMap[j].file) {
        const key = `${vulnMap[i].file}|${vulnMap[j].file}|${vulnMap[i].signature}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push({
          type: 'vulnerability_beat_reuse',
          source: vulnMap[i].file,
          duplicate: vulnMap[j].file,
          note: 'paragraph signature match'
        });
      }
    }
  }
  return hits;
}

const STOPWORDS = new Set(['the','a','an','of','on','in','over','to','and','at']);

function parseChapterMap(dnaPath) {
  if (!dnaPath || !fs.existsSync(dnaPath)) return [];
  const text = fs.readFileSync(dnaPath, 'utf8');
  const out = [];
  const re = /^-\s+Ch\s+(\d+)\s+central_image:\s*(.+)$/gm;
  let m;
  while ((m = re.exec(text))) {
    out.push({ chapter: parseInt(m[1], 10), vehicle: m[2].trim() });
  }
  return out;
}

function vehicleDistinctness(chapterMap) {
  if (chapterMap.length < 2) return [];
  const tokenSets = chapterMap.map(c => ({
    chapter: c.chapter,
    vehicle: c.vehicle,
    tokens: new Set(
      c.vehicle.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(t => t && !STOPWORDS.has(t))
    )
  }));
  // Detect a dominant word: any content word appearing in >=2 chapter vehicles.
  const wordCounts = {};
  for (const ts of tokenSets) {
    for (const w of ts.tokens) wordCounts[w] = (wordCounts[w] || 0) + 1;
  }
  const dominant = Object.entries(wordCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);
  if (dominant.length) {
    const word = dominant[0];
    const affected = tokenSets.filter(ts => ts.tokens.has(word));
    return [{
      vehicle_family: word,
      files: affected.map(ts => `edited/ch0${ts.chapter}-final.md`),
      note: `dominant word "${word}" appears in ${affected.length} chapter vehicles`
    }];
  }
  // Fallback: pairwise Jaccard >= 0.6
  const hits = [];
  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      const a = tokenSets[i], b = tokenSets[j];
      const intersection = [...a.tokens].filter(t => b.tokens.has(t));
      const union = new Set([...a.tokens, ...b.tokens]);
      const jaccard = union.size ? intersection.length / union.size : 0;
      if (jaccard >= 0.6) {
        hits.push({
          vehicle_family: intersection.join(' ') || 'shared',
          files: [`edited/ch0${a.chapter}-final.md`, `edited/ch0${b.chapter}-final.md`],
          jaccard: Number(jaccard.toFixed(2))
        });
      }
    }
  }
  return hits;
}

function runTier2(dir, chapterMap) {
  const enrichDir = fs.existsSync(path.join(dir, 'enrichments'))
    ? path.join(dir, 'enrichments')
    : path.join(dir, 'enriched');
  const hits = {
    discussion_question_stems: [],
    prayer_point_repetition: [],
    vulnerability_bleed_to_summary: [],
    vehicle_reuse_in_backmatter: []
  };
  if (!fs.existsSync(enrichDir)) return hits;
  const enrichFiles = fs.readdirSync(enrichDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      path: path.join('enrichments', f),
      text: fs.readFileSync(path.join(enrichDir, f), 'utf8')
    }));

  // Rule 1: discussion-question stems. Parse items under a `## Discussion
  // Questions` section (numbered or bulleted list) plus any sentence
  // ending in `?` as a safety net. Strip the leading list marker.
  const stemMap = new Map();
  for (const f of enrichFiles) {
    const items = [];
    // Extract the Discussion Questions section
    const sectionMatch = f.text.match(/##\s*Discussion Questions[\s\S]*?(?=\n##\s|\n$|$)/i);
    if (sectionMatch) {
      const section = sectionMatch[0];
      for (const line of section.split('\n')) {
        const m = line.match(/^\s*(?:\d+\.\s+|[-*]\s+)(.+?)\s*$/);
        if (m) items.push(m[1]);
      }
    }
    // Fallback: any explicit ? sentences
    const qMatches = (f.text.match(/[^.!?\n]*\?/g) || []);
    for (const q of qMatches) items.push(q);
    for (const q of items) {
      const norm = normaliseForShingling(q).split(' ').filter(Boolean);
      if (norm.length < 8) continue;
      const stem = norm.slice(0, 8).join(' ');
      if (!stemMap.has(stem)) stemMap.set(stem, new Set());
      stemMap.get(stem).add(f.path);
    }
  }
  for (const [stem, files] of stemMap) {
    if (files.size >= 2) hits.discussion_question_stems.push({ stem, files: [...files] });
  }

  // Rule 2: prayer-point repetition (theological-gated)
  const voiceProfilePath = path.join(dir, 'voice-profile.md');
  const altVoiceProfilePath = path.join(dir, '..', 'voice-profile.md');
  const vpPath = fs.existsSync(voiceProfilePath)
    ? voiceProfilePath
    : (fs.existsSync(altVoiceProfilePath) ? altVoiceProfilePath : null);
  const isTheological = vpPath &&
    /## Theological Framework/.test(fs.readFileSync(vpPath, 'utf8'));
  if (isTheological) {
    const result = findCrossFileRepeats(enrichFiles, [], 6);
    for (const r of result.repeatedSpans) {
      if (/\b(father|god|lord|ask|pray)\b/.test(r.phrase)) {
        hits.prayer_point_repetition.push({
          phrase: r.phrase,
          files: [...new Set(r.occurrences.map(o => o.file))],
          theological_gated: true
        });
      }
    }
  }

  // Rule 3: vulnerability bleed from edited/chN-final.md into a DIFFERENT chapter's enrichments
  const editedDir = path.join(dir, 'edited');
  if (fs.existsSync(editedDir)) {
    const editedFiles = fs.readdirSync(editedDir).filter(f => /^ch\d+-final\.md$/.test(f));
    for (const ef of editedFiles) {
      const chNum = (ef.match(/ch(\d+)/) || [])[1];
      const editedText = fs.readFileSync(path.join(editedDir, ef), 'utf8');
      const vulnSigs = extractVulnParagraphs(editedText).map(v => v.signature).filter(Boolean);
      for (const enr of enrichFiles) {
        const enrChNum = (enr.path.match(/ch(\d+)/) || [])[1];
        if (enrChNum === chNum) continue;
        const enrNorm = normaliseForShingling(enr.text);
        for (const sig of vulnSigs) {
          if (sig && enrNorm.includes(sig)) {
            hits.vulnerability_bleed_to_summary.push({
              source_chapter: `ch${chNum}`,
              duplicate_file: enr.path,
              span: sig
            });
          }
        }
      }
    }
  }

  // Rule 4: vehicle reuse in back matter — chapter N's vehicle in chapter M's enrichments
  for (const ch of chapterMap) {
    const vehicleNorm = normaliseForShingling(ch.vehicle);
    if (!vehicleNorm) continue;
    for (const enr of enrichFiles) {
      const enrChNumMatch = enr.path.match(/ch(\d+)/);
      if (!enrChNumMatch) continue;
      const enrChNum = parseInt(enrChNumMatch[1], 10);
      if (enrChNum === ch.chapter) continue;
      const enrNorm = normaliseForShingling(enr.text);
      if (enrNorm.includes(vehicleNorm)) {
        hits.vehicle_reuse_in_backmatter.push({
          vehicle: ch.vehicle,
          source_chapter: `ch${ch.chapter}`,
          duplicate_file: enr.path
        });
      }
    }
  }

  return hits;
}

function mainNovelty() {
  const opts = parseNoveltyArgs(process.argv);
  const projectDir = path.resolve(opts.dir);
  if (!fs.existsSync(projectDir)) {
    console.error(`Project directory does not exist: ${projectDir}`);
    process.exit(2);
  }
  const refrains = readRefrainsFromDna(opts.dna);
  const chapterMap = parseChapterMap(opts.dna);

  const tier1Files = [];
  const fmDir = path.join(projectDir, 'front-matter');
  if (fs.existsSync(fmDir)) {
    for (const f of fs.readdirSync(fmDir).filter(f => f.endsWith('.md'))) {
      tier1Files.push({
        path: path.join('front-matter', f),
        text: fs.readFileSync(path.join(fmDir, f), 'utf8')
      });
    }
  }
  const edDir = path.join(projectDir, 'edited');
  if (fs.existsSync(edDir)) {
    for (const f of fs.readdirSync(edDir).filter(f => /^ch\d+-final\.md$/.test(f))) {
      tier1Files.push({
        path: path.join('edited', f),
        text: fs.readFileSync(path.join(edDir, f), 'utf8')
      });
    }
  }

  let repeatedSpans = [];
  let crossArtefactHits = [];
  let centralImageReuse = [];
  let refrainOveruse = [];
  let tier2Hits = {
    discussion_question_stems: [],
    prayer_point_repetition: [],
    vulnerability_bleed_to_summary: [],
    vehicle_reuse_in_backmatter: []
  };

  if (opts.tier === '1' || opts.tier === 'both') {
    const cross = findCrossFileRepeats(tier1Files, refrains, 6);
    repeatedSpans = cross.repeatedSpans;
    refrainOveruse = cross.refrainOveruse;
    crossArtefactHits = findVulnerabilityBeatReuse(tier1Files);
    centralImageReuse = vehicleDistinctness(chapterMap);
  }
  if (opts.tier === '2' || opts.tier === 'both') {
    tier2Hits = runTier2(projectDir, chapterMap);
  }

  const anyTier2 = Object.values(tier2Hits).some(arr => arr.length > 0);
  const flag = repeatedSpans.length > 0 || crossArtefactHits.length > 0 ||
               centralImageReuse.length > 0 || refrainOveruse.length > 0 || anyTier2;

  const result = {
    mode: 'novelty',
    tier: opts.tier,
    project_dir: projectDir,
    repeated_spans: repeatedSpans,
    cross_artefact_hits: crossArtefactHits,
    central_image_reuse: centralImageReuse,
    refrain_overuse: refrainOveruse,
    tier2_hits: tier2Hits,
    tier2: tier2Hits, // alias for test-harness compatibility
    flag,
    novelty_dedup: flag ? 'fail' : 'pass'
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(flag ? 1 : 0);
}

if (process.argv.includes('--novelty')) {
  mainNovelty();
} else {
  main();
}
