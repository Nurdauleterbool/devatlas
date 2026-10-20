# Architecture — DevAtlas

## Current frontend data boundary

`frontend/src/types/domain.ts` defines shared domain models. `DevAtlasService` is the session-scoped asynchronous contract; `services/index.ts` selects the adapter. Dashboard and Career Paths use an adapter-independent roadmap composer and never import fixture data. The mock stores shared skills/dependencies separately from per-user progress and derives verification from quiz attempts. See [mock service contract, validation and scenarios](mock-service.md). This frontend contract does not implement or freeze the later OpenAPI/backend stage.

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
