---
name: start-build
description: Bootstrap a new session with project context, codebase health check, and issue recommendations. Use at the start of any coding session, or when you need to pick what to work on next.
---

# Session Bootstrap Skill

This skill runs in two phases: a quick briefing, then deep context loading for the chosen task.

## Phase 1: Quick Briefing

Run ALL of the following commands in parallel using Bash tool calls:

1. `gh issue list --state open --limit 20` — open issues
2. `gh issue list --state closed --limit 5` — recently closed (momentum context)
3. `git log --oneline -10` — recent commits
4. `npm run build 2>&1 | tail -20` — build health (errors only)
5. `npm run lint 2>&1 | tail -20` — lint health (warnings/errors only)
6. Read the auto-memory file at the path matching `.claude/projects/*/memory/MEMORY.md` if it exists (use Glob to find exact path, then Read)

### Synthesize a compact dashboard

Present the results as a tight status briefing. Format:

```
## Session Briefing

**Open Issues (N):**
- #X Title
- #Y Title
...

**Recently Closed:**
- #A Title
- #B Title

**Last Commits:**
- abc1234 commit message
- def5678 commit message

**Build:** PASS | FAIL (N errors)
**Lint:** PASS | WARN (N warnings) | FAIL (N errors)

**Recommendation:** Tackle #X — [brief reasoning: priority, dependencies, severity, logical next step based on recent work]
```

### Rules for Phase 1
- Never dump raw command output — always summarize
- Keep total output under 500 tokens
- If there are no open issues: present the status dashboard, then ask "What should we work on today?"
- Base the recommendation on: issue labels/priority, dependency order, severity, and what was recently worked on

## Phase 2: Deep Context Load

After the user confirms an issue or describes a new task:

### For a GitHub issue:
1. Run `gh issue view #N` to read the full issue body
2. Identify file paths mentioned in the issue body
3. Read those source files (only the relevant ones — do not bulk-read the entire codebase)
4. Check `docs/plans/` for any referenced design docs (read if they exist)
5. Present a focused summary:
   - What the issue requires (acceptance criteria)
   - Key files to modify
   - Relevant patterns from the codebase
   - Suggested approach

### For a new task (no issue):
1. Ask the user to describe what they want to build or fix
2. Explore relevant code areas based on their description
3. Present the same focused summary as above

### Rules for Phase 2
- Only read files directly relevant to the chosen task
- Use `gh issue list` (compact) in Phase 1, `gh issue view` (full) only in Phase 2
- Truncate build/lint output to just errors and warnings — never show full logs
- If the issue references other issues, note the dependencies but don't deep-load them
