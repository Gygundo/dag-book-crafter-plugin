// scripts/test-craft-check.js — unit tests for craft-check.js
// Usage: node --test scripts/test-craft-check.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const CHECKER = path.join(__dirname, 'craft-check.js');
const FIXTURES = path.join(__dirname, '..', 'fixtures', 'phase10');

function runCraftCheckNovelty(args) {
  // args is a string of CLI arguments after 'craft-check.js'
  const cmd = `node "${CHECKER}" ${args}`;
  try {
    return { stdout: execSync(cmd, { encoding: 'utf8' }), exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
      exitCode: err.status,
    };
  }
}

function parseNoveltyResult(stdout) {
  // craft-check.js --novelty emits JSON to stdout (and may exit non-zero on flag:true).
  return JSON.parse(stdout);
}

function runChecker(fixturePath) {
  try {
    const out = execSync(`node "${CHECKER}" "${fixturePath}"`, { encoding: 'utf8' });
    return { exitCode: 0, result: JSON.parse(out) };
  } catch (err) {
    return { exitCode: err.status, result: JSON.parse(err.stdout) };
  }
}

test('CRAFT-01: known-good chapter has valid provenance', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-good', 'ch01-draft.md'));
  assert.equal(result.checks['CRAFT-01'].pass, true);
});

test('known-good: all checks pass and exit code is 0', () => {
  const { exitCode, result } = runChecker(path.join(FIXTURES, 'known-good', 'ch01-draft.md'));
  assert.equal(exitCode, 0);
  for (const [id, check] of Object.entries(result.checks)) {
    assert.equal(check.pass, true, `${id} should pass on known-good but failed: ${check.evidence}`);
  }
});

test('CRAFT-01: missing provenance fails', () => {
  const { exitCode, result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch03-no-provenance.md'));
  assert.equal(result.checks['CRAFT-01'].pass, false);
  assert.equal(exitCode, 1);
});

test('CRAFT-01: ch03-no-provenance fails ONLY CRAFT-01', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch03-no-provenance.md'));
  assert.equal(result.checks['CRAFT-01'].pass, false);
  assert.equal(result.checks['CRAFT-02'].pass, true);
  assert.equal(result.checks['CRAFT-05'].pass, true);
  assert.equal(result.checks['CRAFT-07'].pass, true);
  assert.equal(result.checks['CRAFT-15'].pass, true);
});

test('CRAFT-02: 4 distinct Greek terms fails cap of 3', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch02-greek-overflow.md'));
  assert.equal(result.checks['CRAFT-02'].pass, false);
});

test('CRAFT-02: ch02-greek-overflow fails ONLY CRAFT-02', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch02-greek-overflow.md'));
  assert.equal(result.checks['CRAFT-01'].pass, true);
  assert.equal(result.checks['CRAFT-02'].pass, false);
  assert.equal(result.checks['CRAFT-05'].pass, true);
  assert.equal(result.checks['CRAFT-07'].pass, true);
  assert.equal(result.checks['CRAFT-15'].pass, true);
});

test('CRAFT-05: "So let us..." at paragraph start fails', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch01-pulpit.md'));
  assert.equal(result.checks['CRAFT-05'].pass, false);
});

test('CRAFT-05: ch01-pulpit fails ONLY CRAFT-05', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch01-pulpit.md'));
  assert.equal(result.checks['CRAFT-01'].pass, true);
  assert.equal(result.checks['CRAFT-02'].pass, true);
  assert.equal(result.checks['CRAFT-05'].pass, false);
  assert.equal(result.checks['CRAFT-07'].pass, true);
  assert.equal(result.checks['CRAFT-15'].pass, true);
});

test('CRAFT-05: mid-paragraph "So" does not trigger', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-good', 'ch01-draft.md'));
  assert.equal(result.checks['CRAFT-05'].pass, true);
});

test('CRAFT-07: <2 reader-thought lines fails', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch05-no-reader-thought.md'));
  assert.equal(result.checks['CRAFT-07'].pass, false);
});

test('CRAFT-07: ch05-no-reader-thought fails ONLY CRAFT-07', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch05-no-reader-thought.md'));
  assert.equal(result.checks['CRAFT-01'].pass, true);
  assert.equal(result.checks['CRAFT-02'].pass, true);
  assert.equal(result.checks['CRAFT-05'].pass, true);
  assert.equal(result.checks['CRAFT-07'].pass, false);
  assert.equal(result.checks['CRAFT-15'].pass, true);
});

test('CRAFT-15: missing version stamp fails', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch04-no-version-stamp.md'));
  assert.equal(result.checks['CRAFT-15'].pass, false);
});

