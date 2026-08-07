# Evalorium Open-Source Brand and Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the public Evalorium repository from a minimal learning skeleton into a trustworthy bilingual open-source project entry with maintainable brand assets, evidence-based maturity claims, durable handoffs, and automated documentation validation.

**Architecture:** Keep `README.md` and `README.zh-CN.md` concise and navigational while placing durable detail under `docs/`. Treat `progress/state.yaml` as the canonical learning state and bind all maturity claims to evidence. Use SVG as the only editable brand source, generate PNG derivatives with a pinned Node toolchain, and run one repository verifier locally and in GitHub Actions.

**Tech Stack:** Markdown, YAML, SVG, Node.js 20, Node built-in test runner, `sharp@0.35.3`, `yaml@2.9.0`, GitHub Actions.

## Global Constraints

- The repository remains public at `https://github.com/plwslpld-arch/evalorium` and retains Apache-2.0.
- Evalorium remains independent from Loopward, Rein, and Vein.
- Evalorium is an enterprise AI quality engineering platform, not a general coding-agent runtime.
- Agent Environment Harness remains a deep core module inside Evalorium.
- Academy and Platform are both first-class deliverables.
- Academy course bodies are documented only after the learner studies, practices, and passes the unit assessment; curriculum maps and learning objectives may be planned in advance, but they are not completion evidence.
- Target scope remains 8 phases, 29 core chapters, at least 138 knowledge units, 8 phase capstones, and 1 enterprise capstone.
- Do not claim implementation, validation, production adoption, work tenure, or business impact without linked evidence.
- Formal logo source files are SVG. PNG files must be generated from SVG, not manually edited.
- Primary brand colors are Midnight Navy `#0B1020` and Electric Iris `#6C63FF`; Signal Mint `#2DD4BF` is auxiliary and does not appear in the primary logo.
- All text files must be UTF-8 with LF in Git.
- Never commit tokens, API keys, cookies, `.env` files, `.codex/`, or `.superpowers/` brainstorming state.

---

## Planned File Map

### Root entry and policy

- Modify `README.md`: English project entry.
- Create `README.zh-CN.md`: structurally equivalent Chinese entry.
- Modify `START_HERE.md`: definitive cross-device resume protocol.
- Create `CONTRIBUTING.md`: contribution and evidence rules.
- Create `SECURITY.md`: private reporting and credential policy.
- Create `CODE_OF_CONDUCT.md`: Contributor Covenant-based conduct rules.
- Create `.editorconfig`: UTF-8/LF/editor defaults.
- Create `.gitattributes`: Git text normalization.
- Modify `.gitignore`: ignore brainstorming and generated temporary state.

### Durable product documentation

- Create `docs/README.md`: documentation index.
- Create `docs/VISION.md`: users, problem, value, and principles.
- Create `docs/SCOPE.md`: full scope and non-goals.
- Create `docs/ARCHITECTURE.md`: target modules and evidence flow.
- Create `docs/ROADMAP.md`: phase sequence and exit criteria.
- Create `docs/PROJECT_MATURITY.md`: maturity levels and current status.
- Create `docs/MASTERY_STANDARD.md`: five-level competency model.
- Create `docs/JD_COMPETENCY_MAP.md`: all 7 responsibilities and 5 requirements mapped to evidence.
- Create `docs/BRAND.md`: brand usage rules.

### Brand assets

- Create `docs/assets/brand/evalorium-mark.svg`.
- Create `docs/assets/brand/evalorium-mark-mono.svg`.
- Create `docs/assets/brand/evalorium-logo.svg`.
- Create `docs/assets/brand/evalorium-logo-dark.svg`.
- Generate `docs/assets/brand/evalorium-logo.png`.
- Generate `docs/assets/brand/evalorium-mark-512.png`.
- Copy the approved exploration reference to `docs/assets/brand/source-concept.png`.

### State and handoff

- Modify `progress/state.yaml`.
- Modify `progress/PROGRESS.md`.
- Modify `progress/competency-matrix.md`.
- Modify `handoffs/CURRENT.md`.
- Create `handoffs/TEMPLATE.md`.

### Validation and CI

