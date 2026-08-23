import { TEST_CONFIG } from '../../fixtures/test-config.js';

/**
 * Step 0 of merchant registration — the "Let's Begin Your Journey" card at
 * `/choose-account-type`, reached from "Create an Account" on Sign In.
 *
 * Observed against the live dev app (2026-08-23):
 *   - the screen is entirely `<p>` copy plus two `<button>` cards; there is no
 *     heading element and no `data-testid` anywhere, so text and role are the
 *     only stable hooks;
 *   - "Register as a Merchant" / "Register as a Partner" are **buttons**, not
 *     links — they push client state as well as navigating, which is why the
 *     next screen cannot be opened by URL (see `MerchantAccountPage.goto`);
 *   - "Sign in here" is a real `<a href="/beta/login">`.
 *
 * Locators and actions only — every assertion lives in the spec.
 */
export class AccountTypePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---- static content -------------------------------------------------
    this.heading = page.getByText("Let's Begin Your Journey", { exact: true });
    this.subText = page.getByText(/tell us how you wish to connect with payment options/i);

    // ---- the two entry cards --------------------------------------------
    this.merchantCard = page.getByRole('button', { name: 'Register as a Merchant' });
    this.partnerCard = page.getByRole('button', { name: 'Register as a Partner' });

    // ---- chrome ---------------------------------------------------------
    this.haveAccountText = page.getByText('Already have an account?');
    this.signInLink = page.getByRole('link', { name: 'Sign in here' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });

    // The entry point *to* this screen, rendered on Sign In. Owned here rather
    // than on the login POM so this page object stays self-contained.
    this.loginEntryLink = page.getByRole('link', { name: 'Create an Account' });
  }

  // ---- navigation -------------------------------------------------------

  /** Open the card directly. */
  async goto() {
    await this.page.goto(TEST_CONFIG.routes.chooseAccountType, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** Land on /login and take the "Create an Account" link across, the way a
   *  real user reaches this screen. */
  async gotoFromLogin() {
    await this.page.goto(TEST_CONFIG.routes.login, { waitUntil: 'domcontentloaded' });
    await this.loginEntryLink.click();
    await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.chooseAccountType}$`));
    await this.waitForReady();
  }

  /** Readiness gate — a wait, not a verification. */
  async waitForReady() {
    await this.merchantCard.waitFor({ state: 'visible' });
  }

  // ---- actions ----------------------------------------------------------

  /** Take the merchant branch. Leaves the caller on the account form. */
  async chooseMerchant() {
    await this.merchantCard.click();
    await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.signUp}$`));
  }

  /** Take the partner branch — asserted against only to prove the merchant
   *  card does *not* land here. */
  async choosePartner() {
    await this.partnerCard.click();
  }

  async backToSignIn() {
    await this.signInLink.click();
    await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.login}$`));
  }
}
