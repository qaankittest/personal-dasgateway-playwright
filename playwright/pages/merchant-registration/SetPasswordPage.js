import { TEST_CONFIG } from '../../fixtures/test-config.js';

/** `POST` issued by CREATE ACCOUNT — the call that actually creates the merchant. */
export const REGISTER_ENDPOINT = '/onboarding/register';

/**
 * Step 3 of merchant registration — "You're on the final step of registration!".
 *
 * Observed against the live dev app (2026-08-23):
 *   - `#password` and `#confirmPassword` are real inputs (`type=password`,
 *     placeholders "Create Password *" / "Confirm New Password *"), each with
 *     its own eye toggle whose accessible name flips between "Show password"
 *     and "Hide password" — the toggles are independent;
 *   - `#agree` is a native checkbox; its label carries "Terms and Conditions"
 *     and "Privacy Policy" as **same-tab** links (`/beta/terms-condition`,
 *     `/beta/privacy-policy`) — neither carries `target="_blank"`;
 *   - "Password Requirements" is a headlessui disclosure, collapsed by default,
 *     `aria-expanded` flipping on each click;
 *   - CREATE ACCOUNT is **never `disabled`**. Submitting anything the app
 *     rejects renders one generic message — "Password is required" — whatever
 *     the actual fault is, plus "You must accept the Terms and Conditions"
 *     while the box is unticked;
 *   - a successful submit posts `/onboarding/register` and lands on
 *     `/onboarding?step=business`, already authenticated as the new merchant.
 *
 * Locators and actions only — every assertion lives in the spec.
 */
export class SetPasswordPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---- static content -------------------------------------------------
    this.heading = page.getByText("You're on the final step of registration!", { exact: true });
    this.subText = page.getByText("Set your account's password.", { exact: true });

    // ---- form -----------------------------------------------------------
    this.form = page.locator('form');
    this.passwordInput = page.locator('#password');
    this.confirmPasswordInput = page.locator('#confirmPassword');
    this.consentCheckbox = page.locator('#agree');
    this.consentText = page.getByText(/i agree with the terms and conditions and privacy policy/i);
    this.submitButton = page.getByRole('button', { name: /create account/i });

    // ---- password requirements disclosure ---------------------------------
    this.requirementsToggle = page.getByRole('button', { name: /password requirements/i });

    // ---- eye toggles ------------------------------------------------------
    // Two identical pairs — scoped to their own field's wrapper so "the first
    // one" never silently means "the other field's".
    this.showPasswordButton = this.#toggleFor('#password', 'Show password');
    this.hidePasswordButton = this.#toggleFor('#password', 'Hide password');
    this.showConfirmPasswordButton = this.#toggleFor('#confirmPassword', 'Show password');
    this.hideConfirmPasswordButton = this.#toggleFor('#confirmPassword', 'Hide password');

    // ---- validation -------------------------------------------------------
    this.validationMessages = this.form.locator('p[class*="text-red"]');

    // ---- chrome -----------------------------------------------------------
    this.termsLink = page.getByRole('link', { name: 'Terms and Conditions' });
    this.privacyLink = page.getByRole('link', { name: 'Privacy Policy' });
    this.backToStartLink = page.getByRole('link', { name: 'Back to Start' });
    this.signInLink = page.getByRole('link', { name: 'Sign in here' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  }

  // ---- private ----------------------------------------------------------

  /** The eye toggle that belongs to one field. The button is a sibling inside
   *  the field's own wrapper, so anchoring on the input keeps the two pairs
   *  apart without an `.nth()` on a page-wide list.
   * @param {string} fieldSelector
   * @param {string} accessibleName
   * @returns {import('@playwright/test').Locator} */
  #toggleFor(fieldSelector, accessibleName) {
    return this.page
      .locator(`${fieldSelector} ~ button[aria-label="${accessibleName}"]`)
      .or(
        this.page
          .locator(`div:has(> ${fieldSelector})`)
          .last()
          .getByRole('button', { name: accessibleName }),
      )
      .first();
  }

  // ---- dynamic locators -------------------------------------------------

  /** @param {string|RegExp} text @returns {import('@playwright/test').Locator} */
  message(text) {
    return this.validationMessages.filter({ hasText: text }).first();
  }

  /** One line of the expanded requirements list.
   * @param {string} text @returns {import('@playwright/test').Locator} */
  requirement(text) {
    return this.page.getByText(text, { exact: false }).first();
  }

  // ---- navigation -------------------------------------------------------

  /** Readiness gate — a wait, not a verification. */
  async waitForReady() {
    await this.passwordInput.waitFor({ state: 'visible' });
  }

  // ---- actions ----------------------------------------------------------

  /**
   * @param {string} password
   * @param {string} [confirmPassword] Defaults to `password`.
   */
  async setPassword(password, confirmPassword = password) {
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  async acceptTerms() {
    await this.consentCheckbox.check();
  }

  async toggleRequirements() {
    await this.requirementsToggle.click();
  }

  /** Submit without waiting — for the cases the app rejects client-side. */
  async createAccount() {
    await this.submitButton.click();
  }

  /**
   * Submit and capture the registration call, so a spec asserts the account was
   * really created rather than inferring it from the redirect.
   * @returns {Promise<import('@playwright/test').Response>}
   */
  async createAccountAndWaitForRegister() {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes(REGISTER_ENDPOINT) && r.request().method() === 'POST',
      ),
      this.submitButton.click(),
    ]);
    return response;
  }

  async backToStart() {
    await this.backToStartLink.click();
    await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.chooseAccountType}$`));
  }
}
