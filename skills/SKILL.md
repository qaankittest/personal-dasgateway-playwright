---
name: das-gateway-e2e
description: Test-automation standards and repo conventions for the DasGateway / Payment Options E2E suite (Playwright + JavaScript ESM, Page Object Model) — golden rules, locator strategy, waiting, das-form custom controls, fixtures, page objects, assertions and data factories, plus the repo's layout, npm scripts and env keys. Use whenever writing, reviewing, refactoring or debugging anything in this repo — a spec, a page object, a fixture, a util or test data — including "write a test", "automate this flow", "fix this flaky test", "add a POM", "review my script", even if standards are never mentioned.
---

# DasGateway E2E — automation standards

The suite under `playwright/` is a **Playwright + JavaScript (ESM)** end-to-end
pack for the **Payment Options / DasGateway internal admin portal**. This repo
contains *only* the tests — never the app under test.

> **North star:** new tests are authored by **debugging the live app in the
> browser first** — discover the real DOM, selectors, URL params and network
> calls — *then* codify what was observed into a Page Object + spec.
> **Never guess a selector.** Verify it against the running app.

This file is the single source of truth for how tests are written here. Where a
general Playwright habit conflicts with a rule below, **the rule below wins**.

---

## Which file to read

Read the sub-skill *before* writing that kind of code — do not work from memory.

| Task | Read |
|---|---|
| Writing or fixing `expect()` checks, flaky verifications | `references/assertions.md` |
| Building `test.extend`, auth state, setup/teardown | `references/fixtures.md` |
| Creating or editing a page class / locators | `references/page-objects.md` |
| Test data, unique records, API seeding, cleanup | `references/data-factory.md` |
| Everything else | this file |

---

## The golden rules

1. **No hard waits.** `waitForTimeout` is banned in committed code.
2. **No manual `waitForSelector` before an action.** Playwright auto-waits.
3. **Every assertion is web-first** (`await expect(locator)…`) — never a raw boolean.
4. **Locators are resilient**: testid → role/accessible-name → structural fallback,
   chained with `.or()` (see §5). No brittle CSS/XPath chains.
5. **Every test is independent** — runs alone and in any order.
6. **Reusable setup lives in fixtures**, not copy-pasted `beforeEach` blocks.
7. **Page objects hold locators and actions only** — never assertions.
8. **No `if` / `try-catch` used to make a test pass anyway.** Let it fail.
9. **Test data is unique per run** — always via `data/uniq.js`, never `Date.now()`.
10. **Nothing merged with** `test.only`, commented-out tests, or bare `console.log`
    (log through `utils/logger.js`; a `_discover-*.spec.js` probe is the one
    exception and is deleted before merge).
11. **A test that only passes on retry is a bug** — open the trace, don't raise `retries`.
12. **One behaviour per test.** If the title needs "and also", split it.

---

## 1. Stack & layout

- **Runner:** `@playwright/test` ^1.59, plain JavaScript, **ESM** (`"type": "module"`).
  No build step and no type-checking step — Node runs the sources directly.
- **Types:** documented with **JSDoc**, not TypeScript. Domain shapes live as
  `@typedef` blocks in `fixtures/*/types.js`; POMs annotate params with
  `@param {import('@playwright/test').Page} page`. `jsconfig.json` wires up editor
  completion (`checkJs` is off).
- **Architecture:** Page Object Model. Specs stay thin; every locator and flow
  lives in `pages/`.
- **Target app:** `https://dev.paymentoptions.com/beta` (dev). `BASE_URL` is the
  single source of truth and its path prefix (`/beta`) is applied to every route
  by `route()` in `fixtures/test-config.js`.

