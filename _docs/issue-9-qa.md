# Issue #9 — OpenAPI contract QA

Date: 2026-10-20. Contract stage. Branch feat/issue-9-openapi-contract starts from fetched main after verified Issue #8 merge bb626f2. Actual issue criteria and all frontend service methods/types/composers were inspected before writing the contract. No backend or HTTP adapter is implemented in this issue.

## Acceptance evidence

The normative _docs/openapi.yml is OpenAPI 3.1 and defines 22 paths, 23 operations and 30 reusable domain/request/error/readiness schemas. All 22 live DevAtlasService methods map exactly once to operation metadata. The remaining logInDemo method is explicitly mock-only, has no production endpoint and will be hidden/rejected in live mode. GET /health is an infrastructure operation with no frontend method. The accompanying api-contract.md maps every interface method and documents dashboard composition from selections, catalogue, progress, analytics and recommendations.

Requests/responses include typed examples and standard error responses. Strict JSON request objects reject unexpected owner, grade and timestamp properties. Cookie session ownership, expiry/revocation, Origin/Fetch Metadata checks, credentialed CORS, public synthetic preview behavior and production cookie flags are specified. Public Quiz/QuizQuestion/QuizOption schemas exclude answer keys and explanations. Server scoring, retained attempts, stable chronological ties, independent verification and unique-skill counts preserve existing frontend semantics. Optional lookups and no-quiz responses have explicit adapter behavior.

## Executed verification

Python 3.12.14, isolated /workspace/.venvs/devatlas-contract. Direct tooling pins: openapi-spec-validator 0.9.0, PyYAML 6.0.3, jsonschema[format] 4.26.0.

| Command/check | Actual result |
| --- | --- |
| python -m pip install -r _docs/requirements-contract.txt | Dependencies installed into the isolated environment; exact direct versions confirmed |
| python scripts/validate_openapi.py | PASS, exit 0; 23 operations, 228 schemas/subschemas, 132 examples |
| python -m pip check | PASS, exit 0; no broken requirements |
| git diff --check | PASS, exit 0 |

The validator checks OpenAPI structure, JSON Schema constraints/formats, concrete examples, local references, duplicate YAML keys, exact service coverage, unique operation IDs, private-route cookie security and recursive public-quiz grading exclusion. Four independent in-memory negative smoke checks were actually executed: missing service mapping, invalid schema example, nested public quiz grading leakage and removed private-route security were each rejected. The first full run exposed an overly strict validator rule for health's empty method mapping; it was corrected only for that specific infrastructure operation, preserving normal method coverage.

The frontend implementation/dependencies are unchanged from verified #8: its latest executed build/lint, 232 unit tests and 66 browser tests passed there. No new frontend or future backend execution is claimed by this contract-only change. Backend contract conformance is tested in subsequent issues once routes exist.

## Limits and integration

The contract specifies target behavior; generated FastAPI documentation must continue to describe only routes actually implemented at each backend stage. Cookies/auth, server grading and SQL persistence are requirements here, not implemented features. Independent review reran the complete validator successfully and approved interface coverage, payload/error semantics, ownership, synthetic preview and public quiz safety without blocking findings. The future session-kind/error-union changes are explicitly assigned to #19. Ready for integration; QA closes only after the exact reviewed head is verified in main.
