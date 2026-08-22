// The single fixture barrel. **Specs import `{ test, expect }` from here, never
// from `@playwright/test` directly** — that is what lets a page object arrive as
// a fixture instead of being `new`-ed up in every test body.
//
// Only the fixtures a test actually destructures get built, so a spec that asks
// for `{ hashCardPage }` pays nothing for the others.
//
// Adding a page object: export the class from `pages/<domain>/`, then add a
// one-line fixture below. Nothing else changes.
import { test as base, expect } from '@playwright/test';

import { LoginPage } from '../pages/login/LoginPage.js';
import { ForgotPasswordPage } from '../pages/forgot-password/ForgotPasswordPage.js';
import { OtpVerificationPage } from '../pages/forgot-password/OtpVerificationPage.js';
import { ResetPasswordPage } from '../pages/forgot-password/ResetPasswordPage.js';
import { HashCardPage } from '../pages/hashcard/HashCardPage.js';

/**
 * @typedef {object} Poms
 * @property {LoginPage} loginPage
 * @property {ForgotPasswordPage} forgotPasswordPage
 * @property {OtpVerificationPage} otpVerificationPage
 * @property {ResetPasswordPage} resetPasswordPage
 * @property {HashCardPage} hashCardPage
 */

/** @type {import('@playwright/test').TestType<Poms & import('@playwright/test').PlaywrightTestArgs & import('@playwright/test').PlaywrightTestOptions, import('@playwright/test').PlaywrightWorkerArgs & import('@playwright/test').PlaywrightWorkerOptions>} */
export const test = base.extend({
  // ---- auth -------------------------------------------------------------
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  // ---- forgot password --------------------------------------------------
  forgotPasswordPage: async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
  },
  otpVerificationPage: async ({ page }, use) => {
    await use(new OtpVerificationPage(page));
  },
  resetPasswordPage: async ({ page }, use) => {
    await use(new ResetPasswordPage(page));
  },

  // ---- hashcard ---------------------------------------------------------
  hashCardPage: async ({ page }, use) => {
    await use(new HashCardPage(page));
  },

  // ---- diagnostics ------------------------------------------------------
  // `auto` so it runs without being requested. Diagnostics only — it never
  // fails a test, it just attaches the uncaught page errors to the report so a
  // red run says *why* rather than only *where*.
  pageErrors: [
    async ({ page }, use, testInfo) => {
      /** @type {string[]} */
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await use(errors);
      if (errors.length > 0) {
        await testInfo.attach('page-errors', {
          body: errors.join('\n'),
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