test('CRAFT-15: ch04-no-version-stamp fails ONLY CRAFT-15', () => {
  const { result } = runChecker(path.join(FIXTURES, 'known-bad', 'ch04-no-version-stamp.md'));
  assert.equal(result.checks['CRAFT-01'].pass, true);
  assert.equal(result.checks['CRAFT-02'].pass, true);
  assert.equal(result.checks['CRAFT-05'].pass, true);
  assert.equal(result.checks['CRAFT-07'].pass, true);
  assert.equal(result.checks['CRAFT-15'].pass, false);
});

// ---------------------------------------------------------------------------
// Phase 13 novelty / de-duplication tests
// ---------------------------------------------------------------------------
// These tests exercise `craft-check.js --novelty`, a Wave 2 addition that does
// not yet exist. They are RED until Plan 13-05 lands the novelty engine and
// Plans 13-01/13-02 land the adversarial fixtures. Each test has a named
// downstream plan that flips it green — see 13-03-SUMMARY.md for the map.

test('novelty: adversarial Tier 1 fixture produces expected flags', () => {
  const fixtureDir = path.join(__dirname, '..', 'fixtures', 'tiny-book', 'adversarial');
  const expectedPath = path.join(fixtureDir, 'expected-flags.json');
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const dnaPath = path.join(fixtureDir, 'book-dna.md');
  const { stdout } = runCraftCheckNovelty(
    `--novelty --tier both --dna "${dnaPath}" "${fixtureDir}"`
  );
  const result = parseNoveltyResult(stdout);

  assert.equal(result.flag, expected.flag, 'overall flag must match');
  assert.equal(
    result.novelty_dedup,
    expected.novelty_dedup,
    'novelty_dedup verdict must match'
  );

  // Tier 1: repeated_spans — every expected phrase must be present with
  // at least min_occurrences occurrences.
  for (const exp of expected.tier1.repeated_spans || []) {
    const match = (result.repeated_spans || []).find(
      (s) => s.phrase === exp.phrase
    );
    assert.ok(match, `missing expected span: ${exp.phrase}`);
    assert.ok(
      Array.isArray(match.occurrences) &&
        match.occurrences.length >= exp.min_occurrences,
      `span "${exp.phrase}" occurred ${match.occurrences && match.occurrences.length} times, expected >=${exp.min_occurrences}`
    );
  }

  // Tier 1: vulnerability_beat_reuse cross-artefact hits.
  for (const exp of expected.tier1.vulnerability_beat_reuse || []) {
    const match = (result.cross_artefact_hits || []).find(
      (h) =>
        h.type === 'vulnerability_beat_reuse' &&
        h.source &&
        h.source.includes(exp.source_file) &&
        h.duplicate &&
        h.duplicate.includes(exp.duplicate_file)
    );
    assert.ok(
      match,
      `missing expected vulnerability_beat_reuse ${exp.source_file}->${exp.duplicate_file}`
    );
  }

  // Tier 1: central_image_reuse family.
  for (const exp of expected.tier1.central_image_reuse || []) {
    const match = (result.central_image_reuse || []).find(
      (r) =>
        r.vehicle_family === exp.vehicle_family ||
        (r.vehicle && r.vehicle.includes('lamp'))
    );
    assert.ok(
      match,
      `missing expected central_image_reuse for family ${exp.vehicle_family}`
    );
  }

  // Tier 1: refrain_overuse — phrase must appear with exact actual_occurrences.
  for (const exp of expected.tier1.refrain_overuse || []) {
    const match = (result.refrain_overuse || []).find(
      (r) => r.phrase === exp.phrase
    );
    assert.ok(match, `missing expected refrain_overuse for "${exp.phrase}"`);
    assert.equal(
      match.actual_occurrences,
      exp.actual_occurrences,
      `refrain "${exp.phrase}" actual_occurrences mismatch`
    );
  }

  // Refrain whitelist off-by-one: the refrain phrase MUST NOT appear in
  // repeated_spans — it should appear in refrain_overuse instead.
  assert.ok(
    !(result.repeated_spans || []).find(
      (s) => s.phrase === 'one small lamp refusing the whole dark'
    ),
    'refrain at max_uses:1 should NOT appear as a repeated_span — it should appear in refrain_overuse instead'
  );
});

test('novelty: adversarial Tier 2 fixture fires all four Tier 2 rules', () => {
  const fixtureDir = path.join(
    __dirname,
    '..',
    'fixtures',
    'tiny-book',
    'adversarial-enricher'
  );
  const expectedPath = path.join(fixtureDir, 'expected-flags.json');
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const dnaPath = path.join(fixtureDir, 'book-dna.md');
  const { stdout } = runCraftCheckNovelty(
    `--novelty --tier both --dna "${dnaPath}" "${fixtureDir}"`
  );
  const result = parseNoveltyResult(stdout);

  assert.equal(result.flag, expected.flag, 'overall flag must match (Tier 2)');
  assert.equal(
    result.novelty_dedup,
    expected.novelty_dedup,
    'novelty_dedup verdict must match (Tier 2)'
  );

  // Each Tier 2 array in expected-flags.json must have at least one matching
  // entry in the corresponding actual result field. The precise field names
  // are defined by Plan 13-05; we assert presence of at least one hit per
  // non-empty expected array.
  const tier2 = expected.tier2 || {};
  for (const [ruleName, expectedHits] of Object.entries(tier2)) {
    if (!Array.isArray(expectedHits) || expectedHits.length === 0) continue;
    const actualHits = result[ruleName] || (result.tier2 && result.tier2[ruleName]) || [];
    assert.ok(
      Array.isArray(actualHits) && actualHits.length > 0,
      `Tier 2 rule "${ruleName}" expected at least one hit but got ${JSON.stringify(actualHits)}`
    );
  }
});

