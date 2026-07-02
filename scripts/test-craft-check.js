#!/usr/bin/env node
// scripts/test-craft-check.js — DAG rule unit tests with inline fixtures
// Usage: node scripts/test-craft-check.js
'use strict';

const { execSync } = require('node:child_process');
const path  = require('node:path');
const fs    = require('node:fs');
const os    = require('node:os');

const CHECKER = path.join(__dirname, 'craft-check.js');

let passed = 0, failed = 0;
function pass(label) { console.log(`PASS: ${label}`); passed++; }
function fail(label, detail) {
  console.error(`FAIL: ${label}`);
  if (detail) console.error(`  ${String(detail).slice(0, 300)}`);
  failed++;
}

function runChecker(fixturePath) {
  try {
    const out = execSync(`node "${CHECKER}" "${fixturePath}"`, { encoding: 'utf8' });
    return { exitCode: 0, result: JSON.parse(out) };
  } catch (err) {
    try { return { exitCode: err.status || 1, result: JSON.parse(err.stdout || '{}') }; }
    catch (_) { return { exitCode: err.status || 1, result: {} }; }
  }
}

function runNovelty(args) {
  try {
    const out = execSync(`node "${CHECKER}" ${args}`, { encoding: 'utf8' });
    return { exitCode: 0, stdout: out };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : ''
    };
  }
}

function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dag-craft-'));
  try { return fn(dir); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

function writeChapter(dir, name, content) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

// ---------------------------------------------------------------------------
// Reusable minimal valid chapter
// ---------------------------------------------------------------------------

const GOOD_CHAPTER = `<!-- generated-by: dag-book-crafter v1.2.0 -->

# Chapter 1: Walking in Strength

You must understand what it means to be strong in the Lord. This is not natural strength. It is not human willpower. It is the power of God working through you. You must pursue it deliberately. Do not wait for it to come to you.

> *Be STRONG AND OF A GOOD COURAGE; be not afraid, neither be thou dismayed: for the Lord thy God is with thee.*
> -- Joshua 1:9

Notice that the command came before the victory. Joshua was instructed to be strong before a single city had fallen. Strength was not the reward for obedience it was the starting point for it. You must understand this pattern. God always calls you to be strong before the breakthrough arrives. Do not wait. Decide now.

The anointing is not something you learn, it is something you catch.

> *Finally, my brethren, BE STRONG IN THE LORD, and in the power of his might.*
> -- Ephesians 6:10

In other words, the instruction is to draw your strength from the Lord himself. The believer who tries to be strong in himself will always reach his limit. The believer who is strong in the Lord has access to a limitless supply. You must choose to tap into that supply every single day without fail.

> *He giveth power to the faint; and to them that have no might he INCREASETH STRENGTH.*
> -- Isaiah 40:29

Do not give up. Do not back down. Stand firm in the Lord and in the power of his might.
`;

// ---------------------------------------------------------------------------
// DAG-01
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const p = writeChapter(dir, 'ch01.md', GOOD_CHAPTER);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-01'];
  if (c && c.pass === true)
    pass('DAG-01: declaration opener passes');
  else
    fail('DAG-01: declaration opener should pass', c && c.evidence);
});

