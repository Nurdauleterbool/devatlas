# Architecture — DevAtlas

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
