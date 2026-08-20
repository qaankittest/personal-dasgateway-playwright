# Data Factory Skill

A data factory produces the records a test needs — unique, valid by default, overridable, and disposable.

## Rules

1. **Unique per test, per run.** No hardcoded `test123` that collides on the second run or across parallel workers.
2. **Create prerequisites via API, not UI.** UI setup is slow and fails for reasons unrelated to the test under test.
3. **Valid by default, overridable per test.** `buildMerchant({ country: 'MU' })` returns a complete valid record with that one field changed.
4. **Every create has a matching delete**, called from fixture teardown — not from the test body (which is skipped on failure).
5. **Never share a record between tests.** If two tests can mutate the same row, both are flaky.
6. **Credentials, URLs, and keys come from `process.env`** — never committed literals.
7. **Static reference data lives in `test-data/*.json`**, imported — not pasted into specs.
8. **Builders return plain objects; creators hit the API.** Keep the two separate.
9. **Don't assert in a factory.** If creation fails, throw with the response body so the failure is diagnosable.
10. **Seed only what the test needs.** Creating ten related records "just in case" makes failures hard to read.

## Layout

```
data/
├── builders.js          // pure objects, no network
├── merchantFactory.js   // API create/delete
├── uniq.js              // unique value helpers
test-data/
└── countries.json       // static reference data
```

## Unique values

`data/uniq.js`

```js
import { randomUUID } from 'node:crypto';

export const runId = process.env.RUN_ID || randomUUID().slice(0, 8);

export function uniqueSuffix() {
  return `${runId}-${Date.now().toString().slice(-6)}`;
}

export function uniqueName(prefix = 'AUTO') {
  return `${prefix}-${uniqueSuffix()}`;
}

export function uniqueEmail(prefix = 'qa') {
  return `${prefix}+${uniqueSuffix()}@example.com`;
}

export function uniqueUen() {
  return `T${Date.now().toString().slice(-8)}X`;
}

```

A shared `runId` prefix makes leftover data easy to identify and bulk-clean.

## Builders — pure, no network

`data/builders.js`

```js
import { uniqueName, uniqueEmail, uniqueUen } from './uniq.js';

export function buildMerchant(overrides = {}) {
  return {
    name: uniqueName('MERCHANT'),
    uen: uniqueUen(),
    country: 'SG',
    currency: 'SGD',
    email: uniqueEmail('merchant'),
    mcc: '5399',
    settlementCycle: 'T+2',
    ...overrides,
  };
}

export function buildTransaction(overrides = {}) {
  return {
    amount: 100.00,
    currency: 'SGD',
    cardType: 'VISA',
    threeDs: true,
    ...overrides,
  };
}

```

Spread `overrides` **last** so a test can change any field. Test-relevant values are always passed explicitly, never left to the default:

```js
// Good — the test is about MU, so MU is visible in the test
const merchant = buildMerchant({ country: 'MU', currency: 'MUR' });
```

## Factories — API create + delete

`data/merchantFactory.js`

```js
import { buildMerchant } from './builders.js';

export async function createMerchant(request, overrides = {}) {
  const payload = buildMerchant(overrides);
  const res = await request.post('/api/merchants', { data: payload });

  if (!res.ok()) {
    throw new Error(`Merchant setup failed [${res.status()}]: ${await res.text()}`);
  }

  return { ...payload, ...(await res.json()) };   // includes generated id
}

export async function deleteMerchant(request, id) {
  const res = await request.delete(`/api/merchants/${id}`);
  if (!res.ok() && res.status() !== 404) {
    console.warn(`Cleanup failed for merchant ${id}: ${res.status()}`);
  }
}

```

Cleanup **warns**, it does not throw — a failed teardown must not mask the real test result.

## Wiring into a fixture

```js
const test = base.test.extend({
  merchant: async ({ request }, use) => {
    const created = await createMerchant(request);
    await use(created);
    await deleteMerchant(request, created.id);
  },

  // parameterised variant
  approvedMerchant: async ({ request }, use) => {
    const created = await createMerchant(request, { status: 'ACTIVE' });
    await use(created);
    await deleteMerchant(request, created.id);
  },
});
```

For several records, track and clean in reverse order:

```js
merchants: async ({ request }, use) => {
  const created = [];
  const make = async (o) => {
    const m = await createMerchant(request, o);
    created.push(m);
    return m;
  };
  await use(make);
  for (const m of created.reverse()) await deleteMerchant(request, m.id);
},
```

## Static reference data

`test-data/countries.json`

```json
[
  { "code": "SG", "currency": "SGD", "taxRate": 0.09 },
  { "code": "MU", "currency": "MUR", "taxRate": 0.15 },
  { "code": "JP", "currency": "JPY", "taxRate": 0.10 }
]
```

Drive data-driven tests from it:

```js
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Runtime read, not `import ... from '*.json'` — keeps the fixture editable and
// sidesteps ESM import-attributes ceremony.
const here = path.dirname(fileURLToPath(import.meta.url));
const countries = JSON.parse(
  readFileSync(path.join(here, '../test-data/countries.json'), 'utf-8'),
);

for (const c of countries) {
  test(`applies ${c.code} tax rate on settlement statement`, async ({ settlementPage }) => {
    ...
  });
}
```

Loop **outside** `test()` so each case is a separate reported test, not one test with a loop inside.

## Secrets and environment

```js
// .env  (gitignored)
BASE_URL=https://uat.portal.example.com
PORTAL_USER=qa_automation
PORTAL_PASS=...
```

```js
import dotenv from 'dotenv';

dotenv.config();
```

Never commit credentials. Never print them — mask in any logged payload.

## Anti-patterns

| Wrong | Right |
|---|---|
| `const uen = 'T12345678X'` | `uniqueUen()` |
| Creating the merchant through the UI to test approval | Create via API, test approval in UI |
| `beforeAll` creates one record all tests reuse | Per-test fixture record |
| Cleanup at the end of the test body | Cleanup after `use()` in the fixture |
| Factory throws on cleanup failure | Warn on cleanup failure |
| 40-line inline payload object in the spec | `buildMerchant({ ...the bits that matter })` |
| `if (env === 'uat') { ... }` inside a factory | Config projects / option fixtures |
| Hardcoded password in the spec | `process.env` |