withTmpDir(dir => {
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->

# Chapter 1: Strength

One day, a young pastor walked into his church and found it completely empty inside.

> *Be strong and of a good courage.*
> -- Joshua 1:9

You must be strong. Do not give up. Stand firm today.

> *The Lord is my strength and my shield.*
> -- Psalm 28:7

Decide to be strong. God will honour that decision.

> *I can do all things through Christ which strengtheneth me.*
> -- Philippians 4:13

Stand firm in the Lord every single day.
`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-01'];
  if (c && c.pass === false)
    pass('DAG-01: story-marker opener ("One day") fails');
  else
    fail('DAG-01: story-marker opener should fail', c && c.evidence);
});

// ---------------------------------------------------------------------------
// DAG-02
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const p = writeChapter(dir, 'ch01.md', GOOD_CHAPTER);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-02'];
  if (c && c.pass === true)
    pass('DAG-02: 3 scripture blocks passes density check');
  else
    fail('DAG-02: 3 scripture blocks should pass', c && c.evidence);
});

withTmpDir(dir => {
  // 1 scripture block with enough body words to require 3 (floor is 3 regardless)
  const prose = 'You must build your spiritual strength deliberately each and every single day without fail. This is not optional. '.repeat(16);
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->

# Chapter 1: Strength

${prose}

> *Be strong and of a good courage.*
> -- Joshua 1:9

${prose}
`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-02'];
  if (c && c.pass === false)
    pass('DAG-02: underflow (1 block) fails correctly');
  else
    fail('DAG-02: underflow should fail', c && c.evidence);
});

// ---------------------------------------------------------------------------
// DAG-04 (flag-only — check diagnostic fields)
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const p = writeChapter(dir, 'ch01.md', GOOD_CHAPTER);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-04'];
  if (c && c.has_key_statement === true)
    pass('DAG-04: standalone key statement detected');
  else
    fail('DAG-04: key statement should be detected', c && c.evidence);
});

withTmpDir(dir => {
  const p = writeChapter(dir, 'ch01.md', GOOD_CHAPTER);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-04'];
  if (c && c.has_caps_in_quote === true)
    pass('DAG-04: CAPS-in-quote detected');
  else
    fail('DAG-04: CAPS-in-quote should be detected', c && c.evidence);
});

withTmpDir(dir => {
  // flag-only rule: pass must always be true
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nYou must be strong.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-04'];
  if (c && c.pass === true)
    pass('DAG-04: flag-only — pass is always true regardless of presence');
  else
    fail('DAG-04: should always be pass:true (flag-only)', c && c.evidence);
});

// ---------------------------------------------------------------------------
// DAG-05
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  // overflow: repeat a 16-word sentence 200 times = 3200 words
  const blk = 'You must walk in the power of God and trust him for every step of your ministry. '.repeat(200);
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\n${blk}\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-05'];
  if (c && c.pass === false)
    pass('DAG-05: overflow (>2500 words) fails');
  else
    fail('DAG-05: overflow should fail', c && `word_count=${c && c.word_count}`);
});

withTmpDir(dir => {
  const p = writeChapter(dir, 'ch01.md', GOOD_CHAPTER);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-05'];
  if (c && c.pass === true)
    pass('DAG-05: normal-length chapter passes');
  else
    fail('DAG-05: normal chapter should pass', c && c.evidence);
});

// ---------------------------------------------------------------------------
// DAG-06
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nIt could be argued that the anointing is not necessary for ministry today. But this is wrong.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-06'];
  if (c && c.pass === false && c.has_hedging === true)
    pass('DAG-06: hedging phrase detected and fails');
  else
    fail('DAG-06: hedging phrase should fail', c && c.evidence);
});

withTmpDir(dir => {
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nThe word charis means grace. The word agape means love. These are important distinctions in Scripture.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-06'];
  if (c && c.pass === false && c.transliterated_term_count > 1)
    pass('DAG-06: >1 transliterated term fails');
  else
    fail('DAG-06: >1 transliterated term should fail', c && c.evidence);
});

// ---------------------------------------------------------------------------
// DAG-07 (flag-only — check diagnostic fields)
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nYou must be strong. Do not give up today.\n\nBut what will you do when the pressure finally comes?\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-07'];
  if (c && c.cliffhanger === true)
    pass('DAG-07: cliffhanger final-question detected');
  else
    fail('DAG-07: cliffhanger final-question should be detected', c && c.evidence);
});

withTmpDir(dir => {
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nYou must be strong.\n\nIn the next chapter we will see how this applies to your ministry.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-07'];
  if (c && c.cliffhanger === true)
    pass('DAG-07: "in the next chapter" teaser detected as cliffhanger');
  else
    fail('DAG-07: "in the next chapter" should flag as cliffhanger', c && c.evidence);
});

