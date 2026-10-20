# Frontend mock service contract

Issue #2 implements the mock-frontend stage. It introduces no HTTP server, OpenAPI contract, authentication flow or database.

## Modules and replacement boundary

- `frontend/src/types/domain.ts`: users, career paths, shared skills/dependencies, user selections, progress/history, learning resources, practical tasks, public quizzes, responses/results/attempts, analytics and recommendations.
- `frontend/src/services/DevAtlasService.ts`: the Promise-returning interface and `ServiceError` codes (`VALIDATION`, `NOT_FOUND`, `UNAVAILABLE`).
- `frontend/src/services/index.ts`: the single application binding, `service: DevAtlasService`. A future HTTP implementation replaces this binding and implements the same interface.
- `frontend/src/services/mockService.ts`: `createMockService(options)` creates an isolated, session-scoped, mutable in-memory adapter.
- `frontend/src/services/fixtures/`: normalized deterministic catalogue and user data, internal grading keys, and fixture validation.
- `frontend/src/services/careerRoadmaps.ts`: composes catalogue, dependencies and progress through the interface. `useCareerRoadmaps` supplies this view to the existing Dashboard and Career Paths page. Pages do not import fixtures or the mock implementation.

No adapter should add user learning status to a shared `Skill`. Careers contain ordered `skillIds`; shared prerequisites are separate `SkillDependency` edges. `UserSkillProgress` contains a user's status plus derived verification and best score. A composed `RoadmapSkill` exposes `progress` and human-readable prerequisite definitions without changing these normalized models.

## Service methods

All methods return Promises. The mock copies input before asynchronous latency and returns defensive copies, so callers cannot alter pending requests or stored state. Read and write operations use the instance's current user; pages do not supply an owner ID.

| Method | Behavior |
| --- | --- |
| `getCurrentUser()` | Read the bound demo user; no passwords or credentials are modeled |
| `getCareerPaths()`, `getCareerPath(id)` | Read career definitions; a missing single career returns `undefined` |
| `getSkills()`, `getSkill(id)` | Read shared skill definitions; a missing single skill returns `undefined` |
| `getDependencies()` | Read shared prerequisite edges |
| `getLearningResources(skillId)`, `getPracticeTasks(skillId)` | Read material for a known skill |
| `getSelectedCareers()`, `setSelectedCareers(careerIds)` | Read/replace this user's path selections; an empty list clears them |
| `getProgress()`, `updateProgress({ skillId, status })` | Read all catalogue skills with user progress, or update one self-assessment status |
| `getProgressHistory()` | Read this user's dated status-change events |
| `getQuizForSkill(skillId)` | Read questions/options without keys/explanations; returns `undefined` if a known skill has no quiz |
| `submitQuizAttempt({ quizId, responses })` | Validate and grade answers; return the stored attempt plus feedback/explanations |
| `getQuizAttempts(quizId?)` | Read all this user's attempts or filter by an existing quiz |
| `getAnalytics()` | Derive unique-skill counts, per-career completion/verification, quiz statistics and status history |
| `getRecommendations(careerId)` | Derive eligible next skills with deterministic rank and explanation |

Malformed IDs/payloads raise `VALIDATION`. Material/progress/quiz/recommendation requests that reference unknown entities raise `NOT_FOUND`; single career/skill lookup uses the optional result described above. Mutations validate the complete request before changing state. Unsupported properties such as a forged `userId`, `verified` or `score` are rejected.

## Seed data and lifecycle

The seed contains three careers with four skills each, **10 unique skills** in total. Python and SQL are shared by Backend Developer and Data Analyst. Every skill has a description, free HTTPS learning resource, practical task, and one quiz with five questions and four options per question. Dependencies form an acyclic graph and are complete inside each career.

`demo-student` has HTML completed, CSS and Python learning, and other skills not started. A seeded HTML attempt scores 60%, so self-reported completion does not imply quiz verification. This preserves the existing Frontend 25%, Backend 0%, Data Analyst 0% completion displays. A second sample user has separate SQL progress and an 80% SQL attempt for ownership/analytics isolation checks. Both use reserved `.test` email addresses.

