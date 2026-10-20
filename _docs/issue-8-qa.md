# Issue #8 — analytics and history QA

Date: 2026-10-20. Mock frontend stage. Branch feat/issue-8-analytics-history starts from fetched main after verified Issue #7 merge ceeb522. Actual issue criteria and dependencies were read before implementation.

## Acceptance evidence

Authenticated analytics show completion across all unique catalogue skills, current learning count, independently quiz-verified count, quiz statistics and per-career progress. Status history and every retained quiz attempt are joined with skill names and sorted oldest first. Displayed dates use the browser time zone, stated alongside the chart and histories; time elements retain the original UTC timestamp.

The completion chart reconstructs counts from current statuses and recorded transitions, including resets and skills completed before the available history. It uses only actual event times, preserves source order for equal timestamps and collapses equal-time chart points to their final count. A named SVG description and a visible exact-data table expose the same information. It does not invent earlier activity or a verification timeline. Empty histories have explicit copy and no fabricated chart.

All personal records and summary aggregates are validated against the current account, catalogue and retained attempts. Account keys isolate views. Shared workspace refreshes invalidate older analytics snapshots, including a status save completed after navigating away from skill details. Effect cleanup prevents older reads publishing over a newer view. Anonymous visitors receive a login prompt without personal tables. Failed reads expose a deliberate retry.

## Executed verification

From frontend, Node 24.19.0/npm 11.9.0, system Chromium 154.0.8037.57:

| Command | Actual result |
| --- | --- |
| npm run build | PASS, exit 0; TypeScript + Vite, 2,123 modules; separate 19.31kB analytics module |
| npm run lint | PASS, exit 0 |
| npm run test | 232 passed, 0 failed/skipped; 11 files; exit 0 |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e | 66 passed, 0 failed/skipped; 1.3m; exit 0 |

Seventeen new model tests cover populated/empty data, chronological ties, decreases after resets, prior completions, shared-skill denominators, owner/reference/summary validation and defensive copies. Independent read-only review reran all 17 tests and approved the implementation without blocking findings.

Seven new browser cases cover anonymous restrictions, the seeded four-event completion series, summary/history reconciliation after status and quiz writes, a pending save completed after leaving details, empty new-account isolation, failed reads/retry and 320/375/768/1280px layouts. The first targeted run passed six cases; one harness selector incorrectly assumed an exact navigation label and timed out. It now uses the existing Learning navigation link; no product change or disabled assertion was needed.

Independent Chromium visual/keyboard review inspected populated analytics at 1440px and 320px. No document overflow or runtime error occurred; cards/headings wrap, dates and exact-data tables remain readable. Route focus and visible focus outlines work. All 12 tested Tab steps remained inside the mobile drawer, Escape restored its opener, and ArrowRight scrolled a focused history table to reach offscreen columns. SVG axis labels scale small at 320px; the visible exact-value table provides a readable alternative. Screenshots were inspected during review under /tmp/devatlas-analytics-{desktop1440,mobile320,mobile-menu320,mobile-table320}.png (temporary local evidence, not repository assets). Independent review approved integration.

## Files and limits

AnalyticsPage.tsx implements the lazy route wired in App.tsx. analyticsView.ts composes/validates account-owned snapshots and reconstructs real-event completion history. analyticsView.test.ts and analytics.spec.ts add coverage. README, frontend/README, architecture and development-progress describe current behavior.

This remains an in-memory mock: accounts and events reset on reload. Backend security and persistence are later issues. Chromium viewport checks do not claim physical-device, human screen-reader or non-Chromium coverage. Issue closure follows reviewed, tested and verified merge.
