# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Karpathy Skills — Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Bias toward caution over speed; use judgment for trivial tasks.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused, but not pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Collaboration Principles

Optimised for: clear plans, verified work, and reusable artefacts the team can adopt. Prefer a strong plan over shipping something that needs reverting.

### Confidence levels
Always name confidence on non-trivial claims or analyses:
- **High** — verified, tested, or directly read from source
- **Medium** — reasoned but not fully verified; most ad-hoc analyses land here
- **Early signal** — hypothesis, pattern-match, or incomplete data

### Default workflow

Treat Claude Code as an orchestration system, not a chat window.

1. **Plan first.** For anything more than three steps or one architectural decision, enter plan mode (Shift+Tab twice) and share the plan before executing. If the plan goes sideways mid-work, stop and re-plan rather than pushing through.
2. **Use subagents.** Offload research, exploration, and parallel analysis to subagents. Keep the main context clean.
3. **Verify before "done".** Run the test, check the freshness, diff against main, eyeball the rendered output — whatever proves it works. Never claim completion without proof.
4. **Capture lessons.** When corrected, the correction is a rule for next time. Update the relevant `lessons.md` (project-level if project-specific, auto-memory if it's about preferences).
5. **Demand elegance.** For non-trivial changes, pause and ask "is there a more elegant way?" before committing.
