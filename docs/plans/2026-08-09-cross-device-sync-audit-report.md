# Cross-device Sync and Progress Documentation Audit

**Date:** 2026-08-09

**Scope:** repository recovery, Node LTS quality gate, progress mirrors, and GitHub handoff

**Source of truth:** `progress/state.yaml`, executable verification code, Git history, and GitHub Actions

## Executive summary

The repository already had a valid A1.1 artifact snapshot and an active A1.2 state, but the public README, maturity model, and competency matrix still described A1.1 as unfinished. The existing recovery entry also started with an unconditional rebase pull and did not define a safe direct-`main` handoff between computers. The published test command was incompatible with Node 24 LTS.

This update establishes Node 24 LTS as the canonical runtime, defines a single-writer and immutable-base protocol for the owner’s direct-`main` workflow, and adds an automated progress-mirror check.

## Findings

| Priority | Area | Finding | Resolution |
|---|---|---|---|
| P1 | Runtime | `node --test test` fails under Node 24 because the directory is treated as a module target | Use an explicit quoted test glob; pin the major LTS contract in `.nvmrc`, package engines, and Actions |
| P1 | Progress | README files, maturity, and competency matrix contradicted A1.2/A1.1 in `state.yaml` | Reconcile every public mirror and add an automated cross-check |
| P1 | Recovery | Unconditional `git pull --rebase` can disturb a dirty or diverged worktree | Require identity, branch, cleanliness, fetch, divergence checks, then `pull --ff-only` |
| P2 | Multi-device ownership | No active-writer, base-SHA, verified-boundary, or conflict contract was stored in the repository | Add `AGENTS.md` and a detailed GitHub execution protocol |
| P2 | Credentials | Per-device `gh auth login` was named, but browser authorization and Token boundaries were incomplete | Document device authorization, identity verification, revocation, and prohibited Token locations |
| P2 | Handoff | The template did not require writer/base/remote gate semantics | Extend the template and current Handoff with live-state rules |

## Evidence boundaries

- A1.1 has a validated public artifact structure contract; this does not prove an executed Harness, scientific evaluation result, or personal mastery.
- A1.2 is the current learning unit; its formal artifact package is not yet delivered.
- GitHub Actions verifies repository contracts on Node 24 LTS; it does not validate a production AI platform.
- Platform runtime, Agent Environment Harness runtime, GitHub Pages, and production adoption remain unimplemented or unclaimed.

## Verification plan

1. Install from the lockfile using Node 24 LTS.
2. Run the complete repository quality gate.
3. Confirm the new progress-drift test fails on a stale fixture and passes on the repository.
4. Inspect the final diff and scan tracked text for credential patterns.
5. Push reviewable commits to `main` only if `origin/main` still equals the recorded base SHA.
6. Confirm the GitHub Actions run attached to the exact pushed HEAD succeeds.
