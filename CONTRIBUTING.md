# Contributing to Evalorium

Evalorium welcomes contributions that improve evaluation rigor, reproducibility, safety, learning quality, or engineering reliability.

## Before starting

Open an issue before large features, architecture changes, new evaluation domains, or maturity-state changes. Explain the risk or user problem, proposed evidence, scope boundary, and validation plan.

Small documentation corrections and focused test fixes may be submitted directly.

Use the latest Node.js 24 LTS release defined by `.nvmrc` and `package.json`. Authenticate GitHub with `gh auth login`; never place a token in a remote URL, command, file, issue, or chat.

## Development workflow

1. Create a focused branch.
2. Add or update tests before changing executable behavior.
3. Run `npm ci` and `npm run check` with Node 24 LTS.
4. Update documentation and evidence links affected by the change.
5. Keep commits reviewable and use descriptive messages.
6. Never include real secrets, personal data, proprietary evaluation samples, or credentials in tests.

## Evidence requirements

Do not change a capability from planned to implemented without runnable code and relevant tests. Do not change implemented to validated without reproducible evaluation evidence and documented limitations. Do not claim production-proven without real deployment evidence and an accountable owner.

## Academy contributions

Curriculum maps and objectives may be proposed in advance. A public lesson artifact can be marked complete only when its required course, template, example, HTML, and validation contract are committed and pass the quality gate. Public artifact completion is not a claim that a learner has personally mastered the topic.

Each completed unit should contain formal learning objectives, concept explanation, boundaries, examples, a reproducible lab, result analysis, assessment material, common errors, references, and an independently readable HTML artifact.

Personal competency claims require separate evidence at the claimed level and are not part of the default public learning record.

## Pull requests

A pull request should state what changed, why it matters, how it was verified, what can still fail, and which maturity or competency claims are affected. Reviewers may reject claims that are stronger than the submitted evidence.
