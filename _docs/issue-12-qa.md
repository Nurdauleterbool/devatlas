# Issue #12 — Catalogue API QA

Scope: seven public read-only endpoints at `/api/v1`:
- `GET /career-paths`
- `GET /career-paths/{careerId}`
- `GET /skills`
- `GET /skills/{skillId}`
- `GET /dependencies`
- `GET /skills/{skillId}/resources`
- `GET /skills/{skillId}/practice-tasks`

The complete public skill view is assembled from the skill record, prerequisite edges and separate resources and practice endpoint responses, matching the normative OpenAPI contract without adding noncontract response properties.

## Data and architecture

The reference dataset mirrors the frontend mock fixtures exactly: three careers, ten unique skills, six prerequisite edges, ten HTTPS learning resources, ten exercises. Backend seeding uses the replaceable repository factory and does not seed any user progress. In-memory repositories preserve deterministic insertion order, and each FastAPI app instance receives its own storage. Supplied nonempty repositories are retained rather than overwritten.

Catalogue validation rejects duplicate IDs, missing path/edge/material references, cycles, unsafe material URLs and non-free resources. Unknown path/skill IDs return documented 404 NOT_FOUND JSON envelopes.

## Verification

Test code added to `backend/tests/test_catalogue.py` covers all routes, full fixture integrity, isolated application storage, injected replacement repositories, public access without an account and missing IDs. GitHub Actions workflow `backend-tests.yml` is configured to run all Python tests on backend-changing PRs and main pushes using Python 3.12.

Review the GitHub Actions run for actual verified counts before merging. If GitHub Actions are unavailable, manually run from `backend/`:

```sh
python -m pip install -e '.[test]'
python -m pytest -q
```

No SQLite or mutable business endpoint was implemented in this Issue. The frontend still uses mockService until #19. Existing auth and user boundary semantics remain unchanged.
