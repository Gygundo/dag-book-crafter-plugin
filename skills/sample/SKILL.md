---
name: sample
description: "Run a full Dag Book Crafter pipeline end-to-end on the built-in tiny-book fixture and print a one-line PASS/FAIL summary with captivation score. Use when the user says 'run sample', 'try book crafter', 'demo', 'sample book', 'smoke test', or wants a quick end-to-end verification after install."
user-invocable: true
allowed-tools: Read, Write, Bash, Grep, Glob, Agent
---

# Dag Book Crafter Sample

One-command end-to-end smoke-test on the built-in tiny-book fixture. This skill is the single command a fresh recipient (or future `release.sh` gate) runs to prove that the `dag-book-crafter` plugin is installed correctly and that the full pipeline still produces a captivating chapter.

The sample skill is intentionally non-interactive: the fixture is pre-approved by virtue of shipping in the repo, so every approval gate is bypassed and the run either succeeds or fails without prompting.

## §1. Locate the Fixture

The tiny-book fixture ships inside the plugin directory. Resolve its paths via `${CLAUDE_PLUGIN_ROOT}`:

- Brief: `${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/brief.md`
- Threshold: `${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/expected-captivation-score.txt`
- Run directory (orchestrator project root): `${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/run/`

Both fixture files MUST exist before continuing:

```bash
test -f "${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/brief.md" || {
  echo "SAMPLE FAIL — fixture brief missing (see ${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/brief.md)"
  exit 1
}
test -f "${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/expected-captivation-score.txt" || {
  echo "SAMPLE FAIL — fixture threshold missing (see ${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/expected-captivation-score.txt)"
  exit 1
}
```

If either file is absent, emit the corresponding `SAMPLE FAIL — fixture ... missing at <path>` line and exit `1`. Do not attempt recovery — a missing fixture means the plugin install is broken.

## §2. Detect Re-Invocation (Filesystem-as-State)

Check whether the run directory already exists:

```bash
if [ -d "${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/run" ]; then
  RERUN=1
else
  RERUN=0
fi
```

- **`RERUN=0` (first run, directory absent).** Invoke the orchestrator in normal mode. Do **NOT** include the phrase "start fresh" anywhere in the invocation prompt. The orchestrator will create `fixtures/tiny-book/run/` and proceed normally.
- **`RERUN=1` (re-invocation, directory present).** Invoke the orchestrator with the phrase **"start fresh"** included **literally** in the invocation prompt. The orchestrator detects Mode 6 (Fresh Run) by phrase match — there is no CLI flag — and will wipe prior artefacts under `fixtures/tiny-book/run/` before re-running.

This contract is non-negotiable. First run = normal invocation. Re-run = phrase-triggered Fresh Run. The sample skill never auto-enables fresh on first run.

## §3. Invoke the Orchestrator Programmatically

Use the `Agent` tool to spawn the `dag-book-crafter:orchestrator` skill. The invocation prompt MUST include all of the following parameters in plain language so the orchestrator can parse them without follow-up questions:

- **Project path:** `${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/run/` (this overrides the orchestrator's default `~/Documents/Books/` location — D-10)
- **Brief:** the full contents of `${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/brief.md` (read it first, then paste into the prompt)
- **Voice profile:** `dag-default`
- **Size tier:** `booklet`
- **Execution mode:** **Full Pipeline, no review gates.** State this verbatim. The fixture is pre-approved (D-09) so every approval gate (outline approval, edit review, etc.) must be bypassed.
- **Final .docx output path:** Instruct the formatter to write the final `.docx` to `${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/run/final/` explicitly. Use plain language such as: *"Write the final .docx to `${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/run/final/` — do not use the default `~/Documents/Books/` location."* The PASS line path in §5 is locked to `fixtures/tiny-book/run/final/<name>.docx` per D-12, so the sample skill owns this override.
- **Fresh-run trigger:** include the phrase **"start fresh"** in the prompt **only if** §2 set `RERUN=1`.

Wait for the pipeline to complete (outline → research → write → edit → enrich → format). Do not return control until the orchestrator has either finished or errored.

After completion, verify the final `.docx` landed where expected:

```bash
DOCX=$(ls -1 "${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/run/final/"*.docx 2>/dev/null | head -1)
if [ -z "$DOCX" ]; then
  echo "SAMPLE FAIL — .docx missing at fixtures/tiny-book/run/final/ (see fixtures/tiny-book/run/reports/consistency-report.md)"
  exit 1
fi
```

## §4. Compute the Captivation Score

The editor emits `reports/consistency-report.md` during Stage 4. Phase 13 canonicalised the scoring surface: the editor writes a fenced YAML block under a `## Captivation Score` heading with schema_version, captivation_total, novelty_dedup, and per-component scores — all at column 0 so bash grep readers work without jq or any other parsing dependency. See `references/captivation-rubric.md` for schema v2 details, and `skills/editor/SKILL.md ## Captivation Score` for the emit template.

```bash
REPORT="${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/run/reports/consistency-report.md"
if [ ! -f "$REPORT" ]; then
  echo "SAMPLE FAIL — consistency-report.md missing (see ${REPORT})"
  exit 1
fi

# Phase 13: read structured YAML fields (column-0 anchored, no prose grep).
SCHEMA=$(grep -E '^schema_version:' "$REPORT" | head -1 | cut -d: -f2 | tr -d ' ')
N=$(grep -E '^captivation_total:' "$REPORT" | head -1 | cut -d: -f2 | tr -d ' ')
DEDUP=$(grep -E '^novelty_dedup:' "$REPORT" | head -1 | cut -d: -f2 | tr -d ' ')

# Validate: schema_version MUST be 2 (Phase 13 hard break from v1).
if [ "$SCHEMA" != "2" ]; then
  echo "SAMPLE FAIL — consistency-report.md schema_version is '${SCHEMA}' (expected 2) — editor is emitting stale v1 format"
  exit 1
fi

# Validate: captivation_total parsed successfully
if ! echo "$N" | grep -qE '^[0-9]+$'; then
  echo "SAMPLE FAIL — could not parse captivation_total from consistency-report.md"
  exit 1
fi

# Validate: novelty_dedup is pass or fail
if [ "$DEDUP" != "pass" ] && [ "$DEDUP" != "fail" ]; then
  echo "SAMPLE FAIL — novelty_dedup is '${DEDUP}' (expected pass or fail)"
  exit 1
fi

# Count novelty_dedup_flags for FAIL messaging
FLAG_COUNT=$(awk '/^novelty_dedup_flags:/{flag=1; next} flag && /^[^ ]/{flag=0} flag && /^  - /{count++} END{print count+0}' "$REPORT")
```

No fallback to craft-check.js. Phase 11 used craft-check.js as a degraded fallback for the 5-of-14 rubric components; Phase 13 removes this fallback because craft-check.js is neither schema v2 aware nor authoritative for captivation scoring. The `## Captivation Score` YAML block is the single canonical surface per D-24. If the block is missing or malformed, the sample gate hard-fails with a specific reason — there is no degraded path.

### §4.1 Column-0 contract

All four anchor lines (`schema_version:`, `captivation_total:`, `novelty_dedup:`, `novelty_dedup_flags:`) MUST appear at column 0 of their own line inside the report. The editor template at `skills/editor/SKILL.md ## Captivation Score` enforces this contract by emitting a fenced yaml block where the fence characters are on their own lines (so the fence does not consume a grep line start). Any future editor edit that indents these fields or moves them inside a nested structure will break the sample gate immediately — this is intentional per Pitfall 4 (early failure over silent drift).

## §5. Compare to Threshold and Emit PASS/FAIL

Read the threshold integer from the fixture. PASS requires BOTH captivation_total >= threshold AND novelty_dedup == pass. Either condition failing emits a specific FAIL reason per the D-05 four-variant contract.

```bash
M=$(cat "${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/expected-captivation-score.txt" | tr -d '[:space:]')

if ! echo "$M" | grep -qE '^[0-9]+$'; then
  echo "SAMPLE FAIL — fixture threshold missing or malformed at fixtures/tiny-book/expected-captivation-score.txt"
  exit 1
fi

# Evaluate the gate
CAPTIVATION_OK=0
NOVELTY_OK=0
if [ "$N" -ge "$M" ]; then CAPTIVATION_OK=1; fi
if [ "$DEDUP" = "pass" ]; then NOVELTY_OK=1; fi

DOCX_REL="fixtures/tiny-book/run/final/$(basename "$DOCX")"

if [ $CAPTIVATION_OK -eq 1 ] && [ $NOVELTY_OK -eq 1 ]; then
  echo "SAMPLE PASS — .docx at ${DOCX_REL}, captivation ${N}/16 (threshold ${M}), novelty_dedup pass"
  exit 0
fi

# At least one gate failed — pick the reason(s) per D-05 four-variant format
if [ $CAPTIVATION_OK -eq 0 ] && [ $NOVELTY_OK -eq 0 ]; then
  echo "SAMPLE FAIL — captivation ${N}/16 below threshold ${M} AND novelty_dedup fail: ${FLAG_COUNT} flags (see ${REPORT})"
  exit 1
fi
if [ $CAPTIVATION_OK -eq 0 ]; then
  echo "SAMPLE FAIL — captivation ${N}/16 below threshold ${M} (see ${REPORT})"
  exit 1
fi
if [ $NOVELTY_OK -eq 0 ]; then
  echo "SAMPLE FAIL — novelty_dedup fail: ${FLAG_COUNT} flags (see ${REPORT} §novelty_dedup_flags)"
  exit 1
fi
```

D-05 output line format (verbatim):
- PASS: `SAMPLE PASS — .docx at <path>, captivation N/16 (threshold M), novelty_dedup pass`
- FAIL captivation: `SAMPLE FAIL — captivation N/16 below threshold M (see consistency-report.md)`
- FAIL novelty: `SAMPLE FAIL — novelty_dedup fail: K flags (see consistency-report.md §novelty_dedup_flags)`
- FAIL both: `SAMPLE FAIL — captivation N/16 below threshold M AND novelty_dedup fail: K flags`

This format is machine-greppable. Any future release.sh gate that sources this skill's output MUST use `grep -E '^SAMPLE (PASS|FAIL) — '` as the parse anchor. Do not add banners, decoration, or multi-line output — exactly one summary line per invocation (D-10 from Phase 11, superseded and re-stated as D-05 in Phase 13).

Possible failure reasons across §1–§5 (each emits a specific FAIL line via the bash blocks above):

1. `fixture brief missing`
2. `fixture threshold missing` (or malformed)
3. `orchestrator did not complete (no .docx produced)`
4. `.docx missing at fixtures/tiny-book/run/final/`
5. `consistency-report.md missing`
6. `schema_version mismatch` (editor emitting stale v1 format)
7. `could not parse captivation_total`
8. `novelty_dedup not pass/fail`
9. **`captivation N/16 below threshold M`** (new in Phase 13 — D-05)
10. **`novelty_dedup fail: K flags`** (new in Phase 13 — D-05)

Emit exactly **one** PASS or FAIL line per invocation (D-05, superseding D-12). No additional summary lines, no decoration, no banners.

## §6. Exit Code (D-13)

- **PASS → `exit 0`**
- **FAIL → `exit 1`**

This contract enables future `release.sh` integration as a release gate (out of scope for Phase 11, but the contract must be in place now so Phase 12 can wire it).

## Non-Negotiables

- **No interactive gates.** The fixture is pre-approved (D-09). Every approval gate the orchestrator would normally surface MUST be bypassed via the "Full Pipeline, no review gates" directive in §3.
- **No auto-fresh on first run.** First run = normal invocation. Re-run = phrase-triggered Fresh Run (D-11). Never inject "start fresh" on the first run.
- **No output outside the run directory.** All artefacts MUST land under `${CLAUDE_PLUGIN_ROOT}/fixtures/tiny-book/run/`. The orchestrator's default `~/Documents/Books/` path is overridden by the explicit project path passed in §3 (D-10).
- **Release identity.** All internal references use `dag-book-crafter:sample` and `dag-book-crafter:orchestrator`. The dev-time on-disk identifier must never appear anywhere in this skill — recipients only ever see the release name `dag-book-crafter` (D-22).
- **Single PASS/FAIL line.** Emit exactly one summary line per invocation. The format is locked for grep-based release gating.
