# CLAUDE.md — DasGateway E2E (`das-gateway-e2e`)

Guidance for Claude (and humans) when working in this repo. The project is a
**Playwright + JavaScript end-to-end suite** for the **Payment Options / DasGateway
internal admin portal**. It contains *only* the test suite — not the app under test.

> **North star:** new tests are authored by **debugging the live app in the
> browser first** (discover the real DOM, selectors, URL params, and network
> calls), *then* codifying what was observed into a Page Object + spec. Never
> guess selectors — verify them against the running app.

---

## 1. Stack & layout

- **Runner:** `@playwright/test` ^1.59, plain JavaScript, ESM (`"type": "module"`).
  No build step and no type-checking step — Node runs the sources directly.
- **Types:** documented with **JSDoc**, not TypeScript. Domain shapes live as
  `@typedef` blocks in `fixtures/*/types.js`; POMs annotate params with
  `@param {import('@playwright/test').Page} page`. Editors still complete and
  check against these; `jsconfig.json` wires it up (`checkJs` is off).
- **Architecture:** Page Object Model (POM). Specs stay thin; all locators and
  flows live in `pages/`.
- **Target app:** `https://dev.paymentoptions.com/beta` (dev). `BASE_URL` is the
  single source of truth and its path prefix (`/beta`) is applied to every route.

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
│   ├── uniq.js              # runId + uniqueSuffix/Name/Email/Token — worker-safe
│   └── builders.js          # pure record builders (guestEmail, buildGuestAccount)
├── pages/                   # POMs, split by domain
│   ├── auth/  merchants/  transactions/  onboarding/  finance/  products/
├── utils/
│   ├── scroll.js            # scrollUntilRowCount (infinite scroll + idle detect)
│   ├── retry.js             # backoff retry helper
│   ├── logger.js            # log.info/warn/fail — "[E2E] …" prefix
│   ├── validators.js        # cross-surface transaction-action assertions
│   └── dasForm.js           # drive components/das-form controls
├── tests/                   # specs, mirroring pages/ domains
└── reports/                 # html + junit.xml + artifacts (traces/screens/video)
```

## 2. Commands

```bash
npm test                 # runs the suite in --ui mode
npm run test:no-ui       # headless run (CI-style)
npm run test:e2e:report  # open the last HTML report

# selective runs, driven by the tags on each test.describe:
npm run test:smoke       # @smoke      — login + transactions list
npm run test:regression  # @regression — everything substantive
npm run test:onboarding  # @onboarding — the GUEST/partner application flows
npm run test:read-only   # everything except @mutating and @temp

