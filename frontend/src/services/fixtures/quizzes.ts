import type { Quiz } from '../../types/domain'
import { skills } from './catalog'

export interface QuizAnswerKey {
  correctOptionId: string
  explanation: string
}

// Authoring format: prompt, correct answer, three distractors, explanation.
type QuestionSeed = [string, string, string, string, string, string]

const questionSeeds: Record<string, QuestionSeed[]> = {
  html: [
    ['Which element represents the primary page content?', '<main>', '<span>', '<style>', '<meta>', 'The main element identifies the dominant content of the document.'],
    ['How is a visible label associated with an input?', 'Matching label for and input id', 'Matching CSS classes', 'A placeholder alone', 'A title on the form', 'A label uses for to reference the input id.'],
    ['What should an informative image have?', 'Meaningful alternative text', 'An empty file name', 'A nested heading', 'Only a background color', 'Alternative text communicates the meaning when the image cannot be seen.'],
    ['Which element provides native navigation to a URL?', '<a href="...">', '<div onclick="...">', '<b>', '<section>', 'An anchor with href provides native link semantics and keyboard behavior.'],
    ['Which attribute marks a mandatory form field?', 'required', 'mandatory', 'checked', 'selected', 'The required attribute enables native required-field validation.'],
  ],
  css: [
    ['Which layout system handles rows and columns?', 'CSS Grid', 'text-decoration', 'z-index', 'font-style', 'Grid is a two-dimensional layout system.'],
    ['What does box-sizing: border-box include in width?', 'Content, padding, and border', 'Only content', 'Only margin', 'Only border', 'Border-box includes content, padding, and border, but not margin.'],
    ['Which feature applies styles at different viewport widths?', 'A media query', 'A comment', 'A custom font name', 'An HTML entity', 'Media queries conditionally apply styles, including viewport-width conditions.'],
    ['Which selector helps show keyboard focus?', ':focus-visible', ':first-line', '::marker', ':empty', 'Focus-visible indicates when the browser determines focus should be visibly shown.'],
    ['How should reduced-motion preferences be detected?', 'prefers-reduced-motion', 'prefers-small-text', 'animation: required', 'hover: disabled', 'The prefers-reduced-motion media feature exposes the user preference.'],
  ],
  javascript: [
    ['What does an async function return?', 'A Promise', 'Always a string', 'Only undefined', 'An HTML element', 'Async functions return Promises, including when returning a plain value.'],
    ['Which operation creates a new array of transformed values?', 'map', 'push', 'pop', 'shift', 'Map produces a new array by applying a callback to each element.'],
    ['Which equality operator avoids type coercion?', '===', '==', '=', '+=', 'Strict equality compares without converting operand types.'],
    ['How can a rejected awaited Promise be handled?', 'try/catch', 'Only a CSS rule', 'A typeof check alone', 'A const declaration', 'An awaited rejection throws and can be handled with try/catch.'],
    ['Which declaration is block scoped and can be reassigned?', 'let', 'const', 'import', 'export', 'Let declares a block-scoped binding that can be reassigned.'],
  ],
  react: [
    ['What should identify a rendered list item?', 'A stable key from the data', 'A new random number on each render', 'Its text color', 'The browser window width', 'Stable keys let React match items across renders.'],
    ['How should component state be updated?', 'Through its state setter', 'By mutating props', 'By changing a local variable only', 'By editing a DOM attribute directly', 'State setters schedule renders with the new state.'],
    ['What are props?', 'Inputs passed to a component', 'Only CSS properties', 'Global mutable variables', 'Database indexes', 'Props carry data and callbacks from the parent to a component.'],
    ['Where must Hooks normally be called?', 'At the top level of components or custom Hooks', 'Inside arbitrary loops', 'Only in event callbacks', 'Inside every conditional branch', 'Top-level Hook calls preserve their ordering across renders.'],
    ['What does an Effect cleanup function do?', 'Releases resources when an Effect is replaced or unmounted', 'Deletes the component source file', 'Makes props mutable', 'Prevents every render', 'Cleanup removes subscriptions and other resources created by an Effect.'],
  ],
  python: [
    ['Which collection maps keys to values?', 'dict', 'list', 'tuple', 'range', 'A dictionary stores key-value associations.'],
    ['What defines a function?', 'def', 'class', 'import', 'with', 'The def statement defines a function.'],
    ['Which structure is immutable?', 'tuple', 'list', 'dict', 'set', 'A tuple cannot have its entries reassigned after creation.'],
    ['How is a specific exception handled?', 'except ExceptionType', 'finally ExceptionType', 'return ExceptionType', 'import ExceptionType', 'An except clause handles matching exceptions from a try block.'],
    ['What does len([2, 4, 6]) return?', '3', '6', '12', '2', 'Len returns the number of elements.'],
  ],
  sql: [
    ['Which clause filters rows before grouping?', 'WHERE', 'ORDER BY', 'HAVING', 'LIMIT', 'Where filters rows before aggregate grouping.'],
    ['Which join returns matching rows from both tables?', 'INNER JOIN', 'CROSS JOIN', 'FULL OUTER JOIN', 'UNION', 'An inner join keeps rows for which the join condition matches.'],
    ['Which aggregate counts rows?', 'COUNT(*)', 'SUM(*)', 'SORT(*)', 'GROUP(*)', 'Count star counts rows, including rows containing null column values.'],
    ['How do you test for a missing SQL value?', 'IS NULL', '= NULL', '== NULL', 'LIKE NULL', 'Null comparisons use IS NULL rather than ordinary equality.'],
    ['Which clause filters aggregate groups?', 'HAVING', 'WHERE', 'FROM', 'OFFSET', 'Having filters groups after aggregation.'],
  ],
  fastapi: [
    ['What describes the expected shape of request data?', 'A typed validation model', 'A CSS selector', 'A PNG image', 'An HTML comment', 'Typed validation models describe and validate request data.'],
    ['Which HTTP method is normally used to retrieve a resource?', 'GET', 'DELETE', 'PATCH', 'POST', 'Get requests retrieve a resource without intending to mutate it.'],
    ['Which status code represents a missing resource?', '404', '200', '201', '204', '404 Not Found indicates that the requested resource was not found.'],
    ['What does dependency injection help manage?', 'Reusable request dependencies', 'CSS animation frames', 'Only file names', 'Browser font rendering', 'Dependencies can provide common request resources and checks.'],
    ['Why use a response model?', 'To define and filter the returned data shape', 'To skip all request validation', 'To store passwords in plain text', 'To disable HTTP status codes', 'A response model documents and constrains the response data.'],
  ],
  databases: [
    ['What uniquely identifies a row?', 'A primary key', 'Any nullable column', 'A table caption', 'A duplicate display name', 'A primary key uniquely identifies each row.'],
    ['What enforces a reference to another table?', 'A foreign key', 'A CSS class', 'A comment', 'A column alias', 'Foreign keys constrain references to valid related rows.'],
    ['What groups changes into an atomic unit?', 'A transaction', 'A view name', 'A sort order', 'A column label', 'Transactions allow related changes to commit together or roll back.'],
    ['What can improve lookup speed at a write/storage cost?', 'An index', 'A longer table name', 'Removing all keys', 'Duplicating every row', 'Indexes accelerate suitable lookups but require maintenance and storage.'],
    ['What is one goal of normalization?', 'Reduce redundant data and update anomalies', 'Store every value in one text field', 'Eliminate every relationship', 'Prevent all SELECT queries', 'Normalization organizes related data to reduce duplication and anomalies.'],
  ],
  pandas: [
    ['Which object represents a two-dimensional table?', 'DataFrame', 'Series only', 'A scalar', 'A Python exception', 'A DataFrame contains rows and labelled columns.'],
    ['Which function loads CSV data?', 'read_csv', 'to_json', 'sort_values', 'dropna', 'Read_csv parses a CSV file into a DataFrame.'],
    ['Which method detects missing values?', 'isna', 'astype', 'merge', 'rename', 'Isna identifies missing values.'],
    ['Which operation groups rows for aggregation?', 'groupby', 'head', 'tail', 'reset_index', 'Groupby splits rows into groups for aggregation and related operations.'],
    ['Which method joins tables by matching keys?', 'merge', 'describe', 'fillna', 'drop_duplicates', 'Merge combines tables using common keys or indexes.'],
  ],
  statistics: [
    ['Which summary is less affected by an extreme outlier?', 'Median', 'Arithmetic mean', 'Maximum', 'Range', 'The median depends on order rather than the magnitude of extreme observations.'],
    ['What does standard deviation measure?', 'Spread around the mean', 'Only the sample size', 'A variable name', 'The most common label', 'Standard deviation measures dispersion in the original units.'],
    ['Does correlation alone establish causation?', 'No', 'Always', 'Only when it is positive', 'Only when it is negative', 'Association alone does not rule out confounding or reverse causation.'],
    ['What is a sample?', 'A subset of a population', 'Every possible population', 'Only the largest observation', 'A guaranteed causal effect', 'A sample is a subset used to learn about a population.'],
    ['What is the mean of 2, 4, and 6?', '4', '2', '6', '12', 'The mean is the sum, 12, divided by the count, 3.'],
  ],
}

/** Internal mock grading data. Never part of a pre-submission service response. */
export const answerKeys: Record<string, QuizAnswerKey> = {}

export const quizzes: Quiz[] = skills.map((skill) => ({
  id: `quiz-${skill.id}`,
  skillId: skill.id,
  title: `${skill.name} knowledge check`,
  passThreshold: 80,
  questions: questionSeeds[skill.id].map(([prompt, correct, ...rest], index) => {
    const [wrongOne, wrongTwo, wrongThree, explanation] = rest
    const id = `${skill.id}-q${index + 1}`
    const correctIndex = [1, 3, 0, 2, 1][index]
    const texts = [wrongOne, wrongTwo, wrongThree]
    texts.splice(correctIndex, 0, correct)
    const options = texts.map((text, optionIndex) => ({ id: `${id}-o${optionIndex + 1}`, text }))
    answerKeys[id] = { correctOptionId: options[correctIndex].id, explanation }
    return { id, prompt, options }
  }),
}))