withTmpDir(dir => {
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nYou must be strong.\n\nDecide to be strong today and God will honour your decision always.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-07'];
  if (c && c.cliffhanger === false)
    pass('DAG-07: clean landing is not flagged as cliffhanger');
  else
    fail('DAG-07: clean landing should not be flagged', c && c.evidence);
});

// ---------------------------------------------------------------------------
// STAMP
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const p = writeChapter(dir, 'ch01.md', '# Chapter 1\n\nYou must be strong.\n');
  const { result } = runChecker(p);
  const c = result.checks && result.checks['STAMP'];
  if (c && c.pass === false)
    pass('STAMP: missing version stamp fails');
  else
    fail('STAMP: missing stamp should fail', c && c.evidence);
});

withTmpDir(dir => {
  const p = writeChapter(dir, 'ch01.md', GOOD_CHAPTER);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['STAMP'];
  if (c && c.pass === true)
    pass('STAMP: present stamp passes');
  else
    fail('STAMP: present stamp should pass', c && c.evidence);
});

// ---------------------------------------------------------------------------
// PROVENANCE
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  // No provenance line — should pass (topic-brief mode)
  const p = writeChapter(dir, 'ch01.md', GOOD_CHAPTER);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['PROVENANCE'];
  if (c && c.pass === true)
    pass('PROVENANCE: absent provenance is OK (topic-brief mode)');
  else
    fail('PROVENANCE: absent provenance should pass', c && c.evidence);
});

withTmpDir(dir => {
  const content = `<!-- provenance: sources/sermons.md:42 -->\n<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nYou must be strong.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['PROVENANCE'];
  if (c && c.pass === true)
    pass('PROVENANCE: well-formed provenance passes');
  else
    fail('PROVENANCE: well-formed provenance should pass', c && c.evidence);
});

withTmpDir(dir => {
  // Malformed — no line number after colon
  const content = `<!-- provenance: sources/sermons.md -->\n<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nYou must be strong.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['PROVENANCE'];
  if (c && c.pass === false)
    pass('PROVENANCE: malformed provenance (no line number) fails');
  else
    fail('PROVENANCE: malformed provenance should fail', c && c.evidence);
});

// ---------------------------------------------------------------------------
// Novelty: refrain within budget is not in repeated_spans
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const edDir = path.join(dir, 'edited');
  fs.mkdirSync(edDir);
  const refrain = 'Decide to be strong and God will honour your decision completely today.';
  const ch1 = `<!-- generated-by: dag-book-crafter v1.0.0 -->\n\n# Chapter 1\n\n${refrain} You must make this choice without delay.\n`;
  const ch2 = `<!-- generated-by: dag-book-crafter v1.0.0 -->\n\n# Chapter 2\n\n${refrain} Do not postpone this decision any longer.\n`;
  fs.writeFileSync(path.join(edDir, 'ch01-final.md'), ch1);
  fs.writeFileSync(path.join(edDir, 'ch02-final.md'), ch2);
  const dnaPath = path.join(dir, 'book-dna.md');
  fs.writeFileSync(dnaPath, `# Book DNA\n\nrefrains:\n  - phrase: "${refrain}"\n    max_uses: 2\n    scope: whole_book\n`);

  const { stdout } = runNovelty(`--novelty --tier 1 --dna "${dnaPath}" "${dir}"`);
  try {
    const result = JSON.parse(stdout);
    // The refrain should appear only in refrain_overuse if over-budget, never in repeated_spans
    // With max_uses:2 and exactly 2 occurrences it should not appear in refrain_overuse either
    const inRepeated = (result.repeated_spans || []).some(s =>
      s.phrase.toLowerCase().includes('decide to be strong and god')
    );
    if (!inRepeated)
      pass('novelty: refrain within budget (max_uses:2, 2 occurrences) not in repeated_spans');
    else
      fail('novelty: refrain within budget should not appear in repeated_spans', JSON.stringify(result.repeated_spans).slice(0, 200));
  } catch (e) {
    fail('novelty: refrain-budget test — JSON parse error', e.message + ' stdout: ' + stdout.slice(0, 100));
  }
});