# override at runtime — no code change:
TRANSACTION_COUNT=100 npm run test:no-ui
BASE_URL=https://staging.example.com npm run test:no-ui
```

Run a single spec: `npx playwright test playwright/tests/<domain>/<file>.spec.js --config=playwright/playwright.config.js`.

Config notes: `fullyParallel: false`, `retries` 1 local / 2 CI, `timeout` 90s,
`expect` 10s, viewport widened to **1680×900** so right-anchored drawers
(PBL create 920px + AddItemPanel 584px) fit without clipping. Trace/screenshot/
video are `retain-on-failure`.

## 3. Environment (`.env`)

Copy `playwright/.env.example` → `.env` (loaded from `playwright/.env` **and**
repo-root `.env`). Keys: `TEST_USERNAME`/`TEST_PASSWORD` (most suites),
`TEST_PARTNER_USERNAME`/`TEST_PARTNER_PASSWORD` (partner/referral suites),
optional `BASE_URL`, `TEST_OTP` (1234), `TEST_GUEST_EMAIL_DOMAIN`,
`TRANSACTION_COUNT`/`MERCHANT_COUNT`/`STATEMENT_COUNT`. Never commit `.env`.

---

## 4. Authoring a new test — the workflow

1. **Explore in the browser.** Log into the dev app and walk the target flow.
   Capture the real `data-testid`s, roles/accessible names, class hooks, the URL
   params each action pushes, and the network endpoints (method + path) each
   mutation calls.
2. **Prefer a throwaway discovery spec** for anything table/filter-driven.
   `tests/transactions/_discover-columns.spec.js` is the template: derive live
   values from the DOM, apply the control, and `console.log` the URL params +
   resulting rows. Prefix with `_`, note "delete after use", and remove it once
   the real spec is written.
3. **Write/extend the POM** under `pages/<domain>/` — constructor sets the
   locators, plus `goto()` and a `waitForInitialLoad()`/`waitForReady()`.
4. **Write the spec** under `tests/<domain>/`, thin, using `test.step` blocks.
5. **Verify** against the live app before declaring done; keep the HTML report/
   trace for failures.

## 5. POM conventions

- **Locator priority — always resilient, `.first()` at the end:**
  ```ts
  page.getByTestId('login-username')
    .or(page.getByLabel(/username|email/i))
    .or(page.locator('input[name="username"], input[type="email"]'))
    .first();
  ```
  testid first → role/accessible-name → structural fallback. The app is
  under-instrumented, so `.or()` fallback chains are the norm, not an exception.
- **No verification in a POM.** A page object holds locators and actions; the
  spec states what must be true. Expose a locator (`get businessDetailsHeading()`,
  `subscriberRow(name, email)`) and let the spec assert on it — a method that
  returns a string or boolean throws Playwright's auto-retry away. There are no
  `assert*()` methods left in `pages/`; don't add one back.
  Two deliberate exceptions, both *waits* rather than verifications: the
  readiness gates below, and the network assertions on mutations further down.
- **Every POM has** `goto()` (navigates via `TEST_CONFIG.routes.*`) and a
  readiness gate that: polls for "rows present **or** empty state", then asserts
  `skeletonRows` reach `toHaveCount(0)`. Reuse this shape.
- **Infinite scroll:** load rows with `scrollUntilRowCount(page, {...TEST_CONFIG.scroll})`
  against the table's own scroll container; it stops at target count or after
  `idleAttemptsBeforeStop` no-progress scrolls.
- **Reading table cells:** middle-truncated values (e.g. transaction ref ids)
  are read from the element's `title` attribute, not visible text. Resolve column
  index from header text (`columnIndex(/das mid/i)`) so specs don't hardcode `<td>` positions.
- **Mutations assert the network call**, not just the UI:
  ```ts
  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes(ENDPOINT) && r.request().method() === 'POST'),
    chip.click(),
  ]);
  expect(resp.ok()).toBeTruthy();
  ```
- **Navigation vs drawer** (transactions): the first cell's ref-id span
  *navigates* to `/transactions/:id`; clicking any other cell opens the global
  drawer (`?drawer=details&id=…`). Keep those two entry points distinct.

## 6. Custom UI controls — `das-form` & portaled menus

The app's `components/das-form` and custom `Select`/`MultiSelect`/`DateRange`
are **not** native form controls. Rules that keep locators stable:

- DasForm renders every field with `id={field.name}` → target by `#fieldName`
  (`#STATUS`, `#productName`, `#currency`). Stable across i18n label changes.
