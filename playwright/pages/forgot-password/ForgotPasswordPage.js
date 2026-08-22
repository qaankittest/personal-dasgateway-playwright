import { TEST_CONFIG } from '../../fixtures/test-config.js';

/**
 * Step 1 of the forgot-password wizard — the email-request card at
 * `/forgot-password`.
 *
 * Observed against the live dev app (2026-08-22):
 *   - the email field is `#username` (`name="username"`), `type="text"` — **not**
 *     `type="email"`, so the browser contributes no native validation and every
 *     message this screen shows comes from the app's own schema;
 *   - its only accessible name is the `Email Address` placeholder — there is no
 *     `<label>`, so `getByLabel` does not match it;
 *   - SUBMIT posts `/api/v1/auth/forgotPassword` and, on 200, swaps the card to
 *     the OTP step at `/reset-password`. For security the app behaves
 *     identically for registered and unregistered addresses;
 *   - validation runs **on submit first**, then live on every change. A blur on
 *     its own, before any submit attempt, shows nothing.
 *
 * Errors render as a bare `<p class="text-xs text-red-400">` with no `role`,
 * `id` or `aria-describedby` — hence the class hook on `validationMessage`. Ask
 * the app team for the testids in SKILL.md §14 and that fallback disappears.
 *
 * Locators and actions only — every assertion lives in the spec.
 */
export class ForgotPasswordPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---- static content -------------------------------------------------
    this.heading = page.getByText('Forgot your password?', { exact: true });
    this.instruction = page.getByText(/enter your registered email id below/i);

    // ---- form -----------------------------------------------------------
    this.form = page.locator('form');
    this.emailInput = page
      .getByRole('textbox', { name: 'Email Address' })
      .or(page.getByPlaceholder('Email Address'))
      .or(page.locator('#username'))
      .first();
    this.submitButton = page.getByRole('button', { name: 'Submit' });

    // The card's one error slot. Scoped to the form so the OTP step's
    // "Didn't receive a code?" paragraph can never satisfy it.
    this.validationMessage = this.form.locator('p[class*="text-red-400"]').first();

    // ---- chrome ---------------------------------------------------------
    this.backToSignInLink = page.getByRole('link', { name: 'Back to Sign In' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });

    // The entry point *to* this screen, rendered on Sign In. Declared here
    // rather than reached for inline in `gotoFromLogin()`, and owned here
    // rather than on the login POM so this page object stays self-contained.
    this.signInEntryLink = page.getByRole('link', { name: 'Forgot Password?' });
  }

  // ---- navigation -------------------------------------------------------

  /** Open the card directly. */
  async goto() {
    await this.page.goto(TEST_CONFIG.routes.forgotPassword, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** Land on /login and take the "Forgot Password?" link across, the way a real
   *  user reaches this screen. */
  async gotoFromLogin() {
    await this.page.goto(TEST_CONFIG.routes.login, { waitUntil: 'domcontentloaded' });
    await this.signInEntryLink.click();
    await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.forgotPassword}$`));
    await this.waitForReady();
  }

  /** Readiness gate — a wait, not a verification, so it uses `waitFor()` rather
   *  than `expect()`. The spec still states what must be true. */
  async waitForReady() {
    await this.emailInput.waitFor({ state: 'visible' });
  }

  // ---- actions ----------------------------------------------------------

  /** @param {string} email */
  async fillEmail(email) {
    await this.emailInput.fill(email);
  }

  /** Empty the field and blur it, so the app's revalidation fires. */
  async clearEmail() {
    await this.emailInput.fill('');
    await this.emailInput.blur();
  }

  async submit() {
    await this.submitButton.click();
  }

  /**
   * Fill the address and submit, waiting for the request the OTP step depends
   * on. The response is returned rather than checked — this is the "wait for an
   * API the UI depends on" pattern from SKILL.md §6, and the spec asserts on it.
   *
   * @param {string} email
   * @returns {Promise<import('@playwright/test').Response>}
   */
  async requestOtp(email) {
    await this.fillEmail(email);
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('/auth/forgotPassword') && r.request().method() === 'POST',
      ),
      this.submit(),
    ]);
    return response;
  }
}