```
playwright/
├── playwright.config.js     # testDir, reporters, baseURL, viewport 1680×900
├── .env.example             # copy → .env, fill creds
├── fixtures/
│   ├── base.js              # THE fixture barrel — specs import { test, expect } from here
│   ├── test-config.js       # BASE_URL, route(), TEST_CONFIG, ACTION_LABELS
│   ├── onboarding/          # JSON fixtures + load.js + types.js
│   └── products/            # JSON fixtures + load.js + types.js
├── data/
│   ├── uniq.js              # runId + uniqueSuffix/Token/Name/Email/Digits — worker-safe
│   └── builders.js          # pure record builders (guestEmail, buildGuestAccount)
├── pages/                   # POMs by domain
│   ├── auth/  merchants/  transactions/  onboarding/  finance/  products/  hashcard/ login
├── utils/
│   ├── scroll.js            # scrollUntilRowCount (infinite scroll + idle detect)
│   ├── retry.js             # backoff retry helper
│   ├── logger.js            # log.info/warn/fail — "[E2E] …" prefix
│   ├── validators.js        # cross-surface transaction-action assertions
│   └── dasForm.js           # drive components/das-form controls
├── tests/                   # specs, mirroring pages/ domains
└── reports/                 # html + junit.xml + artifacts (traces/screens/video)
```

---

## 2. Commands

```bash
npm test                 # suite in --ui mode
npm run test:no-ui       # headless run (CI-style)
npm run test:e2e:report  # open the last HTML report

# selective runs, driven by the tags on each test.describe:
npm run test:smoke       # @smoke      — login + transactions list
npm run test:regression  # @regression — everything substantive
npm run test:onboarding  # @onboarding — GUEST / partner application flows
npm run test:read-only   # everything except @mutating and @temp

# override at runtime — no code change:
TRANSACTION_COUNT=100 npm run test:no-ui
BASE_URL=https://staging.example.com npm run test:no-ui
```

Single spec:
`npx playwright test playwright/tests/<domain>/<file>.spec.js --config=playwright/playwright.config.js`

Debug with the trace viewer (`npx playwright show-trace`) and `--debug`, not print
statements.

---

## 3. Environment (`.env`)

Copy `playwright/.env.example` → `.env` (loaded from `playwright/.env` **and**
repo-root `.env`). Keys: `TEST_USERNAME` / `TEST_PASSWORD` (most suites),
`TEST_PARTNER_USERNAME` / `TEST_PARTNER_PASSWORD` (partner / referral suites),
optional `BASE_URL`, `TEST_OTP` (1234), `TEST_GUEST_EMAIL_DOMAIN`,
`TRANSACTION_COUNT` / `MERCHANT_COUNT` / `STATEMENT_COUNT`.

**Never commit `.env`**, and never hardcode a URL, credential or environment value
in a spec — read it from `TEST_CONFIG`.

---

## 4. Authoring a new test — the workflow

1. **Explore in the browser.** Log into the dev app and walk the target flow.
   Capture the real `data-testid`s, roles / accessible names, class hooks, the URL
   params each action pushes, and the network endpoints (method + path) each
   mutation calls.
2. **Prefer a throwaway discovery spec** for anything table- or filter-driven.
   `tests/transactions/_discover-columns.spec.js` is the template: derive live
   values from the DOM, apply the control, and log the URL params + resulting rows.
   Prefix with `_`, tag `@temp`, note "delete after use", and remove it once the
   real spec exists.
3. **Write / extend the POM** under `pages/<domain>/` — constructor sets the
   locators, plus `goto()` and a `waitForInitialLoad()` / `waitForReady()`.
4. **Register the POM as a fixture** in `fixtures/base.js` (one line, plus the
   `Poms` typedef entry) — specs never `new` a page object.
5. **Write the spec** under `tests/<domain>/`, thin, using `test.step` blocks.
6. **Verify against the live app** before declaring done; keep the HTML report /
   trace for failures.

---

## 5. Locators

Priority order, **`.first()` at the end**:

```js
page.getByTestId('login-username')
  .or(page.getByLabel(/username|email/i))
  .or(page.locator('input[name="username"], input[type="email"]'))
  .first();
```

testid → role / accessible name → structural fallback. The app is
**under-instrumented**, so `.or()` fallback chains are the norm here, not an
exception — but always lead with the most semantic option that actually works:

```js
page.getByRole('button', { name: 'Submit' })   // preferred when the name is stable
page.getByLabel('Merchant Name')                // form fields
page.getByPlaceholder('Search')
page.getByText('Application Approved')          // static text only
page.getByTestId('merchant-row')
page.locator('#specific-id')                    // last resort
```

- Scope instead of indexing:
  `page.getByRole('row', { name: 'ILK' }).getByRole('button', { name: 'Edit' })`.
- Use `.filter({ hasText })` / `.filter({ has })` for lists, never `.nth(3)`.
- Never use auto-generated class names, `nth-child` chains, or absolute XPath.
- Locators are declared on the page object, never inline in the spec.

```js
// Bad
await page.locator('div.MuiBox-root > table > tbody > tr:nth-child(2) > td:nth-child(5) > button').click();

// Good
await page.getByRole('row', { name: 'ACME Pte Ltd' })
          .getByRole('button', { name: 'Approve' })
          .click();
```

---

## 6. Waiting

Playwright auto-waits before every action (attached → visible → stable → enabled →
receives events) and auto-retries every `expect()` until timeout. Trust it.

### Banned

```js
await page.waitForTimeout(5000);          // never
await page.waitForSelector('#btn');       // redundant before a click
if (await el.isVisible()) { ... }         // one-shot check, no retry — flaky
```

### The only legitimate explicit waits

| Situation | Use |
|---|---|
| Wait for an API the UI depends on | `page.waitForResponse(r => r.url().includes('/api/merchants') && r.ok())` |
| Click triggers a request you must capture | `Promise.all([page.waitForResponse(...), button.click()])` |
| New tab / popup | `const [popup] = await Promise.all([context.waitForEvent('page'), link.click()])` |
| File download | `const [dl] = await Promise.all([page.waitForEvent('download'), btn.click()])` |
| Element must disappear | `await expect(spinner).toBeHidden()` |

- Avoid `waitForLoadState('networkidle')` — unreliable on polling apps. Assert on a
  real element instead.
- One genuinely slow step? Raise the timeout on **that assertion only**:
  `await expect(report).toBeVisible({ timeout: 30_000 })`. Never raise the global
  timeout.

---

## 7. POM conventions

- **No verification in a POM.** A page object holds locators and actions; the spec
  states what must be true. Expose a locator (`get businessDetailsHeading()`,
  `subscriberRow(name, email)`) and let the spec assert on it — a method that
  returns a string or boolean throws Playwright's auto-retry away. There are no
  `assert*()` methods left in `pages/`; don't add one back.
  Two deliberate exceptions, both *waits* rather than verifications: the readiness
  gates below, and the network assertions on mutations.
- **Every POM has** `goto()` (navigating via `TEST_CONFIG.routes.*`) and a readiness
  gate that polls for "rows present **or** empty state", then asserts `skeletonRows`
  reach `toHaveCount(0)`. Reuse this shape.
- **Infinite scroll:** load rows with
  `scrollUntilRowCount(page, { ...TEST_CONFIG.scroll })` against the table's own
  scroll container; it stops at target count or after `idleAttemptsBeforeStop`
  no-progress scrolls.
- **Reading table cells:** middle-truncated values (e.g. transaction ref ids) are
  read from the element's `title` attribute, not visible text. Resolve column index
  from header text (`columnIndex(/das mid/i)`) so specs never hardcode `<td>`
  positions.
- **Mutations assert the network call**, not just the UI:

```js
const [resp] = await Promise.all([
  page.waitForResponse(r => r.url().includes(ENDPOINT) && r.request().method() === 'POST'),
  chip.click(),
]);
expect(resp.ok()).toBeTruthy();
```

- **Navigation vs drawer** (transactions): the first cell's ref-id span *navigates*
  to `/transactions/:id`; clicking any other cell opens the global drawer
  (`?drawer=details&id=…`). Keep those two entry points distinct.
- **Export as an ESM named export** — `export class TransactionsPage { … }` — and
  import it in `fixtures/base.js`.

