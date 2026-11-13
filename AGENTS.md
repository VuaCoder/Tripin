# AI Agent Workspace Rules

## Git Commit & Push Policy (CRITICAL)

1. **NEVER Commit or Push Automatically**:
   - Do **NOT** run `git commit`, `git push`, or `git commit --amend` automatically after completing code changes, fixing bugs, or running tests.
   - Leave changes in the working tree / index so the user can review them first.

2. **Explicit Per-Turn Instruction Required**:
   - **ONLY** execute `git commit` (or `git push`) when the user explicitly commands you to commit in the **current message/turn**.
   - A request to commit in a previous turn applies **strictly to that single turn only**. Never carry over a "commit when done" instruction to subsequent turns or follow-up fixes.
   - Avoid creating unnecessary or repetitive commits across iterations.

