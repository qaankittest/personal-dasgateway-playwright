import { TEST_CONFIG } from '../../fixtures/test-config.js';

/**
 * Step 3 of the forgot-password wizard — the new-password card at
 * `/reset-password`, shown once VERIFY is clicked on the OTP card.
 *
 * Observed against the live dev app (2026-08-22):
 *   * `#Password` / `#ConfirmPassword`, both `type="password"`, named only by
 *     their `Enter New Password` / `Confirm New Password` placeholders;
 *   * each field carries its own eye toggle whose accessible name flips between
 *     `Show password` and `Hide password`. Two identically named buttons exist,
 *     so each one is scoped to the `div` that directly wraps its input;
 *   * RESET PASSWORD posts `/api/v1/auth/forgotPasswordVerify`; a wrong OTP
 *     comes back 400 and renders "Invalid OTP provided." above the fields;
 *   * field errors are bare `<p>`s with no `role`/`id`. The new-password error
 *     is `text-red-400`, the confirm-password error `text-[#ff6363]`, and the
 *     form-level OTP error `text-center … text-red-400`.
 *
 * The messages themselves live in `data/forgot-password.js` — a page object
 * holds no test data.
 */
export class ResetPasswordPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Scoped to the paragraph: the submit button carries the same text, so a
    // bare `getByText('Reset Password')` is ambiguous under strict mode.
    this.heading = page.locator('p').filter({ hasText: /^Reset Password$/ });

    this.form = page.locator('form');
    this.newPasswordInput = page
      .getByRole('textbox', { name: 'Enter New Password' })
      .or(page.getByPlaceholder('Enter New Password'))
      .or(page.locator('#Password'))
      .first();
    this.confirmPasswordInput = page
      .getByRole('textbox', { name: 'Confirm New Password' })
      .or(page.getByPlaceholder('Confirm New Password'))
      .or(page.locator('#ConfirmPassword'))
      .first();

    // Scope each toggle to the wrapper that directly holds its input — both
    // buttons share the accessible name, so an unscoped locator is ambiguous.
    this.newPasswordToggle = this.#toggleFor('Password');
    this.confirmPasswordToggle = this.#toggleFor('ConfirmPassword');

    this.submitButton = page.getByRole('button', { name: 'Reset Password' });

    // Every error the card can render, in DOM order: new-password, then
    // confirm-password, then the form-level API error.
    this.validationMessages = this.form.locator('p[class*="text-red-400"], p[class*="ff6363"]');

    this.backToSignInLink = page.getByRole('link', { name: 'Back to Sign In' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  }

  /**
   * The eye toggle sitting beside one password input.
   * @param {'Password'|'ConfirmPassword'} inputId
   */
  #toggleFor(inputId) {
    return this.page
      .locator(`div:has(> input#${inputId})`)
      .getByRole('button', { name: /^(Show|Hide) password$/ });
  }

  /** Message text rendered anywhere on the card — lets a spec assert presence
   *  and wording in one web-first check.
   * @param {string|RegExp} text
   */
  message(text) {
    return this.form.locator('p').filter({ hasText: text }).first();
  }

  /** @param {string} password */
  async fillNewPassword(password) {
    await this.newPasswordInput.fill(password);
  }

  /** @param {string} password */
  async fillConfirmPassword(password) {
    await this.confirmPasswordInput.fill(password);
  }

  /**
   * @param {string} newPassword
   * @param {string} [confirmPassword] Defaults to `newPassword`.
   */
  async fillPasswords(newPassword, confirmPassword = newPassword) {
    await this.fillNewPassword(newPassword);
    await this.fillConfirmPassword(confirmPassword);
  }

  async submit() {
    await this.submitButton.click();
  }

  /**
   * Submit and wait for the verify call, so the spec asserts against a settled
   * response instead of racing the render.
   */
  async submitAndWaitForVerify() {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('/auth/forgotPasswordVerify') && r.request().method() === 'POST',
      ),
      this.submit(),
    ]);
    return response;
  }

  /** Paste the clipboard into a field with the platform's own shortcut, so the
   *  app's `onPaste` handling (if any) is exercised for real.
   * @param {import('@playwright/test').Locator} input
   */
  async pasteInto(input) {
    await input.click();
    await this.page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+KeyV' : 'Control+KeyV',
    );
  }

  /** Select a field's whole value and copy it with the platform shortcut.
   * @param {import('@playwright/test').Locator} input
   */
  async copyFrom(input) {
    await input.click();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await this.page.keyboard.press(`${modifier}+KeyA`);
    await this.page.keyboard.press(`${modifier}+KeyC`);
  }

  /** Direct hit on the wizard URL — always lands on the OTP card, never here.
   *  Exposed so a spec can prove an abandoned reset cannot be resumed. */
  async gotoWizardUrl() {
    await this.page.goto(TEST_CONFIG.routes.resetPassword, { waitUntil: 'domcontentloaded' });
  }
}
