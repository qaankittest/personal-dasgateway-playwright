// The single fixture barrel. **Specs import `{ test, expect }` from here, never
// from `@playwright/test` directly** — that is what lets a page object arrive as
// a fixture instead of being `new`-ed up in every test body.
//
// Only the fixtures a test actually destructures get built, so a spec that asks
// for `{ transactionsPage }` pays nothing for the other seventeen.
//
// Adding a page object: export the class from `pages/<domain>/`, then add a
// one-line fixture below. Nothing else changes.
import { test as base, expect } from '@playwright/test';

import { LoginPage } from '../pages/auth/LoginPage.js';
import { HashCardPage } from '../pages/hashcard/HashCardPage.js';
import { MerchantsPage } from '../pages/merchants/MerchantsPage.js';
import { MerchantDetailsPage } from '../pages/merchants/MerchantDetailsPage.js';
import { MerchantDrawerPage } from '../pages/merchants/MerchantDrawerPage.js';
import { GuestSignUpPage } from '../pages/onboarding/GuestSignUpPage.js';
import { MerchantRegistrationPage } from '../pages/onboarding/MerchantRegistrationPage.js';
import { ProductsListPage } from '../pages/products/ProductsListPage.js';
import { PblOrdersPage } from '../pages/products/PblOrdersPage.js';
import { PblCreateDrawer } from '../pages/products/PblCreateDrawer.js';
import { SubscriptionProductPage } from '../pages/products/SubscriptionProductPage.js';
import { SubscriptionPlanDrawer } from '../pages/products/SubscriptionPlanDrawer.js';
import { SubscriptionDrawer } from '../pages/products/SubscriptionDrawer.js';
import { TransactionsPage } from '../pages/transactions/TransactionsPage.js';
import { TransactionDetailsPage } from '../pages/transactions/TransactionDetailsPage.js';
import { TransactionDrawerPage } from '../pages/transactions/TransactionDrawerPage.js';

/**
 * @typedef {object} Poms
 * @property {LoginPage} loginPage
 * @property {HashCardPage} hashCardPage
 * @property {MerchantsPage} merchantsPage
 * @property {MerchantDetailsPage} merchantDetailsPage
 * @property {MerchantDrawerPage} merchantDrawer
 * @property {GuestSignUpPage} guestSignUpPage
 * @property {MerchantRegistrationPage} merchantRegistrationPage
 * @property {ProductsListPage} productsListPage
 * @property {PblOrdersPage} pblOrdersPage
 * @property {PblCreateDrawer} pblCreateDrawer
 * @property {SubscriptionProductPage} subscriptionProductPage
 * @property {SubscriptionPlanDrawer} subscriptionPlanDrawer
 * @property {SubscriptionDrawer} subscriptionDrawer
 * @property {TransactionsPage} transactionsPage
 * @property {TransactionDetailsPage} transactionDetailsPage
 * @property {TransactionDrawerPage} transactionDrawer
 */

/** @type {import('@playwright/test').TestType<Poms & import('@playwright/test').PlaywrightTestArgs & import('@playwright/test').PlaywrightTestOptions, import('@playwright/test').PlaywrightWorkerArgs & import('@playwright/test').PlaywrightWorkerOptions>} */
export const test = base.extend({
  // ---- auth -------------------------------------------------------------
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  // ---- hashcard ---------------------------------------------------------
  hashCardPage: async ({ page }, use) => {
    await use(new HashCardPage(page));
  },

  // ---- merchants --------------------------------------------------------
  merchantsPage: async ({ page }, use) => {
    await use(new MerchantsPage(page));
  },
  merchantDetailsPage: async ({ page }, use) => {
    await use(new MerchantDetailsPage(page));
  },
  merchantDrawer: async ({ page }, use) => {
    await use(new MerchantDrawerPage(page));
  },

  // ---- onboarding -------------------------------------------------------
  guestSignUpPage: async ({ page }, use) => {
    await use(new GuestSignUpPage(page));
  },
  merchantRegistrationPage: async ({ page }, use) => {
    await use(new MerchantRegistrationPage(page));
  },

  // ---- products ---------------------------------------------------------
  productsListPage: async ({ page }, use) => {
    await use(new ProductsListPage(page));
  },
  pblOrdersPage: async ({ page }, use) => {
    await use(new PblOrdersPage(page));
  },
  pblCreateDrawer: async ({ page }, use) => {
    await use(new PblCreateDrawer(page));
  },
  subscriptionProductPage: async ({ page }, use) => {
    await use(new SubscriptionProductPage(page));
  },
  subscriptionPlanDrawer: async ({ page }, use) => {
    await use(new SubscriptionPlanDrawer(page));
  },
  subscriptionDrawer: async ({ page }, use) => {
    await use(new SubscriptionDrawer(page));
  },

  // ---- transactions -----------------------------------------------------
  transactionsPage: async ({ page }, use) => {
    await use(new TransactionsPage(page));
  },
  transactionDetailsPage: async ({ page }, use) => {
    await use(new TransactionDetailsPage(page));
  },
  transactionDrawer: async ({ page }, use) => {
    await use(new TransactionDrawerPage(page));
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