Fixture validation checks IDs, references, dependency cycles, quiz structure/keys, attempt scores, progress/history consistency, selections, HTTPS resources and canonical UTC timestamps. Factories clone supplied fixtures; different instances never share mutable state. The application's singleton retains mutations across route navigation, while a full page reload/new factory resets them. No browser storage or database is used.

## Progress, quiz and recommendation rules

Valid self-assessment values are `not_started`, `learning`, `completed`. All transitions are allowed because a student can report existing knowledge; prerequisites determine recommendations, not whether someone can self-assess a skill. Actual status changes append a timestamped history event. Setting the current status again does not create an event.

Verification is derived from a passed quiz attempt and is independent of self-assessment. `bestQuizScore` is the maximum across retained attempts, or `null` without attempts. Resetting a status or failing a later retake does not erase verification or a previous best score. `updatedAt` reflects the latest status/attempt timestamp.

Submissions must contain exactly one valid response per question, with unique question IDs and option IDs belonging to those questions. The service computes scores; it rejects partial, duplicate, foreign or forged submissions without writing an attempt. Passing requires at least 80% correct. Every valid retake is stored, including failures. Explanations and correct option IDs appear in the submission result, never in `getQuizForSkill()`.

This is a client-side mock: grading keys necessarily exist in the downloadable JavaScript. A future backend must grade quizzes and protect answer keys server-side. The service response boundary is tested here; the mock provides no authentication or anti-cheating guarantee.

Recommendations exclude completed or verified skills and require every direct prerequisite to be completed or verified. Eligible skills already marked learning come first; authored career order breaks ties. Rank starts at 1 and explanations identify satisfied prerequisites or the absence of prerequisites. No random or AI ranking is used.

Analytics counts each shared skill once globally and includes it in each relevant career. Completion percentages use self-assessment; verification has a separate count. Quiz averages are rounded percentages, and absent best/average scores are `null`. Empty data produces zero counts and no divide-by-zero values.

## Scenarios and testing

```ts
import { createMockService } from './services/mockService'

const mock = createMockService({
  latencyMs: 500,
  failMethods: ['submitQuizAttempt'],
  // Optional: userId, fixtures, now: () => new Date('2026-10-20T12:00:00.000Z')
})
await mock.updateProgress({ skillId: 'python', status: 'learning' })
```

`scenario` is `success` (default), `empty` or `error`. Loading is modeled with a finite nonnegative `latencyMs` (default 0); methods remain asynchronous even at zero added latency. `error` rejects every operation after latency with `UNAVAILABLE`. `failMethods` can instead fail selected methods while others continue to work. `empty` retains the current user but clears catalogue/progress/attempts/selections, yielding coherent empty reads and zero analytics; writes to absent skills/quizzes are rejected. These options are fixed per instance; create a new instance to reset or change them. `now` defaults to the real clock and can be injected for deterministic mutation timestamps. No random IDs or dates are used in seed fixtures.

The composition root reads `VITE_MOCK_SCENARIO` and `VITE_MOCK_LATENCY_MS`. In development only, query parameters override them on full page load:

```text
/?mockScenario=empty
/careers?mockScenario=error
/?mockLatencyMs=1500
```

Production ignores query overrides. Unknown scenarios, empty/negative/nonfinite latency settings, invalid fixtures or an unknown mock user are rejected at construction.

Run from `frontend`:

```sh
npm ci
npm run build
npm run lint
npm run test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test
```

Use `npx playwright install chromium` and omit the executable override when using Playwright's browser. Vitest uses Node, fake timers for latency, fresh service instances for state isolation, and no extra DOM environment dependency. The browser suite exercises the actual configured mock scenarios and retains the existing route, accessibility, selection and component checks. Exact execution results and limitations are recorded in [Issue #2 QA evidence](issue-2-qa.md).
