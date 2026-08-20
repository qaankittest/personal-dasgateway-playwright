# Fixture Skill

Fixtures are how setup, teardown, page objects, and test data get into a test. They replace `beforeEach` for anything reusable.

## Why fixtures over `beforeEach`

| | `beforeEach` | Fixture |
|---|---|---|
| Runs when unused | Always | Only if the test requests it |
| Teardown on failure | Manual, often skipped | Guaranteed (code after `use()`) |
| Composable | No | Yes — fixtures can depend on fixtures |
| Per-test isolation | Manual | Built in |
| Type of setup | One trivial line | Anything with state or cleanup |

`beforeEach` is still fine for a single stateless line such as `await page.goto('/dashboard')`. Everything else becomes a fixture.

## Rules

1. **One `fixtures/base.js` barrel.** Spec files import `{ test, expect }` from it — never from `@playwright/test` directly.
2. **Everything before `use()` is setup; everything after is teardown.** Teardown runs even when the test fails.
3. **Page objects are fixtures**, so specs never call `new SomePage(page)`.
4. **Test-scoped by default.** Use `{ scope: 'worker' }` only for expensive, read-only setup. Anything a test mutates stays test-scoped.
5. **Never authenticate through the UI in every test** — use a setup project + `storageState`.
6. **A fixture that creates data must delete it** in its own teardown.
7. **No assertions in fixtures.** If setup fails, throw — don't `expect`.
8. **Fixtures must not depend on test order** or on another test having run.
9. **Name fixtures for what they provide** (`merchant`, `loginPage`, `apiClient`), not how (`setupStuff`).
10. **Options over duplication** — use `test.use({ ... })` in a describe block instead of forking a fixture.

## Base fixture file

`fixtures/base.js`

```js
import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { MerchantPage } from '../pages/MerchantPage.js';
import { createMerchant, deleteMerchant } from '../data/merchantFactory.js';

export const test = base.extend({
  // --- page object fixtures ---
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  merchantPage: async ({ page }, use) => {
    await use(new MerchantPage(page));
  },

  // --- data fixture with guaranteed cleanup ---
  merchant: async ({ request }, use) => {
    const created = await createMerchant(request);
    await use(created);                 // <- the test body runs here
    await deleteMerchant(request, created.id);
  },
});

export { expect };
```

Spec usage:

```js
import { test, expect } from '../fixtures/base.js';

test('approves a merchant', async ({ merchantPage, merchant }) => {
  await merchantPage.goto();
  await merchantPage.approve(merchant.name);
  await expect(merchantPage.row(merchant.name)).toContainText('Active');
});
```

Only the fixtures a test destructures are actually built.

## Authentication via storageState

`tests/auth.setup.js`

```js
import { test as setup, expect } from '@playwright/test';
const AUTH_FILE = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill(process.env.PORTAL_USER);
  await page.getByLabel('Password').fill(process.env.PORTAL_PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
```

`playwright.config.js`

```js
projects: [
  { name: 'setup', testMatch: /auth\.setup\.js/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
]
```

Add `playwright/.auth/` to `.gitignore`.

### Multiple roles

Write one state file per role (`admin.json`, `merchant.json`, `readonly.json`), then pick per describe block:

```js
test.describe('Admin only', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });
  ...
});
```

### A logged-out test in a logged-in suite

```js
test.use({ storageState: { cookies: [], origins: [] } });
```

## Worker-scoped fixture

For setup too expensive to repeat per test and never mutated:

```js
const test = base.test.extend({
  apiToken: [async ({}, use) => {
    const token = await fetchServiceToken();
    await use(token);
  }, { scope: 'worker' }],
});
```

If a test can change it, it must not be worker-scoped.

## Option fixture (parameterised setup)

```js
const test = base.test.extend({
  market: ['SG', { option: true }],

  merchant: async ({ request, market }, use) => {
    const created = await createMerchant(request, { market });
    await use(created);
    await deleteMerchant(request, created.id);
  },
});

// in a spec
test.describe('Mauritius onboarding', () => {
  test.use({ market: 'MU' });
  ...
});
```

## Automatic fixture (runs for every test without being requested)

```js
const test = base.test.extend({
  captureConsoleErrors: [async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await use();
    if (errors.length) testInfo.attach('console-errors', { body: errors.join('\n') });
  }, { auto: true }],
});
```

Use `auto: true` sparingly — diagnostics and tracing only, never business setup.

## Anti-patterns

| Wrong | Right |
|---|---|
| `new MerchantPage(page)` in every spec | Page object fixture |
| UI login in `beforeEach` | Setup project + `storageState` |
| Cleanup at the end of the test body | Cleanup after `use()` in the fixture |
| Module-level `let merchantId` shared between tests | Per-test data fixture |
| Worker-scoped fixture holding mutable records | Test-scoped |
| `expect()` inside a fixture | Throw a clear error instead |
| Fixture that reads `process.env` and branches on environment | Option fixture + config projects |
