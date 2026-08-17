import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_CONFIG } from '../test-config.js';
import { GuestSignUpPage } from '../../pages/onboarding/GuestSignUpPage.js';

/**
 * JSON-fixture loaders. Kept out of the specs themselves so the spec body
 * reads as a plain Playwright test and the file-system / JSON-parse plumbing
 * lives in one place. `readFileSync` over a JSON import deliberately — a
 * runtime read keeps the fixture editable without touching the loader, and it
 * sidesteps the ESM import-attributes ceremony a JSON import would need.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} relativePath
 * @returns {any}
 */
function readJson(relativePath) {
  const absolute = path.resolve(__dirname, relativePath);
  return JSON.parse(readFileSync(absolute, 'utf-8'));
}

/** @returns {import('./types.js').MerchantOnboardingConfig} */
export function loadMerchantConfig() {
  return readJson('./become-a-merchant.json');
}

/** @returns {import('./types.js').PartnerOnboardingConfig} */
export function loadPartnerConfig() {
  return readJson('./become-a-partner.json');
}

/** Resolve a `SignUpConfig` (or absence thereof) into the inputs the
 *  `GuestSignUpPage.register*` flows need. Substitutes `{{unique}}` in the
 *  email with a per-call base-36 timestamp so re-runs never collide on
 *  "email already registered". Falls back to `TEST_CONFIG.credentials.password`
 *  / `TEST_CONFIG.otp` so a JSON that omits the secrets still runs in CI.
 *
 *  Returned `account.firstName` / `lastName` / `phone` carry hard defaults so
 *  the form has something to submit even when the JSON's `signUp` block is
 *  empty — every field on the public sign-up form is `required`, and a blank
 *  submit would simply error out client-side.
 *
 * @param {import('./types.js').SignUpConfig | undefined} signUp
 * @returns {{ account: import('../../pages/onboarding/GuestSignUpPage.js').SignUpAccount, password: string, otp: string }}
 */
export function resolveSignUp(signUp) {
  const su = signUp ?? {};
  const uniqueToken = Date.now().toString(36).toUpperCase();
  const rawEmail = su.email?.replace(/\{\{unique\}\}/g, uniqueToken);
  return {
    account: {
      firstName: su.firstName ?? 'PO',
      lastName: su.lastName ?? 'Tester',
      phone: su.phone ?? '9012345678',
      email: rawEmail && rawEmail.length > 0 ? rawEmail : GuestSignUpPage.uniqueEmail(),
      businessLocation: su.businessLocation,
      phoneCode: su.phoneCode,
    },
    password: su.password ?? TEST_CONFIG.credentials.password,
    otp: su.otp ?? TEST_CONFIG.otp,
  };
}
