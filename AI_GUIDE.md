# AI Assistant Guide — Mission Control

This guide explains how the AI assistant should interact with this repository to avoid out-of-memory crashes and maintain efficiency.

## Core Principles

### 1. Search before opening files

- Use semantic search to locate relevant code before opening files.
- Do not open files speculatively; only open files that are directly needed for the current task.

### 2. Only load relevant files

- Open at most a few files per reasoning step.
- Prefer reading specific line ranges when a file is large.
- Avoid loading entire directories or the full repository.

### 3. Avoid scanning the entire repository

- Use targeted searches (grep, semantic search) instead of broad exploration.
- Limit exploration to files directly connected to the problem.
- Work with small file sets.

### 4. Ignore dependency and generated directories

The following should never be indexed or loaded:

- `node_modules` — npm dependencies
- `dist` / `build` — build outputs
- `coverage` — test coverage reports
- `.git` — version control data
- `.firebase` — Firebase cache
- `*.log` — log files
- `*.map` — source maps

### 5. Prefer minimal changes

- Make targeted edits rather than large refactors.
- Reduce memory usage by limiting the scope of changes.
- Avoid unnecessary file reads or writes.

## Project Structure (relevant paths)

- `src/` — application source code
- `src/views/` — main view components
- `src/components/` — reusable components
- `src/hooks/` — custom React hooks
- `src/strings.js` — UI strings
- `src/constants.js` — static configuration
- `src/utils.js` — utility functions
