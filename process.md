# AI-Native Development Process

1. **PM (`roles/pm.md`)**: refine idea and plan, create small issues with Goal, Description, Acceptance Criteria, Dependencies, and label (`mvp` or `post-mvp`). Prioritize MVP.
2. **Engineer (`roles/software-engineer.md`)**: take one ready issue, implement smallest coherent change, add tests, update docs, link commit/PR and evidence.
3. **QA (`roles/qa-engineer.md`)**: verify acceptance criteria and run relevant automated/manual checks. Only QA closes a verified issue. Failed checks return to engineering.
4. **User testing**: run the real app; for each observed bug create `user-test-bug` issue with reproduction steps, expected/actual result, Goal and Description. PM grooms; QA adds regression cases; engineer fixes; QA retests and closes.
5. **Sequence**: frontend + mockService → `_docs/openapi.yml` → in-memory FastAPI backend → SQLite/SQLAlchemy persistence → frontend HTTP integration → end-to-end tests. Do not skip stage gates.
6. **Documentation**: keep all Markdown in repo, including original brainstorming transcript, plan, decisions, test evidence and setup instructions.
7. **Submission**: confirm all `mvp` and `user-test-bug` issues are closed by QA before deadline; `post-mvp` may remain open. Never close an issue solely to improve metrics.

## Labels
`mvp`: required functionality. `post-mvp`: deferred enhancement. `user-test-bug`: defect found in hands-on testing.

## Issue template
Title; Goal; Description; Acceptance Criteria (testable); Dependencies; Test Plan; Evidence; label.
