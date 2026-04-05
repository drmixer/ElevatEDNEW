# Tutor Eval Fixtures

This fixture set is the first regression harness for tutor usefulness work.

Source of truth:

- Fixture cases: [docs/tutor-eval-fixtures.json](/Users/drmixer/code/ElevatEDNEW/docs/tutor-eval-fixtures.json)
- Scoring helper: [src/lib/tutorEvaluation.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/tutorEvaluation.ts)
- Tests: [src/lib/__tests__/tutorEvaluation.test.ts](/Users/drmixer/code/ElevatEDNEW/src/lib/__tests__/tutorEvaluation.test.ts)

Current fixture goals:

- grounded hinting against the active problem
- no answer leakage for hint mode
- alternate explanation grounded in lesson text
- safe refusal for unsafe or off-topic prompts

This is intentionally small. Add new cases when prompt rules, fallback rules, or model behavior changes.