- Create `package.json` and generated `package-lock.json`.
- Create `scripts/render-brand.mjs`.
- Create `scripts/verify-repository.mjs`.
- Create `test/render-brand.test.mjs`.
- Create `test/verify-repository.test.mjs`.
- Create `.github/workflows/docs-quality.yml`.

---

### Task 1: Repository Policy and Validation Foundation

**Files:**
- Create: `.editorconfig`
- Create: `.gitattributes`
- Modify: `.gitignore`
- Create: `package.json`
- Generate: `package-lock.json`
- Create: `test/verify-repository.test.mjs`
- Create: `scripts/verify-repository.mjs`

**Interfaces:**
- Produces: `verifyRepository(rootDir: string): Promise<string[]>`, returning an empty array on success and human-readable errors otherwise.
- Produces: CLI command `npm run verify` with exit code `0` on success and `1` on validation errors.
- Consumes: repository Markdown, YAML, SVG, and PNG paths introduced by later tasks.

- [ ] **Step 1: Add deterministic repository policy files**

Create `.editorconfig` with `root = true`, UTF-8, LF, final newline, trimmed trailing whitespace, two spaces for YAML/JSON, and four spaces for Python-free Markdown code only where an editor applies indentation.

Create `.gitattributes` with:

```gitattributes
* text=auto eol=lf
*.md text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
*.json text eol=lf
*.mjs text eol=lf
*.svg text eol=lf
*.png binary
```

Add the following to `.gitignore`:

```gitignore
.superpowers/
.brand-build/
npm-debug.log*
```

- [ ] **Step 2: Add the pinned Node toolchain**

Create `package.json` with:

```json
{
  "name": "evalorium-project",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test test",
    "verify": "node scripts/verify-repository.mjs",
    "brand:render": "node scripts/render-brand.mjs",
    "brand:check": "node scripts/render-brand.mjs --check",
    "check": "npm test && npm run brand:check && npm run verify"
  },
  "devDependencies": {
    "sharp": "0.35.3",
    "yaml": "2.9.0"
  }
}
```

Run `npm install --package-lock-only`, then `npm ci`.

Expected: both commands exit `0`, and `package-lock.json` records `sharp@0.35.3` and `yaml@2.9.0`.

- [ ] **Step 3: Write failing verifier tests**

Create tests using `node:test`, temporary directories, and strict assertions. Include these cases:

```js
test("valid fixture has no repository errors", async () => {
  assert.deepEqual(await verifyRepository(validFixture), []);
});

test("missing relative Markdown link is reported", async () => {
  const errors = await verifyRepository(fixtureWithMissingLink);
  assert.match(errors.join("\n"), /missing Markdown target/);
});

test("invalid UTF-8 is reported", async () => {
  const errors = await verifyRepository(fixtureWithInvalidUtf8);
  assert.match(errors.join("\n"), /invalid UTF-8/);
});

test("missing state keys are reported", async () => {
  const errors = await verifyRepository(fixtureWithIncompleteState);
  assert.match(errors.join("\n"), /current\.unit/);
});

test("unsafe SVG content is reported", async () => {
  const errors = await verifyRepository(fixtureWithScriptSvg);
  assert.match(errors.join("\n"), /unsafe SVG/);
});

test("credential-shaped content is reported", async () => {
  const errors = await verifyRepository(fixtureWithFakeCredential);
  assert.match(errors.join("\n"), /possible credential/);
});
```

Use synthetic invalid values in fixtures; never place a real credential in tests.

- [ ] **Step 4: Run tests and confirm the expected failure**

Run: `npm test`

Expected: FAIL because `scripts/verify-repository.mjs` or `verifyRepository` does not yet exist.

- [ ] **Step 5: Implement the verifier**

Implement and export:

```js
export async function verifyRepository(rootDir) {
  const errors = [];
  await verifyUtf8(rootDir, errors);
  await verifyMarkdownLinks(rootDir, errors);
  await verifyStateYaml(rootDir, errors);
  await verifySvgSafety(rootDir, errors);
  await verifyBrandFiles(rootDir, errors);
  await verifyCredentialPatterns(rootDir, errors);
  return errors;
}
```

Required behavior:

