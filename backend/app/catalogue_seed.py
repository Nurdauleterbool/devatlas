"""Deterministic reference catalogue matching the frontend mock fixtures.

Public reference data is seeded into replaceable repositories per application.
User selections and learning progress are never included here.
"""
from __future__ import annotations

from collections import defaultdict
from urllib.parse import urlparse

from .repositories import RepositoryFactory

CAREERS = [
    {"id": "frontend", "name": "Frontend Developer", "description": "Build modern websites and interactive interfaces.", "skillIds": ["html", "css", "javascript", "react"]},
    {"id": "backend", "name": "Backend Developer", "description": "Create APIs, databases, and server applications.", "skillIds": ["python", "sql", "fastapi", "databases"]},
    {"id": "analyst", "name": "Data Analyst", "description": "Analyze data and discover useful insights.", "skillIds": ["python", "pandas", "statistics", "sql"]},
]

SKILLS = [
    {"id": "html", "name": "HTML", "description": "Structure accessible web content with semantic elements."},
    {"id": "css", "name": "CSS", "description": "Style responsive layouts and visible interaction states."},
    {"id": "javascript", "name": "JavaScript", "description": "Use browser APIs, functions, and asynchronous programming."},
    {"id": "react", "name": "React", "description": "Compose interfaces with components, props, and state."},
    {"id": "python", "name": "Python", "description": "Write readable programs using Python data structures and functions."},
    {"id": "sql", "name": "SQL", "description": "Read and aggregate relational data with queries."},
    {"id": "fastapi", "name": "FastAPI", "description": "Design typed HTTP endpoints and validate requests."},
    {"id": "databases", "name": "Databases", "description": "Model relational data, keys, indexes, and transactions."},
    {"id": "pandas", "name": "Pandas", "description": "Clean, transform, and summarize tabular data."},
    {"id": "statistics", "name": "Statistics", "description": "Interpret distributions, samples, and uncertainty."},
]

DEPENDENCIES = [
    {"skillId": "css", "prerequisiteId": "html"},
    {"skillId": "javascript", "prerequisiteId": "html"},
    {"skillId": "react", "prerequisiteId": "javascript"},
    {"skillId": "fastapi", "prerequisiteId": "python"},
    {"skillId": "databases", "prerequisiteId": "sql"},
    {"skillId": "pandas", "prerequisiteId": "python"},
]

