# Issue #7 — quiz and results QA

Date: 2026-10-20, Asia/Qyzylorda. Mock frontend stage. Branch feat/issue-7-quiz-results starts from fetched main after verified Issue #6 merge 54e7ff4. Actual issue criteria, dependencies and repository/role instructions were read before implementation.

## Acceptance evidence

Each seeded skill has five questions and four labelled choices per question. Public questions are whitelisted without correct-answer metadata/explanations. Signed-in users answer all questions, submit through DevAtlasService, see the service-graded score and question explanations, and retake without losing their best score. Passing at 80% updates derived verification independently of self-assessment. No grading implementation or answer-key import was added to UI code.

Empty submission announces missing answers and focuses the first unanswered radio. Pending forms and an immediate ref guard prevent duplicate submissions. Failed submission preserves selected answers. A recorded result is saved in UI before follow-up reads, so refresh failure never hides a successful attempt. Its Retry progress refresh action performs only reads and cannot create a second attempt. Successful late submissions refresh shared progress after navigation; a reopened quiz follows its new best score. Skill/account keys and owner-validated attempt reads prevent prior-account results appearing in another view.

Missing skills/no quiz, initial read failure/retry, anonymous preview and no-attempt states are distinct. Native fieldsets/radios, visible focus, announced errors, focused result heading and retake focus support keyboard navigation. Responsive checks cover 320/375/768/1280px without overflow.

## Executed verification

From frontend, Node 24.19.0/npm 11.9.0, system Chromium 154.0.8037.57:

| Command | Actual result |
| --- | --- |
| npm run build | PASS, exit 0; TypeScript + Vite, 2,121 modules; separate 12.04kB quiz module |
| npm run lint | PASS, exit 0 |
| npm run test | 215 passed, 0 failed/skipped; 10 files; exit 0 |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- e2e/quiz.spec.ts | 8 passed, 0 failed/skipped; 14.2s; exit 0 |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e | 59 passed, 0 failed/skipped; 1.0m; exit 0 |

Fifteen new model tests cover all seeded quizzes, public-field stripping, account-owned histories, chronological ordering, malformed metrics/references, missing/empty states and real mock grading/retakes. Three correct answers out of five score 60% and fail; four score 80% and pass; a later zero-score attempt retains best 80% and verification. Exact 79% is unrepresentable with 5–10 equally weighted questions, so no fabricated 79% run is claimed.

Eight browser cases verify choices/no pre-submission explanations, unanswered focus, scores 0/60/80/100, explanations, best-score preservation, retryable write failures, recorded-result refresh failures with exactly one submission, anonymous restrictions, pending duplicate/navigation behavior and responsive layouts. All 51 earlier browser tests remain enabled and pass.

Independent review approved the implementation without blocking findings. An additional Chromium keyboard session exercised empty submission, Space selection, submission/result focus, all feedback and retake/reset focus without runtime errors. No product defect remained after implementation; initial guessed test quiz IDs and an ad-hoc whitespace comparison were corrected in test harnesses rather than weakening assertions. No tests were disabled.

## Files and limits

QuizPage.tsx implements the lazy route wired in App.tsx. quizView.ts composes/validates public questions and owned history; skillDetails.ts exports its existing public-quiz sanitizer for reuse. quizView.test.ts and quiz.spec.ts add coverage. README, frontend/README, architecture and development-progress describe current behavior.

This remains a frontend mock: grading keys exist in the downloadable mock implementation, and accounts/progress/attempts reset on reload. The service boundary hides keys before submission; production server-side grading is assigned to #14 and HTTP integration to #19. No backend security/persistence is claimed. Human screen-reader/non-Chromium/device checks remain unrun. **Ready for review/integration**; closure follows verified merge.