- Decode tracked text extensions with `new TextDecoder("utf-8", { fatal: true })`.
- Resolve relative Markdown links after stripping anchors; ignore `http:`, `https:`, and `mailto:`.
- Parse `progress/state.yaml` with `yaml@2.9.0` and require `schema_version`, `project`, `program`, `current.phase`, `current.chapter`, `current.unit`, `current.status`, `assessment.status`, `next_actions`, and `publication.repository`.
- Reject SVG containing `<script`, `<foreignObject`, event handler attributes, `javascript:`, remote `http(s)` references, or embedded `data:image` content.
- Require all seven formal brand files after Task 2; until then, expose a `requiredBrandFiles` constant that Task 2 completes before the final `npm run check` gate.
- Scan text for credential-shaped prefixes including `gho_`, `github_pat_`, and `sk-` followed by at least 12 token characters. Exclude synthetic fixtures under the OS temporary directory, not repository test source.
- Ignore `.git`, `node_modules`, `.superpowers`, and `.brand-build`.
- Print each CLI error on its own line and set `process.exitCode = 1` when errors exist.

- [ ] **Step 6: Run verifier unit tests**

Run: `npm test`

Expected: all verifier tests PASS.

- [ ] **Step 7: Commit the validation foundation**

```bash
git add .editorconfig .gitattributes .gitignore package.json package-lock.json scripts/verify-repository.mjs test/verify-repository.test.mjs
git commit -m "chore: add documentation quality foundation"
```

---

### Task 2: Evidence Gate Brand System

**Files:**
- Create: `docs/assets/brand/evalorium-mark.svg`
- Create: `docs/assets/brand/evalorium-mark-mono.svg`
- Create: `docs/assets/brand/evalorium-logo.svg`
- Create: `docs/assets/brand/evalorium-logo-dark.svg`
- Copy: `docs/assets/brand/source-concept.png`
- Generate: `docs/assets/brand/evalorium-logo.png`
- Generate: `docs/assets/brand/evalorium-mark-512.png`
- Create: `scripts/render-brand.mjs`
- Create: `test/render-brand.test.mjs`
- Create: `docs/BRAND.md`

**Interfaces:**
- Produces: `renderBrandAssets(rootDir: string, outputRoot?: string): Promise<void>`.
- Produces: `checkBrandAssets(rootDir: string): Promise<string[]>`.
- Produces: CLI commands `npm run brand:render` and `npm run brand:check`.
- Consumes: the approved Evidence Gate concept and brand colors from the design specification.

- [ ] **Step 1: Write failing brand renderer tests**

Test these behaviors:

```js
test("renders committed PNG derivatives from SVG sources", async () => {
  await renderBrandAssets(fixtureRoot, outputRoot);
  assert.deepEqual(await sharp(markPng).metadata(),
    expectMetadata({ format: "png", width: 512, height: 512 }));
});

test("brand check detects a stale PNG derivative", async () => {
  await fs.writeFile(committedPng, Buffer.from("stale"));
  const errors = await checkBrandAssets(fixtureRoot);
  assert.match(errors.join("\n"), /stale brand derivative/);
});
```

Implement `expectMetadata` locally as a normal function returning only the compared keys; do not introduce a Jest dependency.

- [ ] **Step 2: Run tests and confirm expected failure**

Run: `npm test -- test/render-brand.test.mjs`

Expected: FAIL because the brand renderer is missing.

- [ ] **Step 3: Draw the formal SVG mark**

Create `evalorium-mark.svg` with `viewBox="0 0 64 64"`, a Midnight Navy outer square at `x=4 y=4 width=56 height=56 rx=8`, transparent evidence channels cut through a mask, and an Electric Iris central gate.

Use these exact geometry anchors as the starting source of truth:

```svg
<path d="M17 17H25L43 27V33H38L23 24H17Z"/>
<path d="M10 29H39L48 32L39 35H10Z"/>
<path d="M17 47H25L43 37V31H38L23 40H17Z"/>
<path d="M40 24L53 32L40 40Z" fill="#6C63FF"/>
```

Use the first three paths as mask cutouts rather than white fills so the mark works on arbitrary backgrounds. Add `<title>Evalorium Evidence Gate</title>` and no external resources.

Create `evalorium-mark-mono.svg` from the same geometry with one foreground color and no accent color.

- [ ] **Step 4: Draw horizontal logo variants**

Create both horizontal SVGs with `viewBox="0 0 360 80"`:

- Position the mark in a 64×64 area at `x=8 y=8`.
- Place the wordmark at `x=92`, vertically centered.
- Use exact text `Evalorium`.
- Use a local font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Use `font-size="38"`, `font-weight="650"`, `letter-spacing="-1"`.
- Light variant wordmark color: `#0B1020`.
- Dark variant wordmark color and outer mark color: `#F8FAFC`.
- Do not include a tagline.

- [ ] **Step 5: Implement deterministic PNG rendering**

Implement `scripts/render-brand.mjs` with `sharp`:

```js
await sharp(markSvgPath).resize(512, 512).png().toFile(markPngPath);
await sharp(logoSvgPath).resize({ width: 1440 }).png().toFile(logoPngPath);
```

For `--check`, render both files under `.brand-build/`, compare SHA-256 hashes with committed PNGs, report stale derivatives, and remove only the files created under `.brand-build/`.

- [ ] **Step 6: Preserve the approved concept reference**

Copy the approved second exploration image from:

`C:/Users/Administrator/.codex/generated_images/019fcd4e-e12c-7dc1-ba65-48d491892d38/exec-7d857674-eae4-44f6-a8d5-e608d7d59806.png`

to `docs/assets/brand/source-concept.png`.

Record in `docs/BRAND.md` that this is design provenance only and must never be used as the primary logo source.

- [ ] **Step 7: Generate and test brand assets**

Run:

```bash
npm run brand:render
npm test -- test/render-brand.test.mjs
npm run brand:check
```

Expected: all commands exit `0`; mark PNG is exactly 512×512; committed PNG hashes match fresh renders.

- [ ] **Step 8: Write the brand guide**

Document Evidence Gate meaning, palette, SVG source-of-truth policy, clear-space rule equal to one quarter of mark width, minimum sizes of 16px for mark and 120px for horizontal lockup, approved light/dark/mono variants, and prohibited uses: stretching, recoloring, shadows, rotations, unapproved gradients, separating channels, or using the exploration PNG as the logo.

- [ ] **Step 9: Commit the brand system**

```bash
git add docs/assets/brand docs/BRAND.md scripts/render-brand.mjs test/render-brand.test.mjs
git commit -m "feat: add Evidence Gate brand system"
```

---

### Task 3: Bilingual Project Entry

**Files:**
- Modify: `README.md`
- Create: `README.zh-CN.md`

**Interfaces:**
- Consumes: formal logo assets, vision, scope, maturity semantics, Academy state, and roadmap links.
- Produces: the public English and Chinese entry points used by GitHub visitors.

- [ ] **Step 1: Rewrite the English README**

Use this exact section order:

1. Formal logo and language switch.
2. One-sentence product definition.
3. `Current status: Academy foundation / Platform planned` callout.
4. Why Evalorium.
5. Evidence-first principles.
6. Academy and Platform tracks.
7. Target capability map.
8. Agent Environment Harness.
9. Eval-to-RL loop.
10. Current maturity table.
11. Learning scope.
12. Documentation and resume links.
13. Contributing, security, and license.

Use the phrase “target architecture” for unimplemented modules. Do not present planned modules as available features. Do not add CI badges until Task 8 creates and validates the workflow.

In the Academy section, state the unit gate explicitly: learn, explain, practice, assess, document after passing, commit, then advance. Do not describe Academy as a pre-generated course dump.

- [ ] **Step 2: Write the complete Chinese mirror**

Create `README.zh-CN.md` with the same section order and status semantics. Use formal Chinese terminology, retain established English technical terms where they are standard, and link back to `README.md`.

- [ ] **Step 3: Validate the entry documents**

Run:

```bash
npm run verify
git diff --check -- README.md README.zh-CN.md
```

Expected: no missing relative links, no UTF-8 errors, and no whitespace errors.

- [ ] **Step 4: Commit bilingual entry documents**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: publish bilingual project entry"
```

---

### Task 4: Vision, Scope, Architecture, and Roadmap

**Files:**
- Create: `docs/README.md`
- Create: `docs/VISION.md`
- Create: `docs/SCOPE.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: the approved design spec and product decisions in `progress/state.yaml`.
- Produces: stable targets linked from both README files and later competency documents.

- [ ] **Step 1: Write the documentation index and vision**

`docs/README.md` must group links under Product, Learning, Quality Evidence, Brand, Governance, and Project Design.