RESOURCE_INFO = [
    ("html", "html-mdn", "MDN: Structuring content with HTML", "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content", "documentation"),
    ("css", "css-mdn", "MDN: CSS styling basics", "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics", "documentation"),
    ("javascript", "js-mdn", "MDN: JavaScript guide", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", "documentation"),
    ("react", "react-learn", "React: Learn", "https://react.dev/learn", "documentation"),
    ("python", "python-tutorial", "Python tutorial", "https://docs.python.org/3/tutorial/", "documentation"),
    ("sql", "sql-tutorial", "PostgreSQL: SQL tutorial", "https://www.postgresql.org/docs/current/tutorial-sql.html", "documentation"),
    ("fastapi", "fastapi-tutorial", "FastAPI tutorial", "https://fastapi.tiangolo.com/tutorial/", "documentation"),
    ("databases", "db-tutorial", "PostgreSQL: Advanced features", "https://www.postgresql.org/docs/current/tutorial-advanced.html", "documentation"),
    ("pandas", "pandas-tutorials", "Pandas: Getting started", "https://pandas.pydata.org/docs/getting_started/intro_tutorials/", "documentation"),
    ("statistics", "statistics-openstax", "OpenStax: Introductory Statistics", "https://openstax.org/details/books/introductory-statistics-2e", "course"),
]
RESOURCES = [
    {"id": item_id, "skillId": skill_id, "title": title, "url": url, "kind": kind, "isFree": True}
    for skill_id, item_id, title, url, kind in RESOURCE_INFO
]
TASK_INFO = [
    ("html", "html-profile", "Semantic profile", "Build a profile page with headings, landmarks, links, and a labelled form."),
    ("css", "css-layout", "Responsive cards", "Create a card grid that fits mobile and desktop and has visible focus states."),
    ("javascript", "js-fetch", "Async list", "Render a list from a Promise with loading, empty, and error states."),
    ("react", "react-state", "Stateful selector", "Build a reusable selection component controlled with props and state."),
    ("python", "python-counts", "Word counts", "Count word occurrences with a dictionary and test an empty input."),
    ("sql", "sql-report", "Aggregate report", "Write a SELECT query with a JOIN and GROUP BY against a sample schema."),
    ("fastapi", "fastapi-validation", "Typed endpoint exercise", "Sketch a validated request/response contract for a skill endpoint."),
    ("databases", "db-schema", "Learning schema", "Draw tables with primary and foreign keys for users and their progress."),
    ("pandas", "pandas-clean", "Clean a CSV", "Load a small table, handle missing values, and group rows by category."),
    ("statistics", "stats-summary", "Summarize a sample", "Compare the mean and median of a sample containing an outlier."),
]
TASKS = [
    {"id": item_id, "skillId": skill_id, "title": title, "description": description}
    for skill_id, item_id, title, description in TASK_INFO
]
CATALOGUE = {
    "career_paths": CAREERS,
    "skills": SKILLS,
    "dependencies": DEPENDENCIES,
    "learning_resources": RESOURCES,
    "practice_tasks": TASKS,
}

def validate_catalogue(data: dict[str, list[dict]]) -> None:
    """Reject inconsistent identifiers, missing prerequisite targets, and directed cycles."""
    required = set(CATALOGUE)
    if set(data) != required:
        raise ValueError("Catalogue collections do not match expected structure")
    identifiers: dict[str, set[str]] = {}
    for key, rows in data.items():
        ids = [row["id"] for row in rows] if key != "dependencies" else [
            f'{row["skillId"]}/{row["prerequisiteId"]}' for row in rows
        ]
        if len(ids) != len(set(ids)):
            raise ValueError(f"Duplicate catalogue IDs: {key}")
        identifiers[key] = set(ids)
    skills = identifiers["skills"]
    for path in data["career_paths"]:
        if len(set(path["skillIds"])) != len(path["skillIds"]) or not set(path["skillIds"]) <= skills:
            raise ValueError("Career references unknown or repeated skills")
    graph: dict[str, list[str]] = defaultdict(list)
    for edge in data["dependencies"]:
        child, parent = edge["skillId"], edge["prerequisiteId"]
        if child not in skills or parent not in skills or child == parent:
            raise ValueError("Invalid skill prerequisite")
        graph[child].append(parent)
    visiting: set[str] = set()
    done: set[str] = set()
    def visit(node: str) -> None:
        if node in visiting:
            raise ValueError("Cyclic skill prerequisites")
        if node in done:
            return
        visiting.add(node)
        for previous in graph[node]:
            visit(previous)
        visiting.remove(node)
        done.add(node)
    for identifier in skills:
        visit(identifier)
    for key in ("learning_resources", "practice_tasks"):
        for item in data[key]:
            if item["skillId"] not in skills:
                raise ValueError(f"Invalid skill in {key}")
    for resource in data["learning_resources"]:
        parsed = urlparse(resource["url"])
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError("Unsafe resource URL")
        if resource["isFree"] is not True:
            raise ValueError("Curated resources must be free")

def seed_catalogue(factory: RepositoryFactory) -> None:
    """Seed only empty collections; supplied storage stays the source of truth."""
    validate_catalogue(CATALOGUE)
    # Skills must exist before foreign-key-linked career memberships and edges.
    for name in ("skills", "career_paths", "dependencies", "learning_resources", "practice_tasks"):
        rows = CATALOGUE[name]
        repository = factory.create(name)
        if repository.list():
            continue
        for row in rows:
            identifier = row["id"] if name != "dependencies" else f'{row["skillId"]}:{row["prerequisiteId"]}'
            repository.put(identifier, row)
