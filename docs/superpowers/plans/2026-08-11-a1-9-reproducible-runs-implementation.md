# A1.9 Reproducible Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish A1.9《从评测计划到可复现运行》as a complete Academy unit whose run identity, Trial/Attempt, trace, recovery, budget, adapter and audit semantics are enforced by a canonical verifier profile.

**Architecture:** Keep the existing manifest-driven Academy architecture. Add one self-contained A1.9 package with ten YAML contracts and three synthetic cases, then extend the shared verifier with `plan-to-reproducible-run-v1`; the verifier normalizes the package into identity, execution, evidence and conclusion invariants without implementing a live distributed runtime.

**Tech Stack:** Node.js 24 LTS, ECMAScript modules, `node:test`, `yaml` 2.9.0, Markdown, standalone HTML, GitHub Actions.

## Global Constraints

- Work directly on clean `main` as the repository owner; one active writer, fast-forward only, never force-push.
- Use Node.js `>=24 <25`; run with `D:\work\nvm\nvm\v24.16.0` prepended to `PATH`, never invoke NVM for Windows.
- Public files contain corrected final artifacts only: no conversation, personal answers, private notes, credentials, real business data or intermediate drafts.
- Every example and result is `synthetic-teaching-fixture`; real evaluation, production deployment and personal capability claims remain false.
- Follow red-green-refactor for verifier behavior: every new semantic check first appears as a test that fails for the intended reason.
- Candidate content and validation-state publication are separate commits; each pushed SHA must pass the exact `Documentation Quality` run before proceeding.
- Reuse existing Academy HTML style and manifest conventions; do not add a frontend framework or runtime dependency.

---

## File Map

- `academy/phase-a/chapter-a1/unit-a1-9/README.md`: authoritative Chinese lesson.
- `academy/phase-a/chapter-a1/unit-a1-9/index.html`: standalone responsive reading edition and local contract navigation.
- `academy/phase-a/chapter-a1/unit-a1-9/artifact-manifest.yaml`: package declaration and profile binding.
- `academy/phase-a/chapter-a1/unit-a1-9/run-spec.yaml`: declared study/run configuration.
- `academy/phase-a/chapter-a1/unit-a1-9/resolved-run-identity.yaml`: resolved identities, digests and reconciliation.
- `academy/phase-a/chapter-a1/unit-a1-9/trial-plan.yaml`: planned Trial population, pairing and denominator.
- `academy/phase-a/chapter-a1/unit-a1-9/attempt-ledger.yaml`: Attempt, lease, retry and canonical result ledger.
- `academy/phase-a/chapter-a1/unit-a1-9/trace-contract.yaml`: event and observable-behavior contract.
- `academy/phase-a/chapter-a1/unit-a1-9/artifact-lineage-manifest.yaml`: Artifact, Observation Bundle, Score and decision lineage.
- `academy/phase-a/chapter-a1/unit-a1-9/execution-policy.yaml`: isolation, concurrency, error, retry and resume policy.
- `academy/phase-a/chapter-a1/unit-a1-9/budget-and-stopping-policy.yaml`: product/Harness budgets and predeclared stopping.
- `academy/phase-a/chapter-a1/unit-a1-9/adapter-capability-contract.yaml`: honest capability declarations for external tools.
- `academy/phase-a/chapter-a1/unit-a1-9/run-audit-report.yaml`: synthetic audit summary and allowed conclusions.
- `academy/phase-a/chapter-a1/unit-a1-9/examples/*/evaluation-case.yaml`: refund, contract and knowledge cases.
- `scripts/verify-academy-unit.mjs`: profile registry, contracts and semantic verification.
- `test/verify-academy-unit.test.mjs`: canonical acceptance and mutation tests.
- `START_HERE.md`, `progress/state.yaml`, `progress/PROGRESS.md`, `handoffs/CURRENT.md`: post-validation progress mirrors.

---

### Task 1: Establish the canonical profile and package skeleton

**Files:**
- Modify: `test/verify-academy-unit.test.mjs`
- Modify: `scripts/verify-academy-unit.mjs`
- Create: `academy/phase-a/chapter-a1/unit-a1-9/artifact-manifest.yaml`
- Create: the ten YAML contract files and three example files listed in the File Map