---

## 8. Custom UI controls — `das-form` & portaled menus

The app's `components/das-form` and custom `Select` / `MultiSelect` / `DateRange`
are **not** native form controls. Rules that keep locators stable:

- DasForm renders every field with `id={field.name}` → target by `#fieldName`
  (`#STATUS`, `#productName`, `#currency`). Stable across i18n label changes.
- Select / MultiSelect / DateRange menus render into a **body-level portal**
  `[data-filter-portal="true"]`. The freshly opened menu is the **`.last()`** such
  portal — a closing menu's portal may linger during its animation.
- Select options are `<button>`s; MultiSelect options are
  `<label><input type=checkbox>…</label>`, usually driven via the menu's built-in
  search box, then checking the matching option. MultiSelect has **no Escape
  handler** — close it by re-clicking the trigger or an outside safe element.
- DateField uses react-datepicker (calendar portal `#das-datepicker-portal`);
  **manual typing is blocked** (`onChangeRaw` prevent-default) — pick via the
  calendar. Use `utils/dasForm.js` (`selectDasFormOption`, `pickDasFormDate`)
  rather than re-implementing.
- The Advanced-Filters popover renders inline (not portaled); anchor rule rows by
  their `grid-cols-[1fr_1fr_40px]` container / the "Remove filter" button.

---

## 9. Spec conventions

- **Import `{ test, expect }` from `fixtures/base.js`, never from
  `@playwright/test`.** Page objects arrive as fixtures — a spec never calls
  `new SomePage(page)`. Rename on destructure when a shorter local name reads
  better: `async ({ page, statementsPage: statements }) => {…}`. Only the fixtures a
  test names are constructed.
- **Tag every `test.describe`** so runs can be sliced:
  `test.describe('…', { tag: ['@regression'] }, () => {…})`. Tags in use: `@smoke`,
  `@regression`, `@onboarding`, `@mutating` (changes backend state), `@temp`
  (throwaway probe — §4.2). See §2 for the matching npm scripts.
- **Self-skip when prerequisites are missing:**
  `test.skip(!HAS_CREDS, 'TEST_USERNAME / TEST_PASSWORD not set')`. Never comment out
  a test.
- Structure the body with `test.step('…', async () => {…})` so a failure pinpoints
  the phase. Multi-step flows are **one test with steps**, not order-dependent tests.
- Titles state **behaviour + expected outcome**, not steps. Good:
  `rejects application when UEN is already registered`. Bad: `TC_005`.
- **Self-seed from live data:** read a real value from row 0, filter by it, then
  assert every visible row agrees — cases stay non-empty without a fixed seed.
- **Empty data & missing permissions self-annotate** rather than hard-fail: assert
  the empty state, push a `test.info().annotations` note, then return.
- Mark heavy suites `test.slow()`.
- **Mutating vs read-only:** `statements-actions.spec.js` (Approve / Wired Status /
  edit STATUS) **changes backend state** — run it only against a disposable dev
  environment; it needs FINANCE / SETTLEMENT / SUPPORT / SYSADMIN permissions and
  self-skips otherwise. Filter / smoke suites are read-only.
- Log via `utils/logger.js` (`log.info/warn/fail`) and always include the row's
  ref/id in the meta, so a failure says *which* record on *which* surface broke.

```js
import { test, expect } from '../../fixtures/base.js';

test.describe('Transactions list', { tag: ['@smoke'] }, () => {
  test('opens row 0 and shows its ref id on the details page', async ({
    transactionsPage,
    transactionDetailsPage,
  }) => {
    await test.step('open the list', async () => {
      await transactionsPage.goto();
      await transactionsPage.waitForInitialLoad();
    });

    await test.step('open row 0', async () => {
      await transactionsPage.openRow(0);
      await expect(transactionDetailsPage.refIdHeading).toBeVisible();
    });
  });
});
```

---

## 10. Fixtures & test data

