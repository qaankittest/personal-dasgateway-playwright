import { TEST_CONFIG } from '../../fixtures/test-config.js';

/** Calls this card issues. Exported so specs assert the request, not just the UI. */
export const VERIFY_OTP_ENDPOINT = '/onboarding/verify-otp';
export const RESEND_OTP_ENDPOINT = '/onboarding/resent-otp';

/**
 * Step 2 of merchant registration — "Enter OTP to verify your account".
 *
 * Observed against the live dev app (2026-08-23):
 *   - the card swaps in over `/onboarding/sign-up`; the URL does not change, so
 *     readiness is a marker element rather than a navigation;
 *   - **four** boxes (the forgot-password wizard uses six), each an
 *     `<input type="text" maxlength="1" inputmode="numeric">` carrying no `id`
 *     or `name` but a real `aria-label` — `Digit 1`…`Digit 4` — which is what
 *     the locators lead with; `input[maxlength="1"]` is kept as the fallback;
 *   - clearing a box **shifts the digits after it left**, so a box-by-box
 *     wipe has to run back to front (see `clearOtp`);
 *   - a digit auto-advances focus to the next box; letters and symbols never
 *     reach the box's value; Backspace clears the box in focus;
 *   - VERIFY is `disabled` until all four boxes hold a value;
 *   - VERIFY **does** check the code — `POST /onboarding/verify-otp` — but a
 *     wrong code renders no message at all; the card simply stays put;
 *   - "Resend OTP" posts `/onboarding/resent-otp` (the backend's spelling) and
 *     likewise renders no confirmation.
 *
 * Locators and actions only — every assertion lives in the spec.
 */
export class MerchantOtpPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---- static content -------------------------------------------------
    this.heading = page.getByText('Enter OTP to verify your account', { exact: true });
    this.instruction = page.getByText(/please enter the verification code sent to/i);

    // ---- form -----------------------------------------------------------
    this.form = page.locator('form');
    this.otpInputs = page
      .getByRole('textbox', { name: /^Digit \d$/ })
      .or(this.form.locator('input[maxlength="1"]'));
    this.verifyButton = page.getByRole('button', { name: 'Verify' });
    this.resendPrompt = page.getByText("Didn't receive a code?");
    this.resendButton = page.getByRole('button', { name: 'Resend OTP' });

    // ---- chrome ---------------------------------------------------------
    this.backToStartLink = page.getByRole('link', { name: 'Back to Start' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  }

  // ---- dynamic locators -------------------------------------------------

  /**
   * One OTP box, 1-indexed to match its accessible name.
   * @param {number} position 1–4
   * @returns {import('@playwright/test').Locator}
   */
  digit(position) {
    return this.page
      .getByRole('textbox', { name: `Digit ${position}` })
      .or(this.form.locator('input[maxlength="1"]').nth(position - 1))
      .first();
  }

  /** The address the card echoes back, as its own element, so a spec can assert
   *  the exact string rather than a substring of the whole card.
   * @param {string} email
   * @returns {import('@playwright/test').Locator} */
  echoedEmail(email) {
    return this.page.getByText(email, { exact: true });
  }

  // ---- navigation -------------------------------------------------------

  /** Readiness gate — a wait, not a verification. */
  async waitForReady() {
    await this.digit(1).waitFor({ state: 'visible' });
  }

  // ---- actions ----------------------------------------------------------

  /**
   * Type a code across the boxes, one character per box.
   * @param {string} code
   */
  async enterOtp(code) {
    for (let i = 0; i < code.length; i += 1) {
      await this.digit(i + 1).fill(code[i]);
    }
  }

  /** Type into the box in focus, letting the card's own auto-advance carry the
   *  caret — the only way to observe that behaviour.
   * @param {string} code */
  async typeOtpSequentially(code) {
    await this.digit(1).click();
    for (const character of code) {
      await this.page.keyboard.type(character);
    }
  }

  /** Empty every box. Back to front: clearing a box pulls the digits after it
   *  one place left, so a front-to-back wipe leaves a digit behind. */
  async clearOtp() {
    const count = await this.otpInputs.count();
    for (let i = count; i >= 1; i -= 1) {
      await this.digit(i).fill('');
    }
  }

  /** Submit the code and capture the verification call. */
  async verifyAndWaitForResponse() {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes(VERIFY_OTP_ENDPOINT) && r.request().method() === 'POST',
      ),
      this.verifyButton.click(),
    ]);
    return response;
  }

  /** Submit without waiting — for the cases where no request is expected. */
  async verify() {
    await this.verifyButton.click();
  }

  /** Ask for a new code and capture the call. */
  async resendAndWaitForResponse() {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes(RESEND_OTP_ENDPOINT) && r.request().method() === 'POST',
      ),
      this.resendButton.click(),
    ]);
    return response;
  }

  async backToStart() {
    await this.backToStartLink.click();
    await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.chooseAccountType}$`));
  }
}
