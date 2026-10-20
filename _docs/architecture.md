# Architecture — DevAtlas

## Current frontend data boundary

`frontend/src/types/domain.ts` defines shared domain models. `DevAtlasService` is the session-scoped asynchronous contract; `services/index.ts` selects the adapter. Dashboard and Career Paths share a session-scoped career workspace populated by adapter-independent roadmap/dashboard composers and never import fixture data. The mock stores shared skills/dependencies separately from per-user progress and derives verification from quiz attempts. See [mock service contract, validation and scenarios](mock-service.md). Issue #3 adds mock session operations to the same contract; `AuthProvider` manages UI session state, and both sidebar variants share account controls. Public routes show labelled sample data when anonymous, while personal writes/history/attempts/analytics require a mock session. Session revisions reject delayed requests after an account change. See [mock authentication lifecycle and limitations](mock-auth.md). Issue #4 adds service-backed career selections and a selected-path dashboard; unique skill IDs determine aggregate totals and adapter recommendations retain their authored reasons. See [career workspace lifecycle and calculations](career-dashboard.md). This frontend contract does not implement or freeze the later OpenAPI/backend stage.

Issue #5 adds a lazy-loaded React Flow graph built from the existing career workspace. A pure skillGraph transformation validates references and cycles, lays out the DAG deterministically, and derives states from current-user progress and completed/verified prerequisites. Node clicks and a native keyboard skill list open the same basic detail modal. See [graph QA evidence](issue-5-qa.md).

Issue #6 shares resource/actionable skill details between the graph modal and standalone routes. Typed composition filters unsafe material and public quiz fields. Workspace-owned progress writes serialize across route remounts; serialized refreshes reconcile Dashboard, graph and detail progress while preserving unsaved form drafts. See [skill detail QA](issue-6-qa.md).

Issue #7 adds service-graded quiz taking/results, owned attempt metadata, best-score retention and safe refresh retries. Public quiz whitelisting is shared with skill details; scoring and correct answers remain behind the service response boundary. The mock is not a production anti-cheating boundary. See [quiz QA](issue-7-qa.md).

Issue #8 adds authenticated analytics composition and chronological learning/quiz tables. Completion history replays recorded status transitions against current unique-skill progress, preserving same-time event order and existing completions; chart points use only observed timestamps. A named SVG and visible data table expose the same values. Account keys and shared-workspace invalidation prevent stale snapshots after background mutations. See [analytics QA](issue-8-qa.md).

## Modules
- React pages: Auth, Dashboard, Career Paths, Skill Graph, Skill Detail, Quiz, History/Profile.
- Typed frontend service interface: `mockService` initially, `httpService` after integration.
- FastAPI routers: auth, paths, skills, progress, quizzes, recommendations, analytics.
- Domain services: prerequisite graph validation, recommendation ranking/explanations, quiz scoring, progress aggregation.
- Repository abstraction: in-memory first, SQLAlchemy/SQLite second.

## Proposed entities
`User`, `CareerPath`, `Skill`, `PathSkill`, `SkillPrerequisite`, `UserPath`, `UserSkillProgress`, `ProgressEvent`, `Quiz`, `Question`, `AnswerOption`, `QuizAttempt`, `QuizResponse`, `LearningResource`, `PracticeTask`.

## Data ownership
All progress, quiz attempts, and path selections belong to authenticated users. Reference career paths and skills are seeded shared data.

## Security
Password hashing, authenticated endpoints, user-scoped ORM filters, validation, non-public answer keys, server-side scoring, CORS allowlist, secret config from environment.

## Design reference
Use v0 or Lovable for visual direction; design targets: professional SaaS, responsive navigation, high-contrast graph edges, accessible color+text statuses, empty/loading/error states. Do not copy competitors' UI assets.

## Open questions
Exact schema and endpoints are finalized after frontend mockService; select auth session strategy, quiz question pool, graph layout, and deployment target in tracked issues.
