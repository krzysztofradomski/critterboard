## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### 7. Living Documentation in `docs/`

- Maintain human-readable architecture docs in `docs/` as markdown files (Obsidian-friendly)
- After any non-trivial change (new feature, refactor, new module, dependency, data flow, or architectural decision): create or update the relevant `docs/*.md` file
- Write for a human reader skimming in Obsidian, not for an LLM:
  - Short paragraphs, clear headings, bullet lists
  - Diagrams in Mermaid (```mermaid fences) for flows, data models, component graphs
  - Use `[[wiki-links]]` between related docs so Obsidian's graph view connects them
  - Add `#tags` (e.g. `#architecture`, `#data-model`, `#api`) at the top for filtering
- Suggested layout (create as needed, don't pre-create empty files):
  - `docs/README.md` — index / map of contents with links to every doc
  - `docs/architecture.md` — high-level system overview + top-level diagram
  - `docs/modules/<name>.md` — one per significant module/feature
  - `docs/decisions/NNN-<slug>.md` — lightweight ADRs (context, decision, consequences)
  - `docs/data-model.md` — entities, relationships, key invariants
- Focus on the *why* and *how things connect*, not line-by-line code description (the code is the source of truth for *what*)
- When updating: edit existing docs in place rather than appending new ones; keep the index (`docs/README.md`) in sync
- Mention documentation updates in the high-level summary at each step

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections
7. **Update Docs**: Sync `docs/*.md` (and `docs/README.md` index) with any architectural changes

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