**Interfaces:**
- Consumes: existing `verifyAcademyUnit(unitDir): Promise<string[]>`, manifest profile lookup and `mutateYaml()` test helper.
- Produces: profile name `plan-to-reproducible-run-v1`, constant `A19_UNIT`, and parsed template/example maps available to later semantic checks.

- [ ] **Step 1: Add the failing canonical-profile test**

```js
const A19_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-9",
);

test("an A1.9 plan-to-reproducible-run profile requires every contract and domain case", async () => {
  const root = await createValidUnit();
  await write(root, "artifact-manifest.yaml", `schema_version: 1
unit: {id: A1.9, title: 从评测计划到可复现运行, phase: A, chapter: A1}
publication: {status: candidate, language: zh-CN, formats: [markdown, html, yaml]}
contents: {lesson: README.md, html: index.html, templates: [], examples: []}
verification: {profile: plan-to-reproducible-run-v1}
`);
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /requires run-spec\.yaml/);
  assert.match(report, /requires run-audit-report\.yaml/);
  assert.match(report, /requires examples\/knowledge-assistant\/evaluation-case\.yaml/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test --test-name-pattern="A1.9 plan-to-reproducible-run profile requires" test/verify-academy-unit.test.mjs`

Expected: FAIL because the profile is unknown and does not require the A1.9 contracts.

- [ ] **Step 3: Register the exact profile and structural contracts**

Add all ten template names and all three case paths to `VERIFICATION_PROFILES`; bind `A1.9` in `CANONICAL_UNIT_PROFILES` and `EXPLICIT_PROFILE_UNITS`. Add `PROFILE_CONTRACTS["plan-to-reproducible-run-v1"]` entries with these kinds:

```js
{
  "run-spec.yaml": {kind: "RunSpec", required: ["metadata.id", "study", "targets", "data", "harness", "environment", "scoring", "analysis", "execution"]},
  "resolved-run-identity.yaml": {kind: "ResolvedRunIdentity", required: ["metadata.id", "run_id", "digests", "resolutions", "reconciliation"]},
  "trial-plan.yaml": {kind: "TrialPlan", required: ["metadata.id", "run_spec_id", "design", "counts", "denominator_policy"]},
  "attempt-ledger.yaml": {kind: "AttemptLedger", required: ["metadata.id", "trial_plan_id", "attempts", "canonical_commit_policy", "summary"]},
  "trace-contract.yaml": {kind: "TraceContract", required: ["metadata.id", "identity", "causality", "events", "reasoning_capture", "completeness"]},
  "artifact-lineage-manifest.yaml": {kind: "ArtifactLineageManifest", required: ["metadata.id", "run_identity_id", "artifacts", "observation_bundles", "score_events", "lineage"]},
  "execution-policy.yaml": {kind: "ExecutionPolicy", required: ["metadata.id", "concurrency", "isolation", "error_taxonomy", "retry_policy", "resume_policy"]},
  "budget-and-stopping-policy.yaml": {kind: "BudgetAndStoppingPolicy", required: ["metadata.id", "product_budget", "harness_budget", "reservation", "stopping_rules"]},
  "adapter-capability-contract.yaml": {kind: "AdapterCapabilityContract", required: ["metadata.id", "canonical_model", "adapters", "normalization"]},
  "run-audit-report.yaml": {kind: "RunAuditReport", required: ["metadata.id", "run_identity_id", "execution_summary", "evidence_assessment", "conclusion"]},
  example: {kind: "EvaluationCase", required: ["metadata.id", "classification", "references", "input", "expected", "evidence"]},
}
```

- [ ] **Step 4: Create the manifest and structurally complete synthetic contracts**

Use stable IDs ending in `.a19`, `publication.status: candidate`, all ten template paths, all three case paths, and `verification.profile: plan-to-reproducible-run-v1`. Each YAML file must include the exact top-level fields in Step 3 and must use explicit synthetic evidence flags.

- [ ] **Step 5: Re-run the focused test and structural unit verification**