`docs/VISION.md` must identify the six user groups—AI quality leads, evaluation engineers, AI platform engineers, agent engineers, safety/red-team engineers, and governance leaders—and define the core job: turn AI requirements and risks into reproducible evidence, release decisions, production monitoring, and improvement data.

State that public Academy lessons are validated learning records: the curriculum map may be designed in advance, but a unit body becomes a completed artifact only after study, practice, and assessment.

- [ ] **Step 2: Write the scope boundary**

Include all target areas: Standards, Eval Core, Measurement, LLM-as-Judge, Human Evaluation, Agent Environment Harness, Security and Red Team, Quality Gates, Observability, Governance, Eval-to-RL, Integrations, and Academy.

Explicit non-goals: model training platform, generic inference server, consumer chatbot, Claude Code replacement, generic agent runtime, and dashboard-only observability product.

- [ ] **Step 3: Write the target architecture**

Describe this evidence flow:

```text
Risk and requirements
  -> standards and test design
  -> datasets, tasks, environments, solvers, scorers
  -> statistical measurement and uncertainty
  -> quality gate and release decision
  -> production telemetry and incidents
  -> regression cases, preference data, verifiers, and RL exports
```

For each module, document responsibility, inputs, outputs, dependencies, extension boundary, and failure modes. Label the entire document as target architecture until implementation evidence exists.

- [ ] **Step 4: Write the roadmap**

Define ordered milestones:

1. Academy Foundation.
2. Eval Core Alpha.
3. Measurement and Judge Reliability.
4. Agent Environment Harness Beta.
5. Security and Quality Gates.
6. Production Monitoring and Governance.
7. Eval-to-RL Integration.
8. Ecosystem and Production Evidence.

Give every milestone entry criteria, concrete deliverables, verification evidence, and exit criteria. Do not use calendar promises as completion evidence.

- [ ] **Step 5: Validate and commit core product docs**

Run `npm run verify` and `git diff --check -- docs`.

Expected: both exit `0`.

```bash
git add docs/README.md docs/VISION.md docs/SCOPE.md docs/ARCHITECTURE.md docs/ROADMAP.md
git commit -m "docs: define Evalorium product foundations"
```

---

### Task 5: Maturity, Mastery, and JD Evidence System

**Files:**
- Create: `docs/PROJECT_MATURITY.md`
- Create: `docs/MASTERY_STANDARD.md`
- Create: `docs/JD_COMPETENCY_MAP.md`
- Modify: `progress/competency-matrix.md`

**Interfaces:**
- Produces: one shared vocabulary for project maturity and learner capability.
- Consumes: evidence links from Academy units, capstones, platform code, tests, releases, and real adoption.

- [ ] **Step 1: Define project maturity levels**

Use these project states exactly: `planned`, `learning`, `implemented`, `validated`, and `production-proven`.

For every state, specify required artifacts and forbidden claims. Set the current repository state to `learning`, with Academy foundation started and Platform planned.

- [ ] **Step 2: Define learner mastery levels**

Use these learner levels exactly: Understanding, Application, Design, Validation, and Leadership.

Clarify that course completion demonstrates only Understanding and limited Application; working projects can demonstrate Design and Validation; Leadership requires real team adoption, governance, and measurable outcomes.

Define the unit completion gate as a prerequisite for even the “course completed” claim: instruction consumed, explanation checked, practical exercise completed, formal assessment passed, and final documentation committed.

- [ ] **Step 3: Map all seven JD responsibilities**

Create one row each for:

1. Enterprise AI quality standards.
2. Mandatory release quality gates.
3. Production risk monitoring.
4. Enterprise evaluation framework.
5. Automated CI/CD evaluation.
6. Frontier evaluation methods.
7. Forward-looking risk analysis.

Every row must contain required knowledge, practical project, Evalorium artifact, verification method, current state, and evidence link.

- [ ] **Step 4: Map all five JD requirements**

Create one row each for:

1. Six or more years of software engineering and two or more years of real AI evaluation framework delivery.
2. Independent multi-dimensional evaluation design.
3. LLM-as-Judge, human annotation, automated metrics, and evaluation bias control.
4. CI/CD quality gate design.
5. Quality culture and business-validated organizational impact.

