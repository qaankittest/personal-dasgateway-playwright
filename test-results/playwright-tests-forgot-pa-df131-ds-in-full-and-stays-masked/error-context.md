# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\tests\forgot-password\reset-password.spec.js >> Forgot Password — reset the password >> TC_FP_022 — a pasted password lands in full and stays masked
- Location: playwright\tests\forgot-password\reset-password.spec.js:210:3

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/beta/reset-password", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | import { TEST_CONFIG } from '../../fixtures/test-config.js';
  2   | 
  3   | /**
  4   |  * Step 2 of the forgot-password wizard — the OTP card at `/reset-password`.
  5   |  *
  6   |  * Observed against the live dev app (2026-08-22):
  7   |  *   * six single-character boxes, each `maxlength="1" inputmode="numeric"`, whose
  8   |  *     only accessible names are `Digit 1` … `Digit 6`;
  9   |  *   * a digit auto-advances focus to the next box; letters and symbols are
  10  |  *     rejected outright and never reach the box's value;
  11  |  *   * Backspace on a **filled** box clears it and keeps focus; Backspace on an
  12  |  *     **empty** box clears the previous box and moves focus back to it;
  13  |  *   * VERIFY is `disabled` until all six boxes hold a value;
  14  |  *   * VERIFY does **not** validate the code — it always advances to the password
  15  |  *     card. The OTP is only checked when the new password is submitted, so a
  16  |  *     wrong code surfaces as "Invalid OTP provided." on `ResetPasswordPage`;
  17  |  *   * "Resend OTP" re-posts the same `/api/v1/auth/forgotPassword` endpoint the
  18  |  *     email step used.
  19  |  *
  20  |  * The OTP card and the password card share `/reset-password`, so a spec must
  21  |  * wait on a marker element rather than a navigation. A cold hit on that route
  22  |  * always renders this card.
  23  |  */
  24  | export class OtpVerificationPage {
  25  |   /** @param {import('@playwright/test').Page} page */
  26  |   constructor(page) {
  27  |     this.page = page;
  28  | 
  29  |     this.heading = page.getByText('Enter OTP to verify your account', { exact: true });
  30  |     this.instruction = page.getByText(/verification code sent to your registered email id/i);
  31  | 
  32  |     this.form = page.locator('form');
  33  |     this.otpInputs = page.getByRole('textbox', { name: /^Digit \d$/ });
  34  |     this.verifyButton = page.getByRole('button', { name: 'Verify' });
  35  |     this.resendOtpButton = page.getByRole('button', { name: 'Resend OTP' });
  36  |     this.resendPrompt = page.getByText("Didn't receive a code?");
  37  | 
  38  |     this.backToSignInLink = page.getByRole('link', { name: 'Back to Sign In' });
  39  |     this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  40  |   }
  41  | 
  42  |   /**
  43  |    * One OTP box, 1-indexed to match its accessible name.
  44  |    * @param {number} position 1–6
  45  |    */
  46  |   digit(position) {
  47  |     return this.page.getByRole('textbox', { name: `Digit ${position}` });
  48  |   }
  49  | 
  50  |   /** A cold hit on `/reset-password` renders this card, with no reset in flight. */
  51  |   async goto() {
> 52  |     await this.page.goto(TEST_CONFIG.routes.resetPassword, { waitUntil: 'domcontentloaded' });
      |                     ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  53  |   }
  54  | 
  55  |   /**
  56  |    * Type the code box by box, letting the app's own auto-advance move focus —
  57  |    * `fill()` per box would bypass the keystroke handling this screen relies on.
  58  |    * Accepts partial codes so a spec can prove VERIFY stays disabled at 1–5 digits.
  59  |    * @param {string} code
  60  |    */
  61  |   async enterOtp(code) {
  62  |     await this.digit(1).click();
  63  |     await this.page.keyboard.type(code);
  64  |   }
  65  | 
  66  |   /** Put the caret in the first box, ready for `appendDigit`. */
  67  |   async focusFirstDigit() {
  68  |     await this.digit(1).click();
  69  |   }
  70  | 
  71  |   /**
  72  |    * Type one more character into whichever box currently holds focus. Lets a
  73  |    * spec walk the code in one digit at a time and assert VERIFY's state after
  74  |    * each — the app moves focus itself, so the spec never has to.
  75  |    * @param {string} character
  76  |    */
  77  |   async appendDigit(character) {
  78  |     await this.page.keyboard.type(character);
  79  |   }
  80  | 
  81  |   /**
  82  |    * Type one character into a specific box without moving focus first — used to
  83  |    * prove non-numeric input is rejected.
  84  |    * @param {number} position 1–6
  85  |    * @param {string} character
  86  |    */
  87  |   async typeIntoDigit(position, character) {
  88  |     await this.digit(position).click();
  89  |     await this.page.keyboard.type(character);
  90  |   }
  91  | 
  92  |   /** @param {number} [times] */
  93  |   async pressBackspace(times = 1) {
  94  |     for (let i = 0; i < times; i += 1) {
  95  |       await this.page.keyboard.press('Backspace');
  96  |     }
  97  |   }
  98  | 
  99  |   async verify() {
  100 |     await this.verifyButton.click();
  101 |   }
  102 | 
  103 |   /** Resend, waiting on the request the new code depends on. */
  104 |   async resendOtp() {
  105 |     const [response] = await Promise.all([
  106 |       this.page.waitForResponse(
  107 |         (r) => r.url().includes('/auth/forgotPassword') && r.request().method() === 'POST',
  108 |       ),
  109 |       this.resendOtpButton.click(),
  110 |     ]);
  111 |     return response;
  112 |   }
  113 | }
  114 | 
```