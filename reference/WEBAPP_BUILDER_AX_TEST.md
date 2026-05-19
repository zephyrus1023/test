# Webapp Builder Test: AX Literacy / AX Camp Pattern

## What exists now

The folder present in the sandbox is `AX_Literacy`, not `AX_Camp`, but the internal docs clearly describe it as part of an `AX_Camp/` workspace:

- `AX_Literacy`: learner-facing portal
- `AX_Builder`: course authoring canvas
- `AX_Literacy_archive`: backup and collected assets

## Core functionality observed

From `README.md`, `PROJECT_STRUCTURE.md`, `server.js`, `public/index.html`, and `public/app.js`, the current app is a course portal with these core functions:

1. Login and signup
2. Course-aware session handling
3. Sidebar chapter navigation
4. Clip-based learning content rendering
5. Progress tracking
6. Chapter-specific AX task entry
7. Per-clip notes and Markdown preview
8. Admin visibility for user progress

This means the real product is not a single webpage. It is:

- a stable app shell
- a chapter and clip content system
- learner state around the content

## Content structure observed

The `content/axcamp` package is the important part for authoring:

- `export-report.json`: course catalog with chapter order and clip list
- `chapters/CHxx/chxx-clipyy/`
- each clip folder contains:
  - `metadata.json`
  - `content.md`
  - `content.html`
  - `content.txt`

This is effectively:

- course
- chapter
- clip
- section or block metadata inside the clip

The learner UI loads chapter and clip data, not one giant HTML file.

## AX Camp content pattern

Briefly from `axcamp`:

- CH00 sets the day narrative and urgency
- CH01 covers AI core concepts
- CH03 centers on Gemini and Gems
- CH04 covers NotebookLM
- CH05 handles Google AI Studio and setup
- CH06 moves into building apps
- CH07 moves into agentic AI
- CH09 closes with key takeaways

That matches the lecture intent: show AI acceleration, explain the tools, demonstrate business relevance, and create urgency for adoption.

## Important implementation insight

`server.js` already contains a latent builder model:

- project
- chapters
- sections
- blocks

It also contains template creation and export logic for:

- `blank`
- `workshop`
- `ax-camp`

This is the right direction for `webapp-builder` testing. The build flow should not start from raw HTML every time. It should start from a content contract.

## Recommended build approach for lecturer-driven authoring

### Layer 1: shell

Build once and keep stable:

- main layout
- top bar
- chapter navigation
- content area
- note/task/download side panels if needed
- theme tokens and shared components

### Layer 2: course manifest

Create a course manifest that defines:

- course title
- audience
- positioning statement
- chapter order
- theme
- route structure

### Layer 3: chapter manifests

Each chapter should have:

- chapter code
- title
- summary
- duration
- ordered section list

### Layer 4: section source files

Each section should be independently editable from:

- Markdown
- HTML partial
- JSON block content

This is what enables the exact workflow the lecturer wants.

## Recommended prompt workflow for webapp-builder

### Step 1: broad output

User:
`Build an executive lecture webapp about AI transformation. Make 8 chapters and a clean premium course shell.`

Expected builder behavior:

- create the shell
- create the course manifest
- scaffold the chapters
- avoid writing all detailed content yet

### Step 2: chapter structure

User:
`Build chapter 3 with five sections: Gemini overview, prompt basics, Gems, meeting analysis, and executive practice.`

Expected builder behavior:

- update only chapter 3
- create five section placeholders
- assign stable IDs and section titles

### Step 3: section content

User:
`Now build the first section. The outline is in xxx.md. Style direction should feel like samsung.com.`

Expected builder behavior:

- read `xxx.md`
- update section 1 only
- apply the style direction through tokens and components
- preserve the rest of chapter 3 structure

### Step 4: refinement

User:
`Add a comparison table and a short urgency-focused closing block to section 1.`

Expected builder behavior:

- edit only that section
- preserve global layout and chapter routing

## Recommendation for this kind of site

For this project shape, the best model is:

- learner portal stays separate
- authoring happens in a chapter-aware builder workflow
- each chapter is independently manageable
- each section is independently decoratable
- shared shell and tokens remain consistent across the full course

That is the right test target for `webapp-builder`.
