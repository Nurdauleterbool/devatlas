# MVP-22 — Submission readiness and review evidence

**Prepared:** 2026-10-20 (UTC), for GitHub repository `Nurdauleterbool/devatlas`.  
**Implementation status:** full-stack code through #20 merged; automated #21 improvements merged. **Final human UAT and QA signoff still pending**.

## Review checklist

| Acceptance criterion | Evidence / location | Result as prepared |
| --- | --- | --- |
| New clone installs and starts | Root [README](../README.md); `backend/README.md`; GitHub fresh-clone setup smoke workflow | Instructions updated; await current PR CI |
| Required Markdown committed | `README.md`, `AGENTS.md`, `process.md`, `_docs/plan.md`, `_docs/architecture.md`, `_docs/api-contract.md`, role docs and issue QA files | Updated on this PR |
| API contract and architecture accurate | `_docs/openapi.yml`, `_docs/api-contract.md`, `_docs/architecture.md` | Reconciled to live React + FastAPI + SQLite |
| Test execution evidenced | GitHub Actions Frontend CI / Backend tests / Browser E2E, `_docs/issue-20-qa.md` | Automated coverage available; review actual current logs |
| Real-user desktop/mobile scenarios | `_docs/issue-21-manual-uat.md` with dated outcomes and screenshots | **PENDING: every manual row NOT RUN** |
| User-test bugs triaged and verified | GitHub label `user-test-bug`; PM review, regression test and QA retest for every observed issue | No open label-matching issues observed on 2026-10-20; this does **not** mean manual testing is complete |
| QA closure | All `mvp` and `user-test-bug` issues reviewed and closed by QA | **PENDING:** #21 open; #22 must remain open until #21 is signed off |
| Original brainstorm export if required by assignment | Course evidence attachment; `chat-brainstorm.md` is only a summary | **PENDING:** cannot reconstruct an original chat transcript from summary |

## Demo script (approximately five minutes)

1. **Problem and audience (30 sec):** IT students choose Frontend / Backend / Data Analyst, discover prerequisites and gaps.
2. **Architecture (30 sec):** React/TypeScript UI, typed service, FastAPI/SQLite backend, Alembic migration. Stress real server persistence, not mock-only mode.
3. **Paths and graph (60 sec):** show `/careers`, select Frontend, open `/graph?path=frontend`; explain directed prerequisites and accessible node details.
4. **Practice (60 sec):** open HTML details, mark it learning/completed, then open HTML quiz, submit five options; a pass at **4/5 = 80%** quiz-verifies HTML.
5. **Analytics/persistence (60 sec):** show score, history and career percentages at `/analytics`, refresh and demonstrate that the SQLite-backed result survives.
6. **Privacy and limitations (60 sec):** show an anonymous preview or second account without the first account's data, mention hashed passwords/HttpOnly sessions, explain current local-MVP restrictions and pending manual QA.

## Reproducibility

From a fresh clone:
- Node 24: `cd frontend && npm ci && npm run build && npm test && npm run lint`.
- Python 3.12: `cd backend && python -m pip install -e '.[test]' && python -m alembic upgrade head && python -m pytest -q`.
- Two terminals: start `python -m uvicorn app.main:app --port 8000` from `backend` and `npm run dev` from `frontend`; browse http://localhost:5173.
- Full browser proof: run `frontend` Playwright mock suite; for live suite, use the separate configuration and a **disposable** SQLite database, as in `_docs/issue-20-qa.md`.

## Issue-state checkpoint (verified through GitHub search, 2026-10-20)

- MVP Issues **#1–#20**: merged/closed through the previous QA stages.
- MVP Issue **#21**: open awaiting human desktop/mobile manual UAT.
- MVP Issue **#22**: open until all submission acceptance criteria and #21 signoff.
- `user-test-bug` open issues: **0 matching the search at the checkpoint**. Any later observed defect must be filed, fixed and retested before final acceptance.
- Post-MVP tasks are deferred and do not block core MVP, unless explicitly prioritized.

## QA signoff (leave empty until personally verified)

- Human tester and date: **PENDING**
- Desktop device/browser/version: **PENDING**
- Mobile device/browser/version: **PENDING**
- Screenshot/recording references: **PENDING**
- Outstanding bug issue links and retest outcome: **PENDING**
- QA reviewer, acceptance decision and timestamp: **PENDING**

**Do not close Issue #22 solely because documentation and continuous integration were merged.**