Run: `node --test --test-name-pattern="A1.9 plan-to-reproducible-run profile requires" test/verify-academy-unit.test.mjs`

Run: `node scripts/verify-academy-unit.mjs academy/phase-a/chapter-a1/unit-a1-9`

Expected: profile-requirement test passes; unit may still report only semantic checks introduced by later tasks.

---

### Task 2: Enforce identity, Trial and Attempt semantics

**Files:**
- Modify: `test/verify-academy-unit.test.mjs`
- Modify: `scripts/verify-academy-unit.mjs`
- Modify: A1.9 identity, plan, ledger, execution policy and three cases

**Interfaces:**
- Consumes: parsed `run-spec.yaml`, `resolved-run-identity.yaml`, `trial-plan.yaml`, `attempt-ledger.yaml`, `execution-policy.yaml`.
- Produces: `verifyPlanToReproducibleRunTemplates(templateValues, errors)` and identity/execution errors used by repository validation.

- [ ] **Step 1: Add failing mutation tests**

Create focused tests that copy `A19_UNIT` and mutate one invariant per test:

```js
test("A1.9 keeps Trial counts independent from retry Attempts", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-denominator-");
  await mutateYaml(root, "attempt-ledger.yaml", (value) => {
    value.summary.statistical_denominator = value.summary.total_attempts;
  });
  assert.match((await verifyAcademyUnit(root)).join("\n"), /statistical denominator must equal planned canonical Trials/);
});

test("A1.9 rejects Harness retry of target failures", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-target-retry-");
  await mutateYaml(root, "execution-policy.yaml", (value) => {
    value.error_taxonomy.target_failure.harness_retry_allowed = true;
  });
  assert.match((await verifyAcademyUnit(root)).join("\n"), /target failure harness_retry_allowed must be false/);
});
```

Also test: mutable alias used as final resolved identity; `mismatch` claiming direct comparability; planned count not equal to sample × target × repetition; two canonical Attempts for one Trial; expired lease entering Score Events.

- [ ] **Step 2: Run each mutation test and confirm RED**

Run each name with `node --test --test-name-pattern="<exact test name>" test/verify-academy-unit.test.mjs`.

Expected: each test fails because the mutation is not yet detected, not because YAML parsing fails.

- [ ] **Step 3: Implement identity and execution verification**

In `verifyPlanToReproducibleRunTemplates()`:

```js
const planned = design.sample_count * design.target_count * design.repetitions;
if (counts.planned_trials !== planned) errors.push("trial-plan.yaml: planned_trials must equal sample_count * target_count * repetitions");
if (ledger.summary.statistical_denominator !== counts.planned_trials) errors.push("attempt-ledger.yaml: statistical denominator must equal planned canonical Trials");
if (ledger.summary.canonical_results > counts.planned_trials) errors.push("attempt-ledger.yaml: canonical results cannot exceed planned Trials");
```

Validate immutable resolved IDs and 64-hex digests, reconciliation/comparability claims, unique `attempt_id`, at most one canonical Attempt per `trial_id`, current fencing token for canonical commits, and the retry eligibility matrix.

- [ ] **Step 4: Run the focused tests and full A1.9 acceptance test**

Run: `node --test --test-name-pattern="A1.9" test/verify-academy-unit.test.mjs`

Expected: all identity, Trial and Attempt tests pass and the canonical package produces no errors for this group.

---

### Task 3: Enforce Trace, evidence, budget, stopping and adapter truthfulness

**Files:**
- Modify: `test/verify-academy-unit.test.mjs`
- Modify: `scripts/verify-academy-unit.mjs`
- Modify: A1.9 trace, lineage, budget, adapter, audit and case YAML files

**Interfaces:**
- Consumes: canonical Attempt IDs from Task 2 and A1.8 upstream decision identities declared in the examples.
- Produces: complete trace/evidence lineage validation and `verifyPlanToReproducibleRunCase(value, relativePath, errors)`.

- [ ] **Step 1: Add failing semantic mutation tests**

Add tests for:

```js
test("A1.9 binds every Score Event to canonical evidence", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-score-lineage-");
  await mutateYaml(root, "artifact-lineage-manifest.yaml", (value) => {
    value.score_events[0].observation_bundle_digest = `sha256:${"f".repeat(64)}`;
  });
  assert.match((await verifyAcademyUnit(root)).join("\n"), /score event observation bundle digest does not resolve/);
});

test("A1.9 prohibits hidden chain-of-thought capture", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-reasoning-");
  await mutateYaml(root, "trace-contract.yaml", (value) => {
    value.reasoning_capture.hidden_chain_of_thought = "required";
  });
  assert.match((await verifyAcademyUnit(root)).join("\n"), /hidden_chain_of_thought must be prohibited/);
});
```

Also cover: missing parent/sequence causality; partial or truncated Trace used as fully scorable; product and Harness budget merged; optional stopping enabled; safety stop claiming complete capability estimates; adapter marking unavailable Attempt identity as full; synthetic evidence enabling real deployment; example reference not covered by audit trace closure.

- [ ] **Step 2: Run each new test and confirm RED**

Run each exact test with `node --test --test-name-pattern` and retain the expected assertion failure before implementation.

- [ ] **Step 3: Implement evidence and truthfulness checks**

Verify event IDs, parent references and sequence uniqueness; require `hidden_chain_of_thought: prohibited`; require complete Trace for canonical scoring; resolve every Artifact/Observation Bundle/Score digest; require Score Events to bind canonical Trial/Attempt and Scorer IDs; require product/Harness budgets as distinct objects; forbid optional stopping; constrain conclusions after budget or safety early stops; validate adapter capability enums and missing-source declarations; enforce all synthetic/real-authorization flags as false.

- [ ] **Step 4: Implement case-specific audit closure**

For every case, build a set of nested IDs plus declared upstream IDs and require every `references.*` ID to appear in `expected.audit_trace_closure`. Validate stable outcomes:

- refund: `blocked`, 1,000 planned Trials, 1,006 Attempts, safety failure preserved;
- contract: `invalid` or `inconclusive`, 20 mismatched Trials, no direct-comparison claim;
- knowledge: offline conditional result plus synthetic production `pause_rollout` and `rollback_retrieval_index`, with no real production claim.

- [ ] **Step 5: Run all A1.9 tests**

Run: `node --test --test-name-pattern="A1.9" test/verify-academy-unit.test.mjs`

Expected: canonical acceptance and all semantic mutation tests pass.

---

### Task 4: Publish the corrected lesson and standalone HTML

**Files:**
- Create: `academy/phase-a/chapter-a1/unit-a1-9/README.md`
- Create: `academy/phase-a/chapter-a1/unit-a1-9/index.html`
- Modify: `test/verify-academy-unit.test.mjs`

**Interfaces:**
- Consumes: all ten YAML contract filenames and the nine learned lesson sections.
- Produces: public Markdown/HTML navigation whose local links are checked by `verifyHtml(..., true)`.

- [ ] **Step 1: Add a failing broken-link test**

```js
test("A1.9 HTML cannot link to a missing local artifact", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-html-");
  const htmlPath = path.join(root, "index.html");
  await writeFile(htmlPath, (await readFile(htmlPath, "utf8")).replace("run-spec.yaml", "missing-run-spec.yaml"));
  assert.match((await verifyAcademyUnit(root)).join("\n"), /index\.html: broken local href missing-run-spec\.yaml/);
});
```

- [ ] **Step 2: Confirm RED before enabling local-link verification for the profile**

Run: `node --test --test-name-pattern="A1.9 HTML cannot link" test/verify-academy-unit.test.mjs`

Expected: FAIL because the A1.9 profile does not yet request local href validation.

- [ ] **Step 3: Write the final lesson and HTML**

The lesson must cover: object model; immutable run identity; reproducibility; concurrency/distributed semantics; errors/retry/resume; Trace/Artifact/lineage; budget/stopping; mainstream tool adapters; three end-to-end audits. Include official source links for Inspect AI, OpenAI Evals/Graders, LangSmith, MLflow, Phoenix, DeepEval and Promptfoo. The HTML must use `lang="zh-CN"`, UTF-8, `<main>`, responsive layout, visible evidence boundary and links to every declared YAML/example.

