# Contributing to Evalorium

Evalorium welcomes contributions that improve evaluation rigor, reproducibility, safety, learning quality, or engineering reliability.

## Before starting

Open an issue before large features, architecture changes, new evaluation domains, or maturity-state changes. Explain the risk or user problem, proposed evidence, scope boundary, and validation plan.

Small documentation corrections and focused test fixes may be submitted directly.

## Development workflow

1. Create a focused branch.
2. Add or update tests before changing executable behavior.
3. Run `npm ci` and `npm run check`.
4. Update documentation and evidence links affected by the change.
5. Keep commits reviewable and use descriptive messages.
6. Never include real secrets, personal data, proprietary evaluation samples, or credentials in tests.

## Evidence requirements

Do not change a capability from planned to implemented without runnable code and relevant tests. Do not change implemented to validated without reproducible evaluation evidence and documented limitations. Do not claim production-proven without real deployment evidence and an accountable owner.

## Academy contributions

Curriculum maps and objectives may be proposed in advance. A lesson cannot be marked complete until the learner has studied it, demonstrated understanding, completed the practical exercise, passed assessment, documented the corrected artifact, and committed it after validation.

Each completed unit should contain formal learning objectives, concept explanation, boundaries, examples, a reproducible lab, result analysis, assessment, common errors, and references.

## Pull requests

A pull request should state what changed, why it matters, how it was verified, what can still fail, and which maturity or competency claims are affected. Reviewers may reject claims that are stronger than the submitted evidence.