Mark employment tenure, real enterprise adoption, and business impact as external evidence that the repository cannot manufacture.

- [ ] **Step 5: Upgrade the competency matrix**

Add columns for target level, current level, required evidence, evidence path, last verified date, and limitations. Preserve the current truth that no unit is completed and A1.1 remains in progress.

- [ ] **Step 6: Validate and commit evidence documents**

Run `npm run verify`.

Expected: exit `0` with all internal evidence links resolving.

```bash
git add docs/PROJECT_MATURITY.md docs/MASTERY_STANDARD.md docs/JD_COMPETENCY_MAP.md progress/competency-matrix.md
git commit -m "docs: add maturity and competency evidence model"
```

---

### Task 6: Open-Source Community and Security Files

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`

**Interfaces:**
- Produces: public contribution, vulnerability reporting, and community behavior rules.
- Consumes: evidence-first maturity semantics and Apache-2.0 licensing.

- [ ] **Step 1: Write contribution rules**

Document issue-first changes for large features, branch and commit conventions, mandatory tests, documentation requirements, evidence requirements for maturity claims, prohibition on real secrets in fixtures, and the Academy unit completion contract.

- [ ] **Step 2: Write security policy**

State that vulnerabilities and credential leaks must not be filed publicly. Direct reporters to GitHub private vulnerability reporting when enabled; until enabled, direct them to the repository owner through GitHub profile contact without inventing an email address. Include supported-version semantics: only `main` during the pre-release phase.

- [ ] **Step 3: Add community conduct rules**

Use the Contributor Covenant 2.1 text with project enforcement contact expressed through the repository owner’s GitHub profile rather than an invented private email.

- [ ] **Step 4: Validate and commit community files**

Run `npm run verify` and the credential-pattern scan.

Expected: exit `0` and no contact placeholder.

```bash
git add CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md
git commit -m "docs: add community and security policies"
```

---

### Task 7: Cross-Device State and Handoff Protocol

**Files:**
- Modify: `START_HERE.md`
- Modify: `progress/state.yaml`
- Modify: `progress/PROGRESS.md`
- Create: `handoffs/TEMPLATE.md`
- Modify: `handoffs/CURRENT.md`

**Interfaces:**
- Consumes: current Git commit, current learning unit, validation results, and exact next actions.
- Produces: a complete resume packet that a new Codex task can read without the original conversation.
- Enforces: the active unit cannot advance until learning, practice, assessment, post-pass documentation, verification, and commit are complete in that order.

- [ ] **Step 1: Make START_HERE authoritative**

Define exact read order, exact resume prompt, start-of-session `git pull --rebase`, end-of-session update order, conflict resolution, secret handling, and the rule that conversation history is not the source of truth.

Add the formal Academy unit sequence:

```text
learn -> explain -> practice -> assess -> document after passing -> verify -> commit -> next unit
```

If assessment fails, remain on the same unit and return to learning. Only progress metadata and correction notes may be updated; the unit body and competency evidence must not be marked complete.

- [ ] **Step 2: Extend machine-readable state**

Add:

```yaml
repository:
  default_branch: main
  visibility: public
  license: Apache-2.0
maturity:
  project: learning
  academy: learning
  platform: planned
learning_protocol:
  current_stage: learning
  document_only_after_pass: true
  advance_only_after_commit: true
handoff:
  path: handoffs/CURRENT.md
verification:
  command: npm run check
  status: passed