// ---------------------------------------------------------------------------
// Novelty: non-exempt 6+ word span appears in repeated_spans
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const edDir = path.join(dir, 'edited');
  fs.mkdirSync(edDir);
  const shared = 'the enemy specifically targets the weakest believer first among all people';
  const ch1 = `<!-- generated-by: dag-book-crafter v1.0.0 -->\n\n# Chapter 1\n\nYou must be strong always. ${shared}. Guard yourself every day.\n`;
  const ch2 = `<!-- generated-by: dag-book-crafter v1.0.0 -->\n\n# Chapter 2\n\nPray without ceasing daily. ${shared}. Do not be found unguarded.\n`;
  fs.writeFileSync(path.join(edDir, 'ch01-final.md'), ch1);
  fs.writeFileSync(path.join(edDir, 'ch02-final.md'), ch2);
  fs.writeFileSync(path.join(dir, 'book-dna.md'), '# Book DNA\n\nrefrains: []\n');

  const { stdout } = runNovelty(`--novelty --tier 1 "${dir}"`);
  try {
    const result = JSON.parse(stdout);
    const hasSpan = (result.repeated_spans || []).length > 0;
    if (hasSpan)
      pass('novelty: non-exempt 6+ word cross-file span detected in repeated_spans');
    else
      fail('novelty: shared non-exempt span should appear in repeated_spans', JSON.stringify(result).slice(0, 200));
  } catch (e) {
    fail('novelty: non-exempt span test — JSON parse error', e.message);
  }
});

// ---------------------------------------------------------------------------
// Novelty: "May you" benediction line is exempt
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const edDir = path.join(dir, 'edited');
  fs.mkdirSync(edDir);
  const benediction = 'May you walk in the fullness of God every single day of your life here.';
  // Unique prose in each chapter so only the benediction overlaps
  const ch1 = `<!-- generated-by: dag-book-crafter v1.0.0 -->\n\n# Chapter 1\n\nYou must pursue the anointing with everything inside you.\n\n${benediction}\n`;
  const ch2 = `<!-- generated-by: dag-book-crafter v1.0.0 -->\n\n# Chapter 2\n\nPrayer and the Word will build your spiritual strength daily.\n\n${benediction}\n`;
  fs.writeFileSync(path.join(edDir, 'ch01-final.md'), ch1);
  fs.writeFileSync(path.join(edDir, 'ch02-final.md'), ch2);
  fs.writeFileSync(path.join(dir, 'book-dna.md'), '# Book DNA\n\nrefrains: []\n');

  const { stdout } = runNovelty(`--novelty --tier 1 "${dir}"`);
  try {
    const result = JSON.parse(stdout);
    const leaked = (result.repeated_spans || []).some(s =>
      s.phrase.toLowerCase().includes('may you') ||
      s.phrase.toLowerCase().includes('walk in the fullness')
    );
    if (!leaked)
      pass('novelty: "May you" benediction line exempt from repeated_spans');
    else
      fail('novelty: "May you" should be exempt from dedup', JSON.stringify(result.repeated_spans).slice(0, 200));
  } catch (e) {
    fail('novelty: May-you exemption test — JSON parse error', e.message);
  }
});

