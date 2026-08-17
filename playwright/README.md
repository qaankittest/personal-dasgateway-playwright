# `playwright/` — E2E suite

All Playwright artefacts (config, POMs, utils, specs, reports) live in this folder.

## Layout

```
playwright/
├── playwright.config.js          # config (testDir, reporters, baseURL, webServer)
├── .env.example                  # copy to .env, fill in creds
├── .gitignore                    # ignores .env + reports
├── README.md
│
├── fixtures/
│   ├── test-config.js            # creds, routes, scroll tuning, action labels
│   └── sample-document.pdf       # upload fixture for the onboarding suite
│
├── pages/
│   ├── auth/
│   │   └── LoginPage.js
│   ├── merchants/                # merchant list / details / drawer POMs
│   ├── transactions/
│   │   ├── TransactionsPage.js          # table + infinite scroll + row navigation
│   │   ├── TransactionDetailsPage.js    # /transactions/:id action buttons
│   │   └── TransactionDrawerPage.js     # global drawer action buttons
│   ├── onboarding/
│   │   ├── GuestSignUpPage.js           # choose-type → account → OTP → password
│   │   └── MerchantRegistrationPage.js  # /onboarding wizard tabs
│   └── finance/
│       ├── StatementsPage.js            # statements list, bulk chips, filter popover
│       └── StatementEditDrawer.js       # row → details → EDIT → STATUS → Submit
│
├── utils/
│   ├── scroll.js                 # scroll-until-N-rows w/ idle detection
│   ├── retry.js                  # backoff retry helper
│   ├── logger.js                 # structured console logging
│   └── validators.js             # per-row + cross-surface assertions
│
├── tests/
│   ├── auth/login.spec.js
│   ├── merchants/merchants-e2e.spec.js
│   ├── transactions/
│   ├── finance/
│   │   ├── statements-filters.spec.js   # each filter type vs. table output
│   │   └── statements-actions.spec.js   # Approve / Wired Status / Edit Status
│   └── onboarding/
│       └── guest-application.spec.js    # GUEST sign-up → fill every tab → stop at Submit
│
└── reports/                      # generated; html, junit, traces, screenshots, videos
    ├── html/
    ├── junit.xml
    └── artifacts/                # per-test traces + media
```

## Install

```bash
npm i -D @playwright/test dotenv
npx playwright install --with-deps chromium
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test:e2e": "playwright test --config=playwright/playwright.config.js",
    "test:e2e:ui": "playwright test --config=playwright/playwright.config.js --ui",
    "test:e2e:report": "playwright show-report playwright/reports/html"
  }
}
```

## Configure

Copy `playwright/.env.example` → `playwright/.env` and fill in:

```
BASE_URL=https://dev.paymentoptions.com/beta
TEST_USERNAME=...
TEST_PASSWORD=...
TRANSACTION_COUNT=20
STATEMENT_COUNT=20                  # rows to load for the statements suites

# GUEST onboarding suite (tests/onboarding/guest-application.spec.js)
TEST_OTP=1234                       # fixed verification OTP the dev backend accepts
TEST_GUEST_EMAIL_DOMAIN=example.com # domain for the unique per-run sign-up email
```

`fixtures/test-config.js` calls `dotenv.config()` so this file is loaded automatically.
The onboarding suite reuses `TEST_PASSWORD` as the new GUEST account's password and
is skipped when it isn't set; each run signs up a fresh GUEST under a unique email.

## Run

```bash
npm run test:e2e

# bump row count, no code change
TRANSACTION_COUNT=100 npm run test:e2e

# point at staging
BASE_URL=https://staging.example.com npm run test:e2e
```

In CI (`CI=1`), Playwright auto-starts `npm run dev` (see `webServer` block).

## What it asserts per row

For each of the top N rows:

1. **Drawer flow** — click the transaction-ref-id link in the first cell:
   - URL gets `?drawer=details&id=...`, the global drawer renders.
   - Read visibility of `refund` / `capture` / `void` / `dispute` / `editStatus` from the drawer header.
   - Close the drawer (close button → ESC fallback).
2. **Details page flow** — click the row body:
   - Navigates to `/transactions/:id`.
   - Read visibility on the details page.
3. **Cross-surface check** — drawer and details page both consume `selectTransactionActions`; their visibility maps must be identical.
4. **Per-button**: any visible button must also be _enabled_ (catches loading-stuck UI).
5. **Mutual exclusion**: `capture` and `void` cannot both be visible (mirrors selector logic).
6. **Logging**: per row + per surface, with the transaction ref id — failures pinpoint **which** transaction broke and on **which** surface.

## Recommended `data-testid`s in app code

| Component                                                   | testid                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `LoginForm.tsx` username/password/submit                    | `login-username`, `login-password`, `login-submit`                                                                         |
| `DataTable.tsx` outer scroll wrapper                        | `transactions-table`                                                                                                       |
| `TableRow.tsx` `<tr>`                                       | `transactions-row`                                                                                                         |
| `CopyCell.tsx` primary `<span>` (when `onPrimaryClick` set) | `transactions-row-ref-link`                                                                                                |
| `SkeletonRow.tsx` `<tr>`                                    | `skeleton-row`                                                                                                             |
| `TransactionDetailsPage.tsx` action buttons                 | `action-refund`, `action-capture`, `action-void`, `action-dispute`, `action-editStatus`                                    |
| `DasDrawer/index.tsx` panel root                            | `transaction-drawer`                                                                                                       |
| `DrawerTransactionHeader.tsx` action buttons                | `drawer-action-refund`, `drawer-action-capture`, `drawer-action-void`, `drawer-action-dispute`, `drawer-action-editStatus` |

The suite falls back to role + accessible name when testids aren't present, but adding them removes brittleness.

## Finance → Statements suites

`tests/finance/` covers `/finance/statements` (Merchant Statements tab). The
signed-in `TEST_USERNAME` must have visibility of statement data; the action
suite additionally needs approve / edit permission (FINANCE / SETTLEMENT /
SUPPORT / SYSADMIN) — steps self-skip with an annotation when the chip is
hidden or no eligible row exists.

- **`statements-filters.spec.js`** — applies each filter **type** and asserts
  the visible rows agree with it: `text` (Statement ID contains), `multiSelect`
  (DASMID exact, Statement Status), `select` (Recon Status, when present), and
  `dateRange` (Statement Date — functional smoke; exact in-range matching is
  covered by the `serializeForStatements` unit tests). Values are read from the
  live table so each case is self-seeding. Filters reset between cases by a full
  reload (the filter slice isn't persisted; auth is).
- **`statements-actions.spec.js`** — **mutates** statement state: selects one
  eligible row and clicks **APPROVE** (`approve-multiple`) / **WIRED STATUS**
  (`update-wired-status`), then opens a row's edit drawer and changes **STATUS**
  to a valid transition (`approve` endpoint). Each action asserts its POST
  resolves 2xx. Run against a disposable / dev environment.

The custom portaled `Select` / `MultiSelect` / `DateRange` menus render into
`[data-filter-portal="true"]`; the POM drives them there. The das-form STATUS
control in the edit drawer is targeted by `#STATUS` (das-form sets the field
name as the control id).

## Tuning

- `TEST_CONFIG.scroll.maxAttempts` — hard cap on scroll iterations.
- `TEST_CONFIG.scroll.idleAttemptsBeforeStop` — no-progress scrolls tolerated before assuming end of data.
- `retry({ attempts, delayMs })` — per-row retry budget for flaky transitions.
