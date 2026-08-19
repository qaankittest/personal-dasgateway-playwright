// Pure builders — plain objects, no network, no `page`.
//
// Per the data-factory skill: valid by default, every field overridable, and
// `overrides` spread **last** so a test can change anything. A test that cares
// about a value passes it explicitly, so the value is visible in the test.
//
// Creators that actually hit an API belong in a sibling `*Factory.js`; keep the
// two apart. There is no API-seeding factory yet because this suite drives the
// portal end-to-end through the UI — add one here when a spec needs a
// prerequisite record it isn't itself testing the creation of.
import { TEST_CONFIG } from '../fixtures/test-config.js';
import { uniqueEmail } from './uniq.js';

/** Fresh GUEST sign-up email — unique per call, on the configured test domain. */
export function guestEmail() {
  return uniqueEmail('po-e2e-guest', TEST_CONFIG.guestEmailDomain);
}

/**
 * A complete, valid GUEST sign-up account.
 *
 * The phone number is a fixed valid value rather than a generated one: the
 * sign-up form validates it against a country format, and a random digit
 * string fails that check for reasons unrelated to the test. The email is the
 * field the backend actually enforces uniqueness on, and it is unique per call.
 *
 * @param {Partial<import('../pages/onboarding/GuestSignUpPage.js').SignUpAccount>} [overrides]
 * @returns {import('../pages/onboarding/GuestSignUpPage.js').SignUpAccount}
 */
export function buildGuestAccount(overrides = {}) {
  return {
    firstName: 'PO',
    lastName: 'Tester',
    phone: '9012345678',
    email: guestEmail(),
    ...overrides,
  };
}
