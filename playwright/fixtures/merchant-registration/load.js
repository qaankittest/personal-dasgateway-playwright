// JSON-fixture loader for the merchant-registration suite.
//
// Same contract as `fixtures/onboarding/load.js`: `readFileSync` + `JSON.parse`
// rather than a JSON import, so the fixture stays editable without touching the
// loader and no ESM import-attributes ceremony is needed.
//
// Secrets never live in the JSON. The password the wizard sets on the new
// account comes from `TEST_CONFIG.credentials.password`, and the verification
// code from `TEST_CONFIG.otp` (the dev backend accepts a fixed OTP) — the JSON
// carries only the *invalid* values, which are safe to commit.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_CONFIG } from '../test-config.js';
import { uniqueToken } from '../../data/uniq.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} relativePath
 * @returns {any}
 */
function readJson(relativePath) {
  return JSON.parse(readFileSync(path.resolve(__dirname, relativePath), 'utf-8'));
}

/** The raw fixture — copy, invalid data sets and the account template.
 *  @returns {import('./types.js').MerchantRegistrationFixture} */
export function loadMerchantRegistration() {
  return readJson('./merchant-account.json');
}

/**
 * A ready-to-submit account. `{{unique}}` in the fixture's email is replaced
 * with a per-call `uniqueToken()`, so re-runs never collide on an address the
 * backend has already registered.
 *
 * @param {Partial<import('./types.js').MerchantAccount>} [overrides]
 * @returns {import('./types.js').MerchantAccount}
 */
export function buildMerchantAccount(overrides = {}) {
  const { account } = loadMerchantRegistration();
  return {
    ...account,
    email: account.email.replace(/\{\{unique\}\}/g, uniqueToken().toLowerCase()),
    ...overrides,
  };
}

/** The Hong Kong market fixture — the same wizard, driven with HK data.
 *  @returns {import('./types.js').HongKongRegistrationFixture} */
export function loadHongKongRegistration() {
  return readJson('./hong-kong.json');
}

/**
 * A ready-to-submit Hong Kong account, with the same `{{unique}}` email
 * substitution as `buildMerchantAccount`.
 *
 * @param {Partial<import('./types.js').MerchantAccount>} [overrides]
 * @returns {import('./types.js').MerchantAccount}
 */
export function buildHongKongAccount(overrides = {}) {
  const { account } = loadHongKongRegistration();
  return {
    ...account,
    email: account.email.replace(/\{\{unique\}\}/g, uniqueToken().toLowerCase()),
    ...overrides,
  };
}

/** The password the wizard sets on the freshly created account. Env-supplied,
 *  never committed. @returns {string} */
export function newAccountPassword() {
  return TEST_CONFIG.credentials.password;
}

/** The verification code the dev backend accepts. @returns {string} */
export function verificationOtp() {
  return TEST_CONFIG.otp;
}
