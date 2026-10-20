# MVP-21 — User acceptance testing and accessibility signoff

**Prepared:** 2026-10-20 (UTC)  
**Status:** automated browser smoke test proposed; **human manual signoff pending**.  
**Application:** DevAtlas / React + FastAPI + SQLite.  
**Baseline:** Issues #19–#20 merged. Existing Browser E2E workflow includes 66 mock scenarios and one full-stack journey.

## Required manual execution environment

Record actual browser name/version, OS, viewport, date/time, tester and application commit SHA before execution. Suggested coverage: Chrome desktop 1280×800, Chromium responsive mode 375×812 and 320×720; a mobile device/browser if available. Start with a fresh local SQLite database containing only test data, via the documented instructions in `_docs/issue-20-qa.md`.

For **each** scenario below enter **PASS / FAIL / BLOCKED / NOT RUN**, actual outcome, a screenshot or browser recording reference and any defect issue ID. **No steps have been marked PASS without being manually observed.**

| ID | Scenario and steps | Expected result | Manual result | Evidence |
|---|---|---|---|---|
| UAT-01 | Open landing page on desktop; navigate career paths and graph without signing in | Public careers and skill previews work; no personal data | NOT RUN | — |
| UAT-02 | Repeat landing, navigation, graph at 320/375/768/1280 widths; scroll pages | All controls fit or usable horizontal graph pan; no unexpected page overflow | NOT RUN | — |
| UAT-03 | Tab and Shift+Tab through header, menus, cards, graph controls and forms; press Enter/Space | Focus indicator visible; usable without mouse; no keyboard trap | NOT RUN | — |
| UAT-04 | Submit signup with blank fields; invalid email and mismatched passwords | Actionable text error; focus and fields preserved | NOT RUN | — |
| UAT-05 | Sign up account A, log out, log in and refresh browser | Session behavior documented; signed-in UI restores correctly | NOT RUN | — |
| UAT-06 | Select frontend; select/clear multiple paths; reload | Selection and counts persist correctly; shared skills counted once | NOT RUN | — |
| UAT-07 | Open skill graph; keyboard-select a node; inspect prerequisites and status | Directed graph and details usable by keyboard and pointer | NOT RUN | — |
| UAT-08 | Mark a skill learning/completed; reload; check history and analytics | Correct owner/status/timestamps/percentages | NOT RUN | — |
| UAT-09 | Take HTML quiz at 60%, retake at 80%, then 0%; reload | Scores correct; 80% verifies skill; best score and attempts preserved | NOT RUN | — |
| UAT-10 | Try submitting incomplete quiz and retry after server/network failure | Helpful validation; no accidental duplicate attempt | NOT RUN | — |
| UAT-11 | Create account B in separate browser session; compare private data | No progress, quiz attempts or selections from account A are visible | NOT RUN | — |
| UAT-12 | Visit Analytics while logged out; test back/forward after logout | Private analytics protected; no stale account content | NOT RUN | — |
| UAT-13 | Zoom to 200% and use high-contrast/device accessibility features | Text/control readability, visible focus and correct labels | NOT RUN | — |
| UAT-14 | Repeat critical mobile quiz path with touch interactions | Inputs and buttons comfortably operable; quiz result readable | NOT RUN | — |

## Automated supplementary evidence

`frontend/e2e/live-journey.spec.ts` now adds an actual-browser accessibility smoke test for responsive widths, semantic main heading/navigation, labeled registration fields, invalid form feedback and anonymous analytics. This is **automated evidence only**. Check GitHub Actions Browser E2E results for the exact commit, including all mock and real FastAPI browser tests. Baseline Pytest and Vitest suites remain in their own workflows; no results are invented here.

## Bug recording and QA retest

For every *observed reproducible defect*, create a GitHub issue labeled `user-test-bug` (create label if missing) with **Goal**, **Description**, reproduction steps, expected/actual behavior, environment, date, impact, screenshot/trace and affected commit. PM should prioritize each bug; engineering fixes it in its own PR; QA adds a regression test and reruns the precise manual scenario before closure. Do not create speculative bug tickets for unobserved concerns.

## Definition of Done

- [x] Manual checklist prepared for all critical MVP journeys.
- [ ] Tester executes desktop and mobile sessions with dated evidence and outcomes.
- [ ] Reproducible failures triaged as distinct `user-test-bug` issues and assigned for repair.
- [ ] PM reviews findings and QA verifies regression coverage/fixes.
- [ ] Human QA authorizes final closure of Issue #21.

**Gate:** Keep Issue #21 open until manual results and signoff exist. Automated CI alone does not satisfy the user testing requirement.
