import { TEST_CONFIG } from '../../fixtures/test-config.js';

/**
 * Step 1 of the forgot-password wizard — `/forgot-password`.
 *
 * Observed against the live dev app (2026-08-22):
 *   * the email field is `#username` (`name="username"`), `type="text"` — **not**
 *     `type="email"`, so the browser contributes no native validation and every
 *     message below comes from the app's own schema;
 *   * its only accessible name is the `Email Address` placeholder — there is no
 *     `<label>`, so `getByLabel` does not match it;
 *   * SUBMIT posts `/api/v1/auth/forgotPassword` and, on 200, swaps the card to
 *     the OTP step at `/reset-password`. For security the app behaves
 *     identically for registered and unregistered addresses;
 *   * validation runs **on submit first**, then live on every change. A blur
 *     alone, before any submit attempt, shows nothing.
 *
 * Errors render as a bare `<p class="text-xs text-red-400">` with no `role`,
 * `id` or `aria-describedby` — hence `validationMessage`'s class hook. Ask the
 * app team for `forgot-password-email` / `forgot-password-error` testids and
 * this whole fallback disappears (see SKILL.md §14).
 */
export class ForgotPasswordPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    this.heading = page.getByText('Forgot your password?', { exact: true });
    this.instruction = page.getByText(/enter your registered email id below/i);

    this.form = page.locator('form');
    this.emailInput = page
      .getByRole('textbox', { name: 'Email Address' })
      .or(page.getByPlaceholder('Email Address'))
      .or(page.locator('#username'))
      .first();
    this.submitButton = page.getByRole('button', { name: 'Submit' });

    // The one error slot on this step. Scoped to the form so the OTP step's
    // "Didn't receive a code?" paragraph can never satisfy it.
    this.validationMessage = this.form.locator('p[class*="text-red-400"]').first();

    this.backToSignInLink = page.getByRole('link', { name: 'Back to Sign In' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  }

  async goto() {
    await this.page.goto(TEST_CONFIG.routes.forgotPassword, { waitUntil: 'domcontentloaded' });
  }

  /** Land on /login and take the "Forgot Password?" link across, the way a real
   *  user reaches this screen. */
  async gotoFromLogin() {
    await this.page.goto(TEST_CONFIG.routes.login, { waitUntil: 'domcontentloaded' });
    await this.page.getByRole('link', { name: 'Forgot Password?' }).click();
    await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.forgotPassword}$`));
  }

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
   * Submit a well-formed address and wait for the request the OTP step depends
   * on. A wait, not a verification — the spec still asserts what landed.
   * @param {string} email
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
