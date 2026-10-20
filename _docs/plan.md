# DevAtlas — Product Plan (Brainstorm v1)

## Product vision
DevAtlas is an interactive IT career and skill gap analyzer for IT and Software Engineering students who know programming basics but need guidance on what to learn next.

## Target users
IT students (primary MVP audience).

## Problem
Students know individual technologies but struggle to identify missing skills and a sensible order for learning toward a career.

## MVP career paths
- Frontend Developer
- Backend Developer
- Data Analyst

## Core MVP features
1. Email/password signup and login, with secure password hashing.
2. Per-user selection of career paths and saved progress in SQLite via an ORM.
3. Self-assessment statuses: Not Started, Learning, Completed.
4. Knowledge quizzes with 5–10 multiple-choice questions, four answers per question, score and explanations.
5. Verification threshold: at least 80%; unlimited retakes; store all attempts and the best score. Verified means passed the app's quiz, not professional certification.
6. Interactive skill dependency graph with color-coded statuses, locked skills, and next-skill recommendations.
7. Skill detail pages: description, prerequisites, free learning resources, example practical task, quiz entry point.
8. Smart career dashboard: progress by career path, skill gap analysis, next recommendations, quiz statistics, learning history, charts.
9. Explainable deterministic recommendations based on prerequisites, chosen career path, progress and quiz results.
10. Dated skill-status change history, progress chart and quiz attempt history.

## Outside MVP (post-mvp)
- AI chat and AI-generated materials
- GitHub profile analysis
- Google/GitHub OAuth
- User-created career maps
- Social features and leaderboards
- Native Android/iOS applications (responsive web remains in MVP)
- Paid subscriptions and monetization

## Required development workflow (Part II)
1. Frontend with mockService
2. openapi.yml API contract
3. Backend with in-memory storage
4. Backend with SQLite persistence via DBMS-agnostic ORM
5. Connect frontend and backend
6. Run and thoroughly test; create GitHub issues for bugs with `user-test-bug`; PM and QA update requirements and test cases
7. QA closes all `mvp` and `user-test-bug` issues before deadline

## Historical stack alternatives (decision resolved below)
A. React + TypeScript + Tailwind + React Flow; FastAPI + SQLAlchemy + SQLite; Vitest, Pytest, Playwright.
B. React + TypeScript + Tailwind + React Flow; Express + Prisma + SQLite; Vitest, Supertest, Playwright.
C. React + TypeScript + Tailwind; Django REST Framework + Django ORM + SQLite; Django tests, Vitest, Playwright.

## Historical open decisions — implementation status
- Technology stack: **resolved** (React, FastAPI, SQLAlchemy, SQLite, Alembic).
- Skill taxonomy and quiz bank: **resolved for MVP** (3 careers, 10 skills, 10 quizzes, 5 questions each).
- API resources and security: **documented** in `_docs/openapi.yml` and `_docs/api-contract.md`.
- Visual direction: existing responsive navy/indigo interface implemented; hosting/deployment outside local-MVP scope.

## Approved technology stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, React Flow.
- Backend: Python, FastAPI.
- Database: SQLite via SQLAlchemy ORM, with migrations using Alembic.
- Tests: Vitest, Pytest, Playwright.
- API-first contract: `_docs/openapi.yml` created after frontend mockService.

## Delivery sequence
1. Frontend against typed mockService with realistic sample data.
2. Freeze initial OpenAPI contract reflecting frontend needs.
3. FastAPI implementation with in-memory repository.
4. SQLite-backed SQLAlchemy repository with migrations.
5. Connect frontend to HTTP API; integration and E2E tests.
6. Manual user testing, bug issues, regression checks, QA closure.

## Implemented business rules
- Quiz pass: correct / total >= 0.8, computed server-side.
- `verified` is independent of self-reported `completed`.
- Skill prerequisites form an acyclic directed graph, validated on seed/import.
- Recommendation candidates have prerequisites completed or verified; explain score and unmet dependencies.
- Progress history is append-only for changes; timestamps stored in UTC.
- Never expose correct quiz answers before submitting an attempt.

## Acceptance outcomes
- A new user can register, log in, select a path, explore skills, record progress, take a quiz, and see updated dashboard and recommendations after refresh.
- Data persists across server restarts. Users cannot access each other's progress.
- All MVP and user-test-bug issues pass QA and are closed before deadline.


## Implementation status — 2026-10-20

MVP features from Issues #1–#20 are merged and automatically checked, including persistent SQLite and credentialed React HTTP integration. Issue #21 contains a human desktop/mobile checklist and accessibility smoke tests; browser automation is merged but manual results/signoff are still required. Issue #22 updates reproducible setup, architecture, process, demo and submission checklist. This plan is a design record, not a claim that UAT or final submission has already passed.

Local walkthrough, commands and current limitations: [root README](../README.md); architecture: [architecture.md](architecture.md); manual acceptance: [issue-21-manual-uat.md](issue-21-manual-uat.md); submission gate: [issue-22-submission.md](issue-22-submission.md).