- JSON fixtures live under `fixtures/<domain>/` with a `load.js` (uses `readFileSync`
  + `JSON.parse`, **not** a JSON import — a runtime read keeps the fixture editable
  and sidesteps ESM import-attributes ceremony) and a `types.js` holding that
  domain's JSDoc `@typedef`s.
- GUEST onboarding: emails template `{{unique}}` → a token from `data/uniq.js` so
  reruns never hit "email already registered"; secrets fall back to `TEST_CONFIG`.
- **All uniqueness comes from `data/uniq.js`.** It mints `runId` once per process
  (including `TEST_WORKER_INDEX`) and appends a monotonic counter, so two workers
  cannot collide even inside the same millisecond — which a bare `Date.now()` can.
  Never hand-roll a timestamp suffix; call `uniqueToken()` / `uniqueName()` /
  `uniqueEmail()`. Set `RUN_ID` to pin the prefix.
- **Record shapes live in `data/builders.js`** as pure functions — no network, no
  `page`, `overrides` spread last (`buildGuestAccount({ email })`). Test data never
  lives on a page object.
- Adding a POM to the barrel: export the class from `pages/<domain>/`, add the
  one-line fixture in `fixtures/base.js`, add it to the `Poms` typedef. Nothing else
  changes. The `pageErrors` fixture is `auto` and attaches uncaught page errors to
  the report — diagnostics only, it never fails a test.

---

## 11. Config essentials

`playwright/playwright.config.js` — the deliberate deviations from stock Playwright
defaults, each load-bearing:

| Setting | Value | Why |
|---|---|---|
| `fullyParallel` | **`false`** | `statements-actions.spec.js` mutates shared dev records; two workers would race the same rows. |
| `workers` | `1` on CI | Same reason. |
| `retries` | 1 local / 2 CI | A retry-only pass is still a bug — read the trace. |
| `timeout` / `expect` | 90s / 10s | Onboarding wizards and infinite-scroll suites are genuinely long. |
| viewport | **1680×900** | Right-anchored drawers (PBL create 920px + AddItemPanel 584px) clip at 1440. |
| `trace` / `video` | `retain-on-failure` (screenshot `only-on-failure`) | Artifacts land in `reports/artifacts`. |
| `baseURL` | `BASE_URL` from `fixtures/test-config.js` | Specs and routes share one origin + path prefix. |
| `webServer` | *absent* | This repo holds no app — start it separately or point `BASE_URL` at a deployed env. |

Keep the viewport ≥1680 wide when adding drawer-based flows.

---

## 12. Gotchas

- ESM project (`"type": "module"`) — use ESM imports; `import.meta.url` for paths.
- **Relative imports MUST carry the `.js` extension** (`'../../utils/logger.js'`).
  Node's ESM resolver does no extension guessing, so an extensionless import throws
  `ERR_MODULE_NOT_FOUND` at load time.
- Read fixtures with `readFileSync` + `JSON.parse`, not `import x from '*.json'`.
- Class internals use real `#private` methods/getters (e.g. `#button()`,
  `#filterPortal`) — call them as `this.#name`; they're invisible outside the class
  body.
- Transaction `capture` and `void` are **mutually exclusive** — both visible is a
  selector bug (asserted in `utils/validators.js`).
- Drawer / details action visibility must **agree across surfaces**
  (`assertSurfacesAgree`) — both consume the same `selectTransactionActions`.
- Reset filters by **reload** (`resetFiltersViaReload`) — the filter slice isn't
  persisted but auth is, so it's cheaper and safer than removing rules one by one.
- Pin the Statements tab explicitly (`?tab=merchant`) so a stale `?tab=` can't leak
  in.

---

## 13. Anti-pattern quick reference