// ---------------------------------------------------------------------------
// Novelty: scripture blockquote cross-file does NOT flag
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const fmDir = path.join(dir, 'front-matter');
  const edDir = path.join(dir, 'edited');
  fs.mkdirSync(fmDir, { recursive: true });
  fs.mkdirSync(edDir, { recursive: true });
  const base = '<!-- generated-by: dag-book-crafter v1.1.0 -->\n\n> *For by grace you have been saved through faith and this is not of yourselves.*\n> -- Ephesians 2:8\n\n';
  fs.writeFileSync(path.join(fmDir, 'foreword.md'), base + 'Unique prose for the foreword only, not repeated.\n');
  fs.writeFileSync(path.join(edDir, 'ch01-final.md'), base + 'Unique prose for chapter one only, not repeated.\n');
  fs.writeFileSync(path.join(dir, 'book-dna.md'), '# Book DNA\n\nrefrains: []\n');

  const { stdout } = runNovelty(`--novelty --tier 1 "${dir}"`);
  try {
    const result = JSON.parse(stdout);
    const leaked = (result.repeated_spans || []).some(s =>
      (s.phrase || '').toLowerCase().includes('by grace you have been saved')
    );
    if (!leaked)
      pass('novelty: scripture blockquote cross-file does not flag');
    else
      fail('novelty: scripture blockquote must be exempt from dedup', JSON.stringify(result.repeated_spans).slice(0, 200));
  } catch (e) {
    fail('novelty: scripture-exempt test — JSON parse error', e.message);
  }
});

// ---------------------------------------------------------------------------
// Novelty: --dna with no refrains block does not crash
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const edDir = path.join(dir, 'edited');
  fs.mkdirSync(edDir);
  fs.writeFileSync(path.join(edDir, 'ch01-final.md'), '<!-- generated-by: dag-book-crafter v1.1.0 -->\n\nCompletely unique prose here with nothing repeated.\n');
  const dnaPath = path.join(dir, 'book-dna.md');
  fs.writeFileSync(dnaPath, '# Book DNA\n\nNo refrains key at all.\n');

  const { stdout, exitCode } = runNovelty(`--novelty --tier 1 --dna "${dnaPath}" "${dir}"`);
  if (exitCode === 0 || exitCode === 1) {
    try {
      const result = JSON.parse(stdout);
      if (typeof result.flag !== 'undefined')
        pass('novelty: --dna with no refrains block does not crash (flag field present)');
      else
        fail('novelty: result must have flag field', stdout.slice(0, 100));
    } catch (e) {
      fail('novelty: no-refrains DNA — JSON parse error', e.message);
    }
  } else {
    fail('novelty: no-refrains DNA should exit 0 or 1 (not crash code 2)', `exit ${exitCode}`);
  }
});

// ---------------------------------------------------------------------------
// DAG-06 word-boundary fix: "Many believers" must NOT trigger hedging
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nMany believers are spiritually weak today because they do not pray. You must pray. Seek God daily.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-06'];
  if (c && c.pass === true && c.has_hedging === false)
    pass('DAG-06 word-boundary: "Many believers" does NOT trigger hedging false-positive');
  else
    fail('DAG-06 word-boundary: "Many believers" should NOT trip hedging', c && c.evidence);
});

// ---------------------------------------------------------------------------
// DAG-07 new cliffhanger patterns: "what comes next" must fail
// ---------------------------------------------------------------------------

withTmpDir(dir => {
  const content = `<!-- generated-by: dag-book-crafter v1.2.0 -->\n\n# Chapter 1\n\nYou must be strong.\n\n...and what comes next changes everything about your ministry forever.\n`;
  const p = writeChapter(dir, 'ch01.md', content);
  const { result } = runChecker(p);
  const c = result.checks && result.checks['DAG-07'];
  if (c && c.cliffhanger === true && c.pass === false)
    pass('DAG-07 new pattern: "what comes next" detected as cliffhanger and fails');
  else
    fail('DAG-07 new pattern: "what comes next" should be detected as cliffhanger', c && c.evidence);
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log('');
if (failed > 0) {
  console.error(`${failed} test(s) FAILED, ${passed} passed.`);
  process.exit(1);
} else {
  console.log(`All ${passed} tests passed.`);
}
