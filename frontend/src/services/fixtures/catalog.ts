import type { CareerPath, LearningResource, PracticeTask, Skill, SkillDependency, User } from '../../types/domain'

export const SEED_TIME = '2026-10-01T12:00:00.000Z'
export const DEMO_USER_ID = 'demo-student'

export const users: User[] = [
  { id: DEMO_USER_ID, displayName: 'Demo Student', email: 'student@example.test', createdAt: SEED_TIME },
  { id: 'second-student', displayName: 'Second Student', email: 'second@example.test', createdAt: SEED_TIME },
]

export const careerPaths: CareerPath[] = [
  { id: 'frontend', name: 'Frontend Developer', description: 'Build modern websites and interactive interfaces.', skillIds: ['html', 'css', 'javascript', 'react'] },
  { id: 'backend', name: 'Backend Developer', description: 'Create APIs, databases, and server applications.', skillIds: ['python', 'sql', 'fastapi', 'databases'] },
  { id: 'analyst', name: 'Data Analyst', description: 'Analyze data and discover useful insights.', skillIds: ['python', 'pandas', 'statistics', 'sql'] },
]

export const skills: Skill[] = [
  { id: 'html', name: 'HTML', description: 'Structure accessible web content with semantic elements.' },
  { id: 'css', name: 'CSS', description: 'Style responsive layouts and visible interaction states.' },
  { id: 'javascript', name: 'JavaScript', description: 'Use browser APIs, functions, and asynchronous programming.' },
  { id: 'react', name: 'React', description: 'Compose interfaces with components, props, and state.' },
  { id: 'python', name: 'Python', description: 'Write readable programs using Python data structures and functions.' },
  { id: 'sql', name: 'SQL', description: 'Read and aggregate relational data with queries.' },
  { id: 'fastapi', name: 'FastAPI', description: 'Design typed HTTP endpoints and validate requests.' },
  { id: 'databases', name: 'Databases', description: 'Model relational data, keys, indexes, and transactions.' },
  { id: 'pandas', name: 'Pandas', description: 'Clean, transform, and summarize tabular data.' },
  { id: 'statistics', name: 'Statistics', description: 'Interpret distributions, samples, and uncertainty.' },
]

export const dependencies: SkillDependency[] = [
  { skillId: 'css', prerequisiteId: 'html' },
  { skillId: 'javascript', prerequisiteId: 'html' },
  { skillId: 'react', prerequisiteId: 'javascript' },
  { skillId: 'fastapi', prerequisiteId: 'python' },
  { skillId: 'databases', prerequisiteId: 'sql' },
  { skillId: 'pandas', prerequisiteId: 'python' },
]

export const learningResources: LearningResource[] = [
  { id: 'html-mdn', skillId: 'html', title: 'MDN: Structuring content with HTML', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content', kind: 'documentation', isFree: true },
  { id: 'css-mdn', skillId: 'css', title: 'MDN: CSS styling basics', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics', kind: 'documentation', isFree: true },
  { id: 'js-mdn', skillId: 'javascript', title: 'MDN: JavaScript guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', kind: 'documentation', isFree: true },
  { id: 'react-learn', skillId: 'react', title: 'React: Learn', url: 'https://react.dev/learn', kind: 'documentation', isFree: true },
  { id: 'python-tutorial', skillId: 'python', title: 'Python tutorial', url: 'https://docs.python.org/3/tutorial/', kind: 'documentation', isFree: true },
  { id: 'sql-tutorial', skillId: 'sql', title: 'PostgreSQL: SQL tutorial', url: 'https://www.postgresql.org/docs/current/tutorial-sql.html', kind: 'documentation', isFree: true },
  { id: 'fastapi-tutorial', skillId: 'fastapi', title: 'FastAPI tutorial', url: 'https://fastapi.tiangolo.com/tutorial/', kind: 'documentation', isFree: true },
  { id: 'db-tutorial', skillId: 'databases', title: 'PostgreSQL: Advanced features', url: 'https://www.postgresql.org/docs/current/tutorial-advanced.html', kind: 'documentation', isFree: true },
  { id: 'pandas-tutorials', skillId: 'pandas', title: 'Pandas: Getting started', url: 'https://pandas.pydata.org/docs/getting_started/intro_tutorials/', kind: 'documentation', isFree: true },
  { id: 'statistics-openstax', skillId: 'statistics', title: 'OpenStax: Introductory Statistics', url: 'https://openstax.org/details/books/introductory-statistics-2e', kind: 'course', isFree: true },
]

export const practiceTasks: PracticeTask[] = [
  { id: 'html-profile', skillId: 'html', title: 'Semantic profile', description: 'Build a profile page with headings, landmarks, links, and a labelled form.' },
  { id: 'css-layout', skillId: 'css', title: 'Responsive cards', description: 'Create a card grid that fits mobile and desktop and has visible focus states.' },
  { id: 'js-fetch', skillId: 'javascript', title: 'Async list', description: 'Render a list from a Promise with loading, empty, and error states.' },
  { id: 'react-state', skillId: 'react', title: 'Stateful selector', description: 'Build a reusable selection component controlled with props and state.' },
  { id: 'python-counts', skillId: 'python', title: 'Word counts', description: 'Count word occurrences with a dictionary and test an empty input.' },
  { id: 'sql-report', skillId: 'sql', title: 'Aggregate report', description: 'Write a SELECT query with a JOIN and GROUP BY against a sample schema.' },
  { id: 'fastapi-validation', skillId: 'fastapi', title: 'Typed endpoint exercise', description: 'Sketch a validated request/response contract for a skill endpoint.' },
  { id: 'db-schema', skillId: 'databases', title: 'Learning schema', description: 'Draw tables with primary and foreign keys for users and their progress.' },
  { id: 'pandas-clean', skillId: 'pandas', title: 'Clean a CSV', description: 'Load a small table, handle missing values, and group rows by category.' },
  { id: 'stats-summary', skillId: 'statistics', title: 'Summarize a sample', description: 'Compare the mean and median of a sample containing an outlier.' },
]
