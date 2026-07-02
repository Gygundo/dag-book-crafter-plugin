#!/usr/bin/env node
// scripts/test-rubric-regression.js — Regression test for CRAFT-09 pure-move extraction
// and CRAFT-10 rubric extension.
//
// Reads fixtures/phase10/baseline-scores.json, reads references/captivation-rubric.md,
// re-computes sha256 over the extracted rubric body in the same order as baseline,
// compares to baseline.scoring_logic_hash. Exit 0 if identical, 1 if drifted or
// the rubric file does not yet exist.
//
// The base run (no flags) only checks the original 5-component hash. Pass --extended
// to also assert the CRAFT-10 additions (Craft Density + Cross-Chapter Craft) are
// present with non-empty bodies and the 0-14 total is documented.
//
// Usage:
//   node scripts/test-rubric-regression.js              # legacy 5-component lock
//   node scripts/test-rubric-regression.js --extended   # + CRAFT-10 additions
//
// ## Regeneration Protocol (Phase 13 / schema v2)
//
// The Phase 13 rubric rewrite (Plan 13-04) changes the rubric body bytes
// because 0-14 references become 0-16 and the schema v2 frontmatter + 8th
// component land. This breaks the legacy 5-component sha256 lock by design.
//
// After Plan 13-04 ships references/captivation-rubric.md (schema v2), the
// executor for that plan MUST:
//
//   1. Run: `node scripts/test-rubric-regression.js`
//   2. Capture the "current: <hash>" line from the FAIL branch stdout.
//   3. Update fixtures/phase10/baseline-scores.json:
//        - scoring_logic_hash:  <hash>           (the real new hash)
//        - phase_13_regenerated: true            (flip flag)
//   4. Re-run the script to confirm PASS.
//   5. Run with --extended to confirm the 8 structural assertions also pass.
//
// Until step 3 is performed, the base hash check will intentionally fail
// with "PHASE_13_PENDING" != <computed>. The --extended structural
// assertions are the primary drift detector for schema v2; the hash lock
// is a secondary tripwire.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'fixtures', 'phase10', 'baseline-scores.json');
const RUBRIC_PATH = path.join(ROOT, 'references', 'captivation-rubric.md');

function extractBody(lines, headingText) {
  // Find the first line that is exactly `### {headingText}` (level-3 heading in the rubric)
  const headingRegex = new RegExp(`^###\\s+${headingText.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*$`);
  const startIdx = lines.findIndex(l => headingRegex.test(l));
  if (startIdx === -1) {
    return null;
  }
  const startLevel = (lines[startIdx].match(/^#+/) || [''])[0].length;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= startLevel) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx + 1, endIdx).join('\n').trim();
}

function main() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`FAIL: baseline file missing at ${BASELINE_PATH}`);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

  if (!fs.existsSync(RUBRIC_PATH)) {
    console.error(`FAIL: ${RUBRIC_PATH} does not yet exist (Task 4 has not run).`);
    console.error('This test becomes green after the rubric is extracted.');
    process.exit(1);
  }

  const rubricText = fs.readFileSync(RUBRIC_PATH, 'utf8').replace(/\r\n/g, '\n');
  const lines = rubricText.split('\n');

  const bodies = [];
  for (const component of baseline.rubric_components) {
    const heading = component.rubric_heading;
    const body = extractBody(lines, heading);
    if (body === null) {
      console.error(`FAIL: heading "### ${heading}" not found in ${RUBRIC_PATH}`);
      process.exit(1);
    }
    bodies.push(body);
  }

  const concat = bodies.join('\n');
  const hash = crypto.createHash('sha256').update(concat).digest('hex');

  // Phase 13 / schema v2: The legacy 5-component body text is rewritten
  // to reference 0-16 and the schema v2 frontmatter. The baseline hash
  // below was regenerated during Plan 13-03 Task 2 for the new body.
  // Structural assertions in --extended are the primary drift detector;
  // the hash lock is a secondary tripwire.
  if (hash !== baseline.scoring_logic_hash) {
    console.error('FAIL: rubric hash drifted from baseline.');
    console.error(`  baseline: ${baseline.scoring_logic_hash}`);
    console.error(`  current:  ${hash}`);
    console.error('  The original 5 captivation components must stay byte-identical.');
    console.error('  If you intended to add new components, append them — do not edit the originals.');
    console.error('  See ## Regeneration Protocol at top of this file for Phase 13 hand-off steps.');
    process.exit(1);
  }

  if (baseline.phase_13_regenerated === true) {
    console.log('NOTE: baseline regenerated for Phase 13 schema v2');
  }
  console.log(`PASS: rubric hash matches baseline (${hash})`);

  // Extended checks for CRAFT-10 additions.
  const extended = process.argv.includes('--extended');
  if (!extended) {
    process.exit(0);
  }

  // Phase 13 / schema v2 structural assertions. These replace the CRAFT-10
  // 7-heading / 0-14 assertions. The legacy Craft Density + Cross-Chapter
  // Craft heading-present checks are retained — they must still pass in v2.
  const failures = [];

  // 1. YAML frontmatter exists and parses (string-level only).
  const fmMatch = rubricText.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) {
    failures.push('missing YAML frontmatter at top of rubric file');
  }
  const fmBody = fmMatch ? fmMatch[1] : '';

  // 2. schema_version: 2
  if (!/^schema_version:\s*2\s*$/m.test(fmBody)) {
    failures.push('frontmatter missing schema_version: 2');
  }

  // 3. total_range: [0, 16]
  if (!/^total_range:\s*\[\s*0\s*,\s*16\s*\]\s*$/m.test(fmBody)) {
    failures.push('frontmatter missing total_range: [0, 16]');
  }

  // 4. novelty_dedup binary dimension present in frontmatter.
  if (!/novelty_dedup/.test(fmBody) || !/type:\s*binary/.test(fmBody)) {
    failures.push('frontmatter missing novelty_dedup binary dimension');
  }

  // 5. Exactly 8 level-3 component headings.
  const level3Count = lines.filter((l) => /^###\s+\S/.test(l)).length;
  if (level3Count !== 8) {
    failures.push(
      `expected 8 level-3 component headings (schema v2), found ${level3Count}`
    );
  }

  // 6. Novelty / Variation component present with non-empty body.
  const noveltyBody = extractBody(lines, 'Novelty / Variation');
  if (noveltyBody === null || noveltyBody.length === 0) {
    failures.push('missing or empty ### Novelty / Variation component body');
  }

  // 7. 0-16 total-range marker documented in rubric prose.
  if (!rubricText.includes('0-16')) {
    failures.push('missing "0-16" total-range marker in rubric prose');
  }

  // 8. output_fields region references both captivation_total and novelty_dedup.
  if (!/captivation_total/.test(fmBody) || !/novelty_dedup/.test(fmBody)) {
    failures.push(
      'frontmatter output_fields missing captivation_total or novelty_dedup'
    );
  }

  // Retained from CRAFT-10: Craft Density + Cross-Chapter Craft headings
  // must still exist in schema v2 (they are two of the eight components).
  for (const heading of ['Craft Density', 'Cross-Chapter Craft']) {
    const body = extractBody(lines, heading);
    if (body === null) {
      failures.push(`missing heading: ### ${heading}`);
    } else if (body.length === 0) {
      failures.push(`empty body under: ### ${heading}`);
    }
  }

  if (failures.length > 0) {
    console.error('FAIL: extended rubric checks failed:');
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  }

  console.log(
    'PASS: extended rubric checks (schema v2: 8 components, 0-16 range, novelty_dedup dimension, novelty_variation component)'
  );
  process.exit(0);
}

main();
