#!/usr/bin/env node
// scripts/test-rubric-regression.js
//
// Self-contained schema validation against references/captivation-rubric.md only.
// No baseline-scores.json. No sha256 hashing. Exit 0 = all pass, 1 = any fail.
//
// Validates:
//  - YAML frontmatter: schema_version 2, total_range [0,16], 8 components,
//    component keys, novelty_dedup binary dimension, sample_gate thresholds,
//    captivation_total in output_fields
//  - Markdown body: exactly 8 level-3 headings matching component labels,
//    each heading has a non-empty body, "0-16" in prose

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const RUBRIC_PATH = path.join(ROOT, 'references', 'captivation-rubric.md');

let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`PASS  ${label}`);
  passed++;
}

function fail(label, detail) {
  if (detail !== undefined && detail !== null) {
    console.error(`FAIL  ${label} — ${detail}`);
  } else {
    console.error(`FAIL  ${label}`);
  }
  failed++;
}

// ---------------------------------------------------------------------------
// Load rubric
// ---------------------------------------------------------------------------

if (!fs.existsSync(RUBRIC_PATH)) {
  fail('rubric file exists', RUBRIC_PATH);
  process.exit(1);
}

const rubricText = fs.readFileSync(RUBRIC_PATH, 'utf8').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------------
// Extract frontmatter
// ---------------------------------------------------------------------------

const fmMatch = rubricText.match(/^---\n([\s\S]*?)\n---\n/);
if (!fmMatch) {
  fail('YAML frontmatter present', 'no --- block at top of file');
  process.exit(1);
}
pass('YAML frontmatter present');

const fmBody = fmMatch[1];
const lines  = rubricText.split('\n');

// ---------------------------------------------------------------------------
// Frontmatter: schema_version
// ---------------------------------------------------------------------------

if (/^schema_version:\s*2\s*$/m.test(fmBody)) {
  pass('schema_version: 2');
} else {
  fail('schema_version: 2', 'not found in frontmatter');
}

// ---------------------------------------------------------------------------
// Frontmatter: total_range [0, 16]
// ---------------------------------------------------------------------------

if (/^total_range:\s*\[\s*0\s*,\s*16\s*\]\s*$/m.test(fmBody)) {
  pass('total_range: [0, 16]');
} else {
  fail('total_range: [0, 16]', 'not found or incorrect in frontmatter');
}

// ---------------------------------------------------------------------------
// Frontmatter: exactly 8 components with expected keys
// ---------------------------------------------------------------------------

const EXPECTED_KEYS = [
  'clarity_of_point',
  'scripture_saturation',
  'structural_parallelism',
  'direct_address',
  'simplicity',
  'emphasis_repetition',
  'illustration_discipline',
  'novelty_variation',
];

const EXPECTED_LABELS = [
  'Clarity of Point',
  'Scripture Saturation',
  'Structural Parallelism',
  'Direct Address',
  'Simplicity',
  'Emphasis & Repetition',
  'Illustration Discipline',
  'Novelty / Variation',
];

// Parse component keys by scanning all lines in fmBody that match `  - key: <value>`
// (list item key lines, indented with spaces, under the components: block).
// We scan the whole frontmatter — every `key:` line inside an indented list item.
const fmLines   = fmBody.split('\n');
const foundKeys = [];
let inComponents = false;
for (const ln of fmLines) {
  if (/^components:\s*$/.test(ln)) { inComponents = true; continue; }
  if (inComponents && /^\w/.test(ln)) { inComponents = false; }  // next top-level key
  if (inComponents) {
    const m = ln.match(/^\s+-\s+key:\s+(\S+)/);
    if (m) foundKeys.push(m[1]);
  }
}

if (foundKeys.length === 8) {
  pass('exactly 8 components declared in frontmatter');
} else {
  fail('exactly 8 components declared in frontmatter', `found ${foundKeys.length}: [${foundKeys}]`);
}

const missing = EXPECTED_KEYS.filter(k => !foundKeys.includes(k));
const extra   = foundKeys.filter(k => !EXPECTED_KEYS.includes(k));
if (missing.length === 0 && extra.length === 0) {
  pass('all 8 component keys match expected set');
} else {
  fail('all 8 component keys match expected set',
    `missing=[${missing}] extra=[${extra}]`);
}

