import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * JSON-fixture loader for the products / Pay-By-Link e2e. Kept out of the
 * spec body to mirror the `fixtures/onboarding/load.js` shape — the spec
 * stays a plain Playwright test and the file-system plumbing lives here.
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

/** @returns {import('./types.js').PblOrderConfig} */
export function loadPayByLinkConfig() {
  return readJson('./pay-by-link.json');
}

/** @returns {import('./types.js').SubscriptionConfig} */
export function loadSubscriptionConfig() {
  return readJson('./subscription.json');
}
