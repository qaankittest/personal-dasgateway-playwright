# CLAUDE.md — DasGateway E2E (`das-gateway-e2e`)

This repo is a **Playwright + JavaScript (ESM)** end-to-end suite for the
**Payment Options / DasGateway** internal admin portal. It contains *only* the
tests — not the app under test.

## Read this first

**All conventions live in [`skills/SKILL.md`](skills/SKILL.md)** (skill name:
`das-gateway-e2e`) — stack, layout, npm scripts, `.env` keys, the
browser-debug-first authoring workflow, locator strategy, waiting rules, POM and
spec conventions, `das-form` custom controls, fixtures/test data, config
rationale, gotchas, anti-patterns and the pre-commit checklist.

Read the matching sub-skill **before** writing that kind of code:

| Task | Read |
|---|---|
| `expect()` checks, flaky verifications | `skills/references/assertions.md` |
| `test.extend`, auth state, setup/teardown | `skills/references/fixtures.md` |
| Page classes and locators | `skills/references/page-objects.md` |
| Test data, unique records, cleanup | `skills/references/data-factory.md` |
| Anything else | `skills/SKILL.md` |

`skills/SKILL.md` is the single source of truth. Do not duplicate its rules here —
update the skill instead, so the two can never drift apart.

## The three rules that decide most reviews

1. **Never guess a selector.** Debug the live app in the browser first, then
   codify what you observed into a POM + spec.
2. **Specs import `{ test, expect }` from `playwright/fixtures/base.js`**, never
   from `@playwright/test`; page objects arrive as fixtures, never `new`-ed.
3. **No assertions in `pages/`.** POMs expose locators and actions; the spec
   states what must be true.

## Quick start

```bash
cp playwright/.env.example playwright/.env   # fill TEST_USERNAME / TEST_PASSWORD
npm test                                     # --ui mode
npm run test:no-ui                           # headless (CI-style)
npm run test:read-only                       # skips @mutating and @temp
```

`playwright/README.md` describes the folder layout for humans browsing the repo.
