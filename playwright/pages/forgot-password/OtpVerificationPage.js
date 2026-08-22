import { TEST_CONFIG } from '../../fixtures/test-config.js';

/**
 * Step 2 of the forgot-password wizard — the OTP card at `/reset-password`.
 *
 * Observed against the live dev app (2026-08-22):
 *   - six single-character boxes, each `maxlength="1" inputmode="numeric"`,
 *     whose only accessible names are `Digit 1` … `Digit 6`;
 *   - a digit auto-advances focus to the next box; letters and symbols are
 *     rejected outright and never reach the box's value;
 *   - a keystroke on an **already-filled** box is dropped — the original digit
 *     stays put, it is not replaced;
 *   - Backspace on a **filled** box clears it and keeps focus; Backspace on an
 *     **empty** box clears the previous box and moves focus back to it;
 *   - VERIFY is `disabled` until all six boxes hold a value;
 *   - VERIFY does **not** check the code — it always advances to the password
 *     card, issuing no request at all. The OTP is only validated when the new
 *     password is submitted, so a wrong code surfaces as "Invalid OTP provided."
 *     on `ResetPasswordPage`;
 *   - "Resend OTP" re-posts the same `/api/v1/auth/forgotPassword` endpoint the
 *     email step used.
 *
 * The OTP card and the password card share `/reset-password`, so readiness is a
 * marker element rather than a navigation. A cold hit on that route always
 * renders this card.
 *
 * Locators and actions only — every assertion lives in the spec.
 */
export class OtpVerificationPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---- static content -------------------------------------------------
    this.heading = page.getByText('Enter OTP to verify your account', { exact: true });
    this.instruction = page.getByText(/verification code sent to your registered email id/i);

    // ---- form -----------------------------------------------------------
    this.form = page.locator('form');
    this.otpInputs = page.getByRole('textbox', { name: /^Digit \d$/ });
    this.verifyButton = page.getByRole('button', { name: 'Verify' });
    this.resendOtpButton = page.getByRole('button', { name: 'Resend OTP' });
    this.resendPrompt = page.getByText("Didn't receive a code?");

    // ---- chrome ---------------------------------------------------------
    this.backToSignInLink = page.getByRole('link', { name: 'Back to Sign In' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  }

  // ---- dynamic locators -------------------------------------------------

  /**
   * One OTP box, 1-indexed to match its accessible name.
   * @param {number} position 1–6
   * @returns {import('@playwright/test').Locator}
   */
  digit(position) {
    return this.page.getByRole('textbox', { name: `Digit ${position}` });
  }

  // ---- navigation -------------------------------------------------------

  /** A cold hit on `/reset-password` renders this card, with no reset in flight. */
  async goto() {
    await this.page.goto(TEST_CONFIG.routes.resetPassword, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /** Readiness gate — a wait, not a verification. */
  async waitForReady() {
    await this.digit(1).waitFor({ state: 'visible' });
  }

  // ---- actions ----------------------------------------------------------

  /** Put the caret in the first box, ready for `appendDigit`. */
  async focusFirstDigit() {
    await this.digit(1).click();
  }

  /**
   * Type one more character into whichever box currently holds focus. Lets a
   * spec walk the code one digit at a time and assert VERIFY's state after each
   * — the app moves focus itself, so the spec never has to.
   * @param {string} character
   */
  async appendDigit(character) {
    await this.page.keyboard.type(character);
  }

  /**
   * Type the code box by box from the first, letting the app's own auto-advance
   * move focus — `fill()` per box would bypass the keystroke handling this
   * screen relies on. Accepts partial codes so a spec can prove VERIFY stays
   * disabled at 1–5 digits.
   *
   * Expects an empty set of boxes: a filled box swallows further keystrokes.
   * @param {string} code
   */
  async enterOtp(code) {
    await this.focusFirstDigit();
    await this.appendDigit(code);
  }

  /**
   * Type one character into a specific box, focusing it first — used to prove
   * non-numeric input is rejected, and that a filled box takes no more.
   * @param {number} position 1–6
   * @param {string} character
   */
  async typeIntoDigit(position, character) {
    await this.digit(position).click();
    await this.page.keyboard.type(character);
  }

  /** @param {number} [times] */
  async pressBackspace(times = 1) {
    for (let i = 0; i < times; i += 1) {
      await this.page.keyboard.press('Backspace');
    }
  }

  /** Submit the code. Issues no request — the app defers the check to the
   *  final reset call — so this always lands on the password card. */
  async verify() {
    await this.verifyButton.click();
  }

  /** Go back to the Sign In screen, abandoning the reset. */
  async backToSignIn() {
    await this.backToSignInLink.click();
  }

  /**
   * Request a fresh code, waiting for the call the new OTP depends on. The
   * response is returned for the spec to assert on.
   * @returns {Promise<import('@playwright/test').Response>}
   */
  async resendOtp() {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('/auth/forgotPassword') && r.request().method() === 'POST',
      ),
      this.resendOtpButton.click(),
    ]);
    return response;
  }
}