| Anti-pattern | Do instead |
|---|---|
| `await page.waitForTimeout(3000)` | `await expect(locator).toBeVisible()` |
| `expect(await el.isVisible()).toBeTruthy()` | `await expect(el).toBeVisible()` |
| `if (await el.count() > 0) { ... }` | Assert the expected state directly |
| `try { ... } catch { /* ignore */ }` | Let it fail; fix the cause |
| `new TransactionsPage(page)` in a spec | Destructure the fixture from `fixtures/base.js` |
| `import { test } from '@playwright/test'` | `import { test, expect } from '../../fixtures/base.js'` |
| `expect()` inside a page object | Move it to the spec |
| `.nth(2)` on a dynamic list | `.filter({ hasText })` / scope by row name |
| Hardcoded `<td>` index | `columnIndex(/das mid/i)` |
| `Date.now()` suffix on test data | `uniqueToken()` / `uniqueName()` / `uniqueEmail()` |
| Reading a truncated cell's visible text | Read its `title` attribute |
| Global timeout raised to 120s | Per-assertion timeout on the one slow step |
| A `_discover-*.spec.js` left in the branch | Delete it before merge |

---

## 14. Recommended `data-testid`s

Ask the app team to add these — each one removes an `.or()` fallback chain.

| Area | testids |
|---|---|
| Login | `login-username`, `login-password`, `login-submit`, `login-error` |
| Data table | `transactions-table` / `statements-table`, `transactions-row` / `statements-row`, `skeleton-row`, `transactions-row-ref-link` |
| Txn details actions | `action-refund/capture/void/dispute/editStatus` |
| Txn drawer | `transaction-drawer`, `drawer-action-refund/capture/void/dispute/editStatus` |

---

## 15. Pre-commit checklist

- [ ] No `waitForTimeout`, no `test.only`, no stray `console.log`, no `_discover-*` spec
- [ ] `{ test, expect }` imported from `fixtures/base.js`; no `new SomePage(page)`
- [ ] Every relative import ends in `.js`
- [ ] `test.describe` carries a tag; `@mutating` if it writes backend state
- [ ] Locators live on the POM and are resilient (testid → role → structural, `.first()`)
- [ ] No `expect()` inside `pages/`
- [ ] All assertions awaited and web-first
- [ ] Mutations assert the network response, not just the UI
- [ ] Unique data via `data/uniq.js`; record shapes via `data/builders.js`
- [ ] No hardcoded URLs, credentials or environment values — use `TEST_CONFIG`
- [ ] Empty-data / missing-permission paths annotate instead of hard-failing
- [ ] Verified against the live dev app; title describes behaviour + outcome

---

## 16. Notes & backlog

- Author tests **browser-debug-first**: verify selectors / params / endpoints against
  the live app before writing the POM.
- Use temporary `_discover-*.spec.js` probes to map filterable columns → URL params,
  then delete them.
- Lobby the app team for the testids in §14.
- Coverage gaps worth picking up: hashcard beyond filters, products (PBL /
  subscription) mutation paths, merchant details tabs.
- _(add your own patterns / ideas here)_

---

## 17. VS Code agent loop

`npx playwright init-agents --loop=vscode -c playwright/playwright.config.js`
regenerates the scaffold. It defaults to a TypeScript seed, a root config and a
build step this repo does not have, so **re-apply these after any regeneration**:

- `playwright/tests/seed.spec.js` — JS, imports the fixture barrel, signs in
  first (the portal is behind auth) and is tagged `@temp` so read-only runs skip
  it. Delete any `seed.spec.ts` the tool re-creates.
- `.github/agents/*.agent.md` — each carries a "Repo conventions" section that
  overrides the stock prompt (`.js` not `.ts`, fixture-barrel import, POM layout,
  `--config=playwright/playwright.config.js`).
- `.vscode/mcp.json` and every agent's `mcp-servers` block pass
  `--config=playwright/playwright.config.js` — there is no config at the repo
  root, so without it the MCP server finds no tests.
- `.github/workflows/copilot-setup-steps.yml` — `npm install` (no lockfile is
  committed, so `npm ci` fails), chromium only, no build step.

Test plans live in `specs/`. Generated specs still go through the §15 checklist
before merge — the generator does not know about `das-form`, the `.or()` chains
or the tagging rules until it reads this file.