- [ ] **Step 4: Enable local href validation for `plan-to-reproducible-run-v1` and run tests**

Add the profile to the `verifyHtml(..., true)` profile list, run the broken-link test, then run all A1.9 tests.

---

### Task 5: Verify and publish the candidate package

**Files:**
- Modify only files created or changed by Tasks 1–4 plus this plan.

**Interfaces:**
- Consumes: complete A1.9 package and verifier.
- Produces: candidate commit and exact successful remote validation evidence.

- [ ] **Step 1: Run full fresh verification**

```powershell
$env:Path = 'D:\work\nvm\nvm\v24.16.0;' + $env:Path
npm ci
npm run check
git diff --check
```

Expected: all tests pass, brand derivatives are current, repository verification passes and `git diff --check` is silent.

- [ ] **Step 2: Review scope and credential safety**

Run `git status --short`, `git diff --stat`, inspect the full changed-file list, and run repository verification's credential scanner through `npm run verify`. Confirm no progress mirror advances before remote candidate validation.

- [ ] **Step 3: Confirm origin has not diverged and commit candidate**

```powershell
git fetch origin
git rev-parse origin/main
git add -- academy/phase-a/chapter-a1/unit-a1-9 scripts/verify-academy-unit.mjs test/verify-academy-unit.test.mjs docs/superpowers/plans/2026-08-11-a1-9-reproducible-runs-implementation.md
git commit -m "feat(academy): add A1.9 reproducible run candidate"
git push origin main
```

Require `origin/main` before commit to equal the recorded starting SHA `50604583a339f0cbc6110e4a89fe66d4e001e0d7`.

- [ ] **Step 4: Validate the exact candidate SHA remotely**

Find the `Documentation Quality` run whose `headSha` exactly equals the candidate commit, then execute `gh run watch <run-id> --exit-status`. Record run ID, URL, status, conclusion and head SHA for the state update.

---

### Task 6: Publish validated state and cross-device handoff

**Files:**
- Modify: `progress/state.yaml`
- Modify: `progress/PROGRESS.md`
- Modify: `START_HERE.md`
- Modify: `handoffs/CURRENT.md`
- Modify: Academy navigation/maturity mirrors discovered by repository verification

**Interfaces:**
- Consumes: exact successful candidate SHA and Actions run from Task 5.
- Produces: `A1.9 artifact_validated`, next-unit pointer, and a clean cross-device boundary.

- [ ] **Step 1: Update state only from exact remote evidence**

Set A1.9 as `last_completed.status: artifact_validated`, record candidate SHA, local test count, exact remote run ID/status/conclusion/head SHA/URL, and move `current.unit` to the next curriculum unit with `status: not_started`. State explicitly that this does not claim personal mastery or a live Harness implementation.

- [ ] **Step 2: Synchronize every progress mirror**

Update progress comments and prose consistently in all required mirrors; describe ten contracts, three cases, canonical profile coverage, test count and evidence boundary.

- [ ] **Step 3: Run full fresh verification and commit state**

Run `npm ci && npm run check`, `git diff --check`, fetch origin and require `origin/main` to equal the candidate SHA. Commit with `docs(state): finalize A1.9 validation metadata` and push.

- [ ] **Step 4: Validate exact state SHA and close handoff**

Watch the exact state commit's GitHub Actions run to `completed/success`. Confirm `git status --short` is empty and local `HEAD` equals `origin/main`. Report both candidate and state SHAs and their exact remote runs.

---

## Plan Self-Review Result

- Specification coverage: all ten contracts, three cases, lesson/HTML, canonical verifier, TDD mutations, candidate publication and state publication are assigned to tasks.
- Scope: one Academy unit and its shared verifier extension; no distributed runtime, database, provider call or production integration is introduced.
- Type consistency: profile name, file names, `verifyPlanToReproducibleRunTemplates`, `verifyPlanToReproducibleRunCase` and `A19_UNIT` are used consistently.
- Evidence boundary: every output remains synthetic and cannot authorize deployment or certify a person.
