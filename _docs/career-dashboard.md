# Career selection and Dashboard — MVP-04

The UI reads only `DevAtlasService`. No fixture imports, adapter-specific calls, backend or additional dependencies are introduced. `getCareerRoadmaps` still joins global definitions/dependencies with user-specific progress; `getCareerDashboard` composes the selected-career view with analytics and recommendations.

## Selection and session lifecycle

- **Choose path** replaces the service selection with that one career.
- **Include …** checkboxes add/remove additional careers. **Clear selected paths** writes an empty list.
- **View roadmap** changes the `path` query parameter without changing saved selection. Anonymous visitors can browse all paths and sample progress, but saving requires login.
- Confirmed IDs come from `getSelectedCareers`. Writes use `setSelectedCareers`, then read selection, progress, analytics and recommendations again. Shared React context caches confirmed service responses across application routes; it is not a second mock database.
- Pending checkbox state expresses an intended write, never confirmed completion or progress. During save, dashboard totals retain their last confirmed snapshot. A successful latest write/refresh immediately publishes the new dashboard without a reload.
- Writes are serialized. Queued superseded intents are skipped; already-running writes finish before the next write begins. Revision guards prevent stale loads or earlier saves from publishing over the latest intent.
- Account changes create a fresh workspace and cancel queued intents; the service's existing session revision guards protect already-running requests. The keyed workspace stays mounted across all routes, including same-account visits to Login/Signup through browser history, so pending selection writes and refreshes survive navigation. Auth forms render as siblings outside the keyed provider so signup success/focus state is preserved when the account changes.
- Logout/login retain each account's data in the same mock instance. A full page reload resets all mock accounts, session and selection according to the existing mock lifecycle; nothing is persisted to browser storage.

## Dashboard calculations

Only selected careers contribute to the overview. Unique skill IDs form the union across paths; per-path totals come from `getAnalytics().careers`. Global analytics totals are deliberately not labelled as selected-path totals.

| Display | Definition |
| --- | --- |
| Skills in scope | Number of distinct required skill IDs across selected paths |
| Completed skills | Scoped skills with self-assessment `status === 'completed'` |
| Completion | Rounded completed / scoped unique skills × 100; zero for no skills |
| Verified skills | Scoped skills with service-derived `verified === true` |
| Skill gaps | Scoped required skills not self-reported completed |
| Next skills | Adapter-ranked recommendations for selected paths; grouped by shared skill ID with each path's reason retained |

Completion and practice-quiz verification are independent. An unfinished verified skill remains a self-assessment gap and is labelled accordingly; it is not recommended again by the mock's existing recommendation rule. Verification means an app practice quiz passed at 80%, not professional certification.

Example: Backend Developer and Data Analyst contain eight path-skill memberships but six unique skills because Python/SQL are shared. Completing SQL counts once in the overview and once in each applicable per-path summary. Completing only SQL yields 1/6 = 17% overall, not a sum/average of unrelated global percentages. No quiz scoring, prerequisite eligibility or recommendation reason is reimplemented in the UI.

## Loading and errors

Initial reads show a loading announcement. A failed read hides incomplete metrics and offers **Retry loading**. No selected path shows an invitation to choose; an empty catalogue explicitly reports no available careers. Missing adapter references/analytics are rejected rather than silently inventing metrics.

A failed write or follow-up refresh retains last confirmed data, explains that the change might already be saved, and offers **Retry selection**. Retrying rewrites the same intended ID list and reconciles through service reads. This mock implements full-set replacement, so retry is safe. Unknown/unauthorized writes are still validated by the existing service.

Development `?mockLatencyMs=1500`, `?mockScenario=empty`, and `?mockScenario=error` overrides are unchanged. Test-only service wrappers simulate individual write/read/refresh failures without adding production test hooks.

## Accessibility and scope

Shared Button/Card components, native labelled checkboxes, pressed-state buttons, live feedback and named progress bars provide semantic keyboard controls. Small screens stack career cards and roadmap skills; summary statistics use a two-column grid and expand on larger screens. Existing skip link, focus rings and mobile modal behavior remain intact.

This issue displays existing progress and recommendations. Progress editing, skill detail, quiz-taking, interactive graph and detailed analytics screens remain later issues. Changes through a future external API or another browser tab need a future refresh/subscription strategy; current UI writes always trigger a fresh confirmed view.

See [frontend commands](../frontend/README.md) and [verified QA evidence](issue-4-qa.md).
