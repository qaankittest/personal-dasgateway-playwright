import { TEST_CONFIG } from '../../fixtures/test-config.js';

/** Ctrl on Windows / Linux, Cmd on macOS — for the copy and paste shortcuts. */
const MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control';

/**
 * Step 3 of the forgot-password wizard — the new-password card at
 * `/reset-password`, shown once VERIFY is clicked on the OTP card.
 *
 * Observed against the live dev app (2026-08-22):
 *   - `#Password` / `#ConfirmPassword`, both `type="password"`, named only by
 *     their `Enter New Password` / `Confirm New Password` placeholders;
 *   - each field carries its own eye toggle whose accessible name flips between
 *     `Show password` and `Hide password`. Two identically named buttons exist,
 *     so each is scoped to the `div` that directly wraps its input;
 *   - RESET PASSWORD posts `/api/v1/auth/forgotPasswordVerify`; a wrong OTP
 *     comes back 400 and renders "Invalid OTP provided." above the fields;
 *   - errors are bare `<p>`s with no `role` or `id`. The new-password error is
 *     `text-red-400`, the confirm-password error `text-[#ff6363]`, and the
 *     form-level OTP error `text-center … text-red-400`;
 *   - no `copy`, `cut` or `contextmenu` guard is installed on either field.
 *
 * The expected copy lives in `data/forgot-password.js` — a page object holds no
 * test data. Locators and actions only; every assertion lives in the spec.
 */
export class ResetPasswordPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---- static content -------------------------------------------------
    // Scoped to the paragraph: the submit button carries the same text, so a
    // bare `getByText('Reset Password')` is ambiguous under strict mode.
    this.heading = page.locator('p').filter({ hasText: /^Reset Password$/ });

    // ---- form -----------------------------------------------------------
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

    // Both eye toggles share one accessible name, so each is scoped to the
    // wrapper that directly holds its own input — otherwise strict mode has two
    // candidates and neither is addressable.
    this.newPasswordToggle = page
      .locator('div:has(> input#Password)')
      .getByRole('button', { name: /^(Show|Hide) password$/ });
    this.confirmPasswordToggle = page
      .locator('div:has(> input#ConfirmPassword)')
      .getByRole('button', { name: /^(Show|Hide) password$/ });

    this.submitButton = page.getByRole('button', { name: 'Reset Password' });

    // Every error the card can render, in DOM order: new-password, then
    // confirm-password, then the form-level API error.
    this.validationMessages = this.form.locator('p[class*="text-red-400"], p[class*="ff6363"]');

    // ---- chrome ---------------------------------------------------------
    this.backToSignInLink = page.getByRole('link', { name: 'Back to Sign In' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  }

  // ---- dynamic locators -------------------------------------------------

  /**
   * The message carrying a given text, wherever on the card it renders. Lets a
   * spec assert presence and wording in one web-first check.
   * @param {string|RegExp} text
   * @returns {import('@playwright/test').Locator}
   */
  message(text) {
    return this.form.locator('p').filter({ hasText: text }).first();
  }

  // ---- navigation -------------------------------------------------------

  /**
   * Hit the wizard URL directly. This always lands on the **OTP** card, never
   * here — exposed so a spec can prove an abandoned reset cannot be resumed.
   */
  async gotoWizardUrl() {
    await this.page.goto(TEST_CONFIG.routes.resetPassword, { waitUntil: 'domcontentloaded' });
  }

  /** Readiness gate — a wait, not a verification. */
  async waitForReady() {
    await this.newPasswordInput.waitFor({ state: 'visible' });
  }

  // ---- actions ----------------------------------------------------------

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

  /** Flip the new-password field between masked and plain text. */
  async toggleNewPasswordVisibility() {
    await this.newPasswordToggle.click();
  }

  /** Flip the confirm-password field between masked and plain text. */
  async toggleConfirmPasswordVisibility() {
    await this.confirmPasswordToggle.click();
  }

  async submit() {
    await this.submitButton.click();
  }

  /**
   * Submit and wait for the verify call, so the spec asserts against a settled
   * response instead of racing the render. The response is returned, not
   * checked.
   * @returns {Promise<import('@playwright/test').Response>}
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

  /** Select the new-password field's whole value and copy it. */
  async copyNewPassword() {
    await this.newPasswordInput.click();
    await this.page.keyboard.press(`${MODIFIER}+KeyA`);
    await this.page.keyboard.press(`${MODIFIER}+KeyC`);
  }

  /** Paste the clipboard into Enter New Password with the real shortcut, so the
   *  app's own `onPaste` handling (if any) is exercised. */
  async pasteIntoNewPassword() {
    await this.newPasswordInput.click();
    await this.page.keyboard.press(`${MODIFIER}+KeyV`);
  }

  /** Paste the clipboard into Confirm New Password. */
  async pasteIntoConfirmPassword() {
    await this.confirmPasswordInput.click();
    await this.page.keyboard.press(`${MODIFIER}+KeyV`);
  }

  /** Go back to the Sign In screen, abandoning the reset. */
  async backToSignIn() {
    await this.backToSignInLink.click();
  }
}
