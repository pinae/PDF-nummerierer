# CLAUDE.md

Follow `AGENTS.md` (agent working rules, TDD policy, commands, conventions)
and `docs/PLANNING.md` (architecture, data model, security model, UX design,
work packages). Both are binding for all work in this repository.

Quick reminders:
- Tests first, always (red → green → refactor). Never skip/delete tests to get green.
- `backend/stamping/` stays pure Python — no Django imports there.
- Frontend uses yarn 4 (corepack), never npm/pnpm.
- Coordinates: PDF points from the bottom-left of the page as displayed (crop box after /Rotate), end to end.
- Never weaken the session-binding/CSRF/deletion security invariants listed in AGENTS.md.