test('novelty: refrain whitelist respects max_uses off-by-one', () => {
  // Explicit companion to Test A: the refrain phrase is whitelisted for the
  // foreword's 1st occurrence (max_uses: 1) but the 2nd occurrence in ch02
  // must NOT promote the phrase to repeated_spans — it must land in
  // refrain_overuse with actual_occurrences: 2.
  const fixtureDir = path.join(__dirname, '..', 'fixtures', 'tiny-book', 'adversarial');
  const dnaPath = path.join(fixtureDir, 'book-dna.md');
  const { stdout } = runCraftCheckNovelty(
    `--novelty --tier 1 --dna "${dnaPath}" "${fixtureDir}"`
  );
  const result = parseNoveltyResult(stdout);

  const refrain = 'one small lamp refusing the whole dark';
  assert.ok(
    !(result.repeated_spans || []).find((s) => s.phrase === refrain),
    'refrain phrase must NOT appear in repeated_spans (off-by-one whitelist)'
  );
  const over = (result.refrain_overuse || []).find((r) => r.phrase === refrain);
  assert.ok(over, 'refrain phrase must appear in refrain_overuse');
  assert.equal(
    over.actual_occurrences,
    2,
    'refrain actual_occurrences must be exactly 2 (foreword + ch02)'
  );
});

test('novelty: scripture blockquote cross-file does NOT flag', () => {
  // A blockquoted scripture citation repeated verbatim across two files must
  // NOT land in repeated_spans — the novelty engine must skip scripture.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft13-'));
  const feDir = path.join(tmpDir, 'front-matter');
  const edDir = path.join(tmpDir, 'edited');
  fs.mkdirSync(feDir, { recursive: true });
  fs.mkdirSync(edDir, { recursive: true });
  const scripture =
    '<!-- generated-by: dag-book-crafter v1.1.0 -->\n\n' +
    '> *"For by grace you have been saved through faith and this is not of yourselves"*\n' +
    '> — Ephesians 2:8\n\n' +
    'Some chapter prose here that is completely unique per file A.\n';
  fs.writeFileSync(path.join(feDir, 'foreword.md'), scripture);
  fs.writeFileSync(
    path.join(edDir, 'ch01-final.md'),
    scripture.replace('per file A', 'per file B')
  );
  // Minimal book-dna.md so the CLI doesn't error.
  fs.writeFileSync(
    path.join(tmpDir, 'book-dna.md'),
    '# Book DNA\n\n## Refrains\n\nrefrains: []\n'
  );

  const { stdout } = runCraftCheckNovelty(`--novelty --tier 1 "${tmpDir}"`);
  const result = parseNoveltyResult(stdout);

  const scriptureFragment = 'for by grace you have been saved';
  const leaked = (result.repeated_spans || []).find((s) =>
    (s.phrase || '').toLowerCase().includes(scriptureFragment)
  );
  assert.ok(
    !leaked,
    `scripture blockquote must be skipped by novelty engine but found: ${JSON.stringify(leaked)}`
  );
});

test('novelty: --dna flag with no refrains block still runs without error', () => {
  // A book-dna.md lacking a `refrains:` key must not crash the CLI —
  // exit code 0 (clean) or 1 (flag:true) is acceptable, but not 2 (crash).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft13-'));
  const edDir = path.join(tmpDir, 'edited');
  fs.mkdirSync(edDir, { recursive: true });
  fs.writeFileSync(
    path.join(edDir, 'ch01-final.md'),
    '<!-- generated-by: dag-book-crafter v1.1.0 -->\n\nUnique prose without any refrain repetition.\n'
  );
  fs.writeFileSync(
    path.join(tmpDir, 'book-dna.md'),
    '# Book DNA\n\nNo refrains key at all.\n'
  );
  const dnaPath = path.join(tmpDir, 'book-dna.md');

  const { stdout, exitCode } = runCraftCheckNovelty(
    `--novelty --tier 1 --dna "${dnaPath}" "${tmpDir}"`
  );
  assert.ok(
    exitCode === 0 || exitCode === 1,
    `expected exit 0 or 1 (not crash code 2) but got ${exitCode}`
  );
  const result = parseNoveltyResult(stdout);
  assert.ok(
    typeof result.flag !== 'undefined',
    'result must have a `flag` field defined'
  );
});