```

Set `handoff.based_on_commit` to the full output of `git rev-parse HEAD` immediately before the state update. The written YAML value must be a literal 40-character SHA and is intentionally the commit that the Handoff describes, not a self-referential claim about the later metadata commit.

- [ ] **Step 3: Write the reusable Handoff template**

Required sections: confirmed decisions, current state, evidence completed, files changed, validation commands and results, exact next actions, unresolved risks, recent commit, and remote synchronization status.

- [ ] **Step 4: Refresh CURRENT handoff and human progress**

Record the completed open-source documentation and brand foundation without marking A1.1 complete. Set the next learning action to restart A1.1 from the first formal lesson after repository verification. The Handoff must state that A1.1 documentation is created only after the learner passes its assessment.

- [ ] **Step 5: Validate synchronization semantics**

Run:

```bash
npm run verify
git diff --check -- START_HERE.md progress handoffs
```

Expected: exit `0`; YAML required keys exist; all referenced paths resolve.

- [ ] **Step 6: Commit the cross-device protocol**

```bash
git add START_HERE.md progress handoffs
git commit -m "docs: harden cross-device learning handoff"
```

---

### Task 8: Continuous Documentation Quality Gate

**Files:**
- Create: `.github/workflows/docs-quality.yml`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Interfaces:**
- Consumes: `npm ci` and `npm run check`.
- Produces: mandatory repeatable verification on pull requests and pushes to `main`.

- [ ] **Step 1: Add GitHub Actions workflow**

Use:

```yaml
name: Documentation Quality
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
```

- [ ] **Step 2: Run the same gate locally**

Run: `npm ci && npm run check`

Expected: tests pass, brand derivatives are current, documentation validation returns no errors.

- [ ] **Step 3: Add a real workflow badge**

Only after the workflow file exists and the local gate passes, add the Documentation Quality badge to both README files. Link it to the repository Actions workflow. Do not add coverage, release, download, or production badges.

- [ ] **Step 4: Commit the quality gate**

```bash
git add .github/workflows/docs-quality.yml README.md README.zh-CN.md
git commit -m "ci: enforce documentation quality gate"
```

---

### Task 9: Final Repository and Remote Verification

**Files:**
- Modify only files required by discovered validation defects.

**Interfaces:**
- Consumes: every deliverable from Tasks 1–8.
- Produces: verified local and remote `main` with no uncommitted files.

- [ ] **Step 1: Run the complete local gate from a clean dependency install**

Run:

```bash
npm ci
npm run check
git diff --check
git status --short
```

Expected: all commands exit `0`, all tests pass, and `git status --short` is empty after committing any required fixes.

- [ ] **Step 2: Perform the acceptance checklist**

Verify each design-spec acceptance criterion directly:

- Repository is public and Apache-2.0.
- English and Chinese README files render and link correctly.
- Target scope covers the complete enterprise AI quality role.
- Maturity and mastery claims include evidence and limitations.
- START_HERE plus state and handoff can resume on another computer.
- Academy enforces learn, explain, practice, assess, post-pass documentation, verification, commit, and only then the next unit.
- All required SVG and PNG assets exist.
- No placeholder, broken link, encoding failure, unsafe SVG, stale PNG, or possible credential is reported.

- [ ] **Step 3: Push and verify the remote head**

Run:

```bash
git push origin main
gh repo view plwslpld-arch/evalorium --json visibility,licenseInfo,defaultBranchRef,url
gh api repos/plwslpld-arch/evalorium/commits/main --jq .sha
git rev-parse HEAD
```

Expected: visibility is `PUBLIC`, license key is `apache-2.0`, default branch is `main`, and remote SHA equals local SHA.

- [ ] **Step 4: Verify the GitHub workflow**

Run:

```bash
gh run list --repo plwslpld-arch/evalorium --workflow docs-quality.yml --limit 1
```

If the run is still active, capture and watch the exact run:

```powershell
$runId = gh run list --repo plwslpld-arch/evalorium --workflow docs-quality.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $runId --repo plwslpld-arch/evalorium --exit-status
```

Expected final conclusion: `success`.

- [ ] **Step 5: Record the final handoff commit**

Update `progress/state.yaml` and `handoffs/CURRENT.md` with the actual final SHA and verified workflow result, run `npm run check`, commit the metadata update, push, and verify the new remote SHA again.

Use commit message:

```bash
git commit -m "docs: record verified open-source foundation"
```

The next action after this plan is A1.1 first formal lesson. Do not prewrite the completed A1.1 lesson in the repository and do not mark A1.1 complete. Teach and learn it first; after practice and assessment pass, create the final open-source unit documentation, update evidence, commit, and only then enter A1.2.

---

## Plan Self-Review Record

- Spec coverage: every section of the approved design maps to Tasks 1–9.
- Placeholder scan: the implementation may not leave unresolved placeholders, invented contact data, or unsupported maturity claims.
- Interface consistency: `verifyRepository`, `renderBrandAssets`, and `checkBrandAssets` names are used consistently across tests, scripts, package commands, and CI.
- Scope: this plan delivers only the open-source brand and documentation foundation; it does not implement Evalorium Platform runtime features or GitHub Pages.