- Select/MultiSelect/DateRange menus render into a **body-level portal**
  `[data-filter-portal="true"]`. The freshly opened menu is the **`.last()`**
  such portal (a closing menu's portal may linger during its animation).
- Select options are `<button>`s; MultiSelect options are
  `<label><input type=checkbox>…</label>` — often driven via the menu's built-in
  search box, then check the matching option. MultiSelect has **no Escape
  handler**; close it by re-clicking the trigger or an outside safe element.
- DateField uses react-datepicker (calendar portal `#das-datepicker-portal`);
  **manual typing is blocked** (`onChangeRaw` prevent-default) — pick via the
  calendar. Use the `utils/dasForm.js` helpers (`selectDasFormOption`,
  `pickDasFormDate`) rather than re-implementing.
- The Advanced-Filters popover renders inline (not portaled); anchor rule rows
  by their `grid-cols-[1fr_1fr_40px]` container / the "Remove filter" button.

## 7. Spec conventions

- **Import `{ test, expect }` from `fixtures/base.js`, never from
  `@playwright/test`.** Page objects arrive as fixtures — a spec never calls
  `new SomePage(page)`. Destructure with a rename when a shorter local name
  reads better: `async ({ page, statementsPage: statements }) => {…}`.
  Only the fixtures a test names are constructed.
- **Tag every `test.describe`** so runs can be sliced:
  `test.describe('…', { tag: ['@regression'] }, () => {…})`. Tags in use:
  `@smoke`, `@regression`, `@onboarding`, `@mutating` (changes backend state),
  `@temp` (throwaway probe — see §4.2). See §2 for the matching npm scripts.
- Wrap in `test.describe`; **self-skip** when prerequisites are missing:
  `test.skip(!HAS_CREDS, 'TEST_USERNAME / TEST_PASSWORD not set')`.
- Structure the body with `test.step('…', async () => {…})` so failures pinpoint
  the phase.
- **Self-seed from live data:** read a real value from row 0, filter by it, then
  assert every visible row agrees — cases stay non-empty without a fixed seed.
- **Empty data & missing permissions self-annotate** rather than hard-fail:
  assert the empty state and push a `test.info().annotations` note, then return.
- Mark heavy suites `test.slow()`.
- **Mutating vs read-only:** `statements-actions.spec.js` (Approve / Wired
  Status / edit STATUS) **changes backend state** — run only against a disposable
  dev environment, and needs FINANCE/SETTLEMENT/SUPPORT/SYSADMIN permissions
  (self-skips otherwise). Filter/smoke suites are read-only.
- Logging via `utils/logger.js` (`log.info/warn/fail`), always include the row's
  ref/id in the meta so a failure says *which* record on *which* surface broke.

## 8. Fixtures

- JSON fixtures live under `fixtures/<domain>/` with a `load.js` (uses
  `readFileSync` + `JSON.parse`, **not** a JSON import — a runtime read keeps the
  fixture editable and sidesteps ESM import-attributes ceremony) and a `types.js`
  holding the JSDoc `@typedef`s for that domain's shapes.
- GUEST onboarding: emails template `{{unique}}` → a token from `data/uniq.js` so
  reruns never hit "email already registered"; secrets fall back to `TEST_CONFIG`.
- **All uniqueness comes from `data/uniq.js`.** It mints `runId` once per
  process (including `TEST_WORKER_INDEX`) and appends a monotonic counter, so
  two workers cannot collide even inside the same millisecond — which a bare
  `Date.now()` can. Never hand-roll a timestamp suffix; call `uniqueToken()` /
  `uniqueName()` / `uniqueEmail()`. Set `RUN_ID` to pin the prefix.
- **Record shapes live in `data/builders.js`** as pure functions — no network,
  no `page`, `overrides` spread last (`buildGuestAccount({ email })`). Test data
  never lives on a page object.

## 9. Recommended `data-testid`s (ask app team to add — removes brittleness)

| Area | testids |
|---|---|
| Login | `login-username`, `login-password`, `login-submit`, `login-error` |
| Data table | `transactions-table` / `statements-table`, `transactions-row` / `statements-row`, `skeleton-row`, `transactions-row-ref-link` |
| Txn details actions | `action-refund/capture/void/dispute/editStatus` |
| Txn drawer | `transaction-drawer`, `drawer-action-refund/capture/void/dispute/editStatus` |

## 10. Gotchas

- ESM project (`"type": "module"`) — use ESM imports; `import.meta.url` for paths.
- **Relative imports MUST carry the `.js` extension** (`'../../utils/logger.js'`).
  Node's ESM resolver does no extension guessing, so an extensionless import
  throws `ERR_MODULE_NOT_FOUND` at load time.
- Read fixtures with `readFileSync` + `JSON.parse`, not `import x from '*.json'`.
- Class internals use real `#private` methods/getters (e.g. `#button()`,
  `#filterPortal`) — call them as `this.#name`, and note they're invisible
  outside the class body.
- Transaction `capture` and `void` are **mutually exclusive** — both visible = a
  selector bug (asserted in `utils/validators.js`).
- Drawer/details action visibility must **agree across surfaces**
  (`assertSurfacesAgree`) — both consume the same `selectTransactionActions`.
- Reset filters by **reload** (`resetFiltersViaReload`) — the filter slice isn't
  persisted but auth is, so it's cheaper/safer than removing rules one by one.
- Pin the Statements tab explicitly (`?tab=merchant`) so a stale `?tab=` can't leak in.
- Keep the viewport ≥1680 wide when adding drawer-based flows.

---

## 11. Patterns & ideas (Abhilash's notes)

Ongoing conventions and things to build. Add freely.

- Author tests **browser-debug-first**: verify selectors/params/endpoints against
  the live app before writing the POM.
- Use temporary `_discover-*.spec.js` probes to map filterable columns → URL
  params, then delete them.
- Prefer testid-first locators; lobby the app team to add the testids in §9.
- The suite follows `skills/playwright-automation-standards` (golden rules,
  locators, waiting) plus its `references/{assertions,fixtures,page-objects,
  data-factory}.md`. Read the matching reference before writing that kind of
  code. Where the skill and this file disagree, **this file wins** — the two
  known divergences are ESM (the skill assumes CommonJS) and `fullyParallel:
  false` (the skill defaults it true; see the config comment for why).
- _(add your own patterns / ideas here)_