// Count range: [0, 2] inside frontmatter (only for component ranges)
const rangeCount = (fmBody.match(/range:\s*\[\s*0\s*,\s*2\s*\]/g) || []).length;
if (rangeCount === 8) {
  pass('all 8 components have range [0, 2]');
} else {
  fail('all 8 components have range [0, 2]', `only ${rangeCount} found`);
}

// ---------------------------------------------------------------------------
// Frontmatter: novelty_dedup binary dimension
// ---------------------------------------------------------------------------

if (/key:\s*novelty_dedup/.test(fmBody) && /type:\s*binary/.test(fmBody)) {
  pass('novelty_dedup binary dimension in frontmatter');
} else {
  fail('novelty_dedup binary dimension in frontmatter', 'key or type: binary missing');
}

// ---------------------------------------------------------------------------
// Frontmatter: sample_gate thresholds
// ---------------------------------------------------------------------------

if (/captivation_total_min:\s*10/.test(fmBody)) {
  pass('sample_gate captivation_total_min: 10');
} else {
  fail('sample_gate captivation_total_min: 10', 'not found in frontmatter');
}

if (/thresholds:[\s\S]*?novelty_dedup:\s*pass/m.test(fmBody)) {
  pass('sample_gate novelty_dedup: pass');
} else {
  fail('sample_gate novelty_dedup: pass', 'not found in thresholds section');
}

// ---------------------------------------------------------------------------
// Frontmatter: output_fields includes captivation_total and novelty_dedup
// ---------------------------------------------------------------------------

if (/captivation_total/.test(fmBody)) {
  pass('output_fields includes captivation_total');
} else {
  fail('output_fields includes captivation_total', 'not in frontmatter');
}

if ((fmBody.match(/novelty_dedup/g) || []).length >= 2) {
  // novelty_dedup appears at least twice: once in dimensions, once in output_fields
  pass('output_fields includes novelty_dedup');
} else {
  fail('output_fields includes novelty_dedup', 'appears fewer than 2 times in frontmatter');
}

// ---------------------------------------------------------------------------
// Markdown body: exactly 8 level-3 headings
// ---------------------------------------------------------------------------

function extractBodyUnder(allLines, headingText) {
  const re = new RegExp(`^###\\s+${headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
  const startIdx = allLines.findIndex(l => re.test(l));
  if (startIdx === -1) return null;
  const depth = (allLines[startIdx].match(/^#+/) || [''])[0].length;
  let endIdx = allLines.length;
  for (let i = startIdx + 1; i < allLines.length; i++) {
    const m = allLines[i].match(/^(#+)\s/);
    if (m && m[1].length <= depth) { endIdx = i; break; }
  }
  return allLines.slice(startIdx + 1, endIdx).join('\n').trim();
}

const level3Headings = lines.filter(l => /^###\s+\S/.test(l));
if (level3Headings.length === 8) {
  pass('exactly 8 level-3 component headings in rubric body');
} else {
  fail('exactly 8 level-3 component headings in rubric body', `found ${level3Headings.length}: ${level3Headings.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Markdown body: each expected label present as ### heading with non-empty body
// ---------------------------------------------------------------------------

for (const label of EXPECTED_LABELS) {
  const body = extractBodyUnder(lines, label);
  if (body === null) {
    fail(`heading "### ${label}" present`, 'not found');
  } else if (body.length === 0) {
    fail(`heading "### ${label}" has non-empty body`, 'body is empty');
  } else {
    pass(`heading "### ${label}" present with non-empty body`);
  }
}

// ---------------------------------------------------------------------------
// Prose: "0-16" total-range marker documented
// ---------------------------------------------------------------------------

if (rubricText.includes('0-16')) {
  pass('"0-16" total-range marker in rubric prose');
} else {
  fail('"0-16" total-range marker in rubric prose', 'string not found');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n${passed}/${total} checks passed`);
if (failed > 0) {
  process.exit(1);
}
process.exit(0);
