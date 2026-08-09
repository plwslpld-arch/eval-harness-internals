# Evalorium Agent Instructions

## Source of truth

- GitHub `main` is the durable source of truth. Chat history and local-only files are not project state.
- Read `START_HERE.md`, `progress/state.yaml`, `progress/PROGRESS.md`, and `handoffs/CURRENT.md` before changing the repository.
- Continue only from `progress/state.yaml.next_actions`. Do not regenerate validated units.

## Owner workflow

- The repository owner intentionally works directly on `main`.
- Only one computer or agent may be the active writer at a time.
- Start only from a clean `main` that exactly matches `origin/main`, then use `git pull --ff-only origin main`.
- Never switch computers with uncommitted or unpushed work. Finish a verified commit and push first.
- Before pushing, fetch `origin` and confirm that `origin/main` still equals the recorded starting SHA. Stop on divergence; never force-push or silently overwrite it.
- After pushing, wait for the GitHub Actions run attached to that exact commit and confirm it passed before another computer continues.
- External contributors should use a focused branch and pull request as described in `CONTRIBUTING.md`.

## Runtime and verification

- Use the latest Node.js 24 LTS release. `.nvmrc`, `package.json`, and GitHub Actions define this contract.
- Run `npm ci` and `npm run check` before every commit that changes tracked content.
- Update all progress mirrors when `progress/state.yaml` changes.
- Publish a unit in two stages: first commit and push the candidate package, then wait for that exact commit's remote validation; only a later state commit may mark it `artifact_validated` and advance the current unit. The later state commit must also pass Actions before handoff. This does not claim personal mastery.

## Safety

- Never place tokens, passwords, cookies, private learner data, or local authentication files in source, commands recorded in docs, issues, or chat.
- Authenticate each computer with `gh auth login`; use `gh auth status` to verify the account.
- Revoke and rotate any credential exposed outside the operating-system credential store.
- Preserve unrelated user changes and do not use destructive Git commands.

The detailed cross-device procedure is in `docs/workflows/cross-device-github.md`.
