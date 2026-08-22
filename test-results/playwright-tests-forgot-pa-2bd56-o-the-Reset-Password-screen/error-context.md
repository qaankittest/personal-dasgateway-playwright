# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playwright\tests\forgot-password\otp-verification.spec.js >> Forgot Password — OTP verification >> TC_FP_012 — VERIFY advances to the Reset Password screen
- Location: playwright\tests\forgot-password\otp-verification.spec.js:117:3

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/beta/forgot-password", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { TEST_CONFIG } from '../../fixtures/test-config.js';
  2  | 
  3  | /**
  4  |  * Step 1 of the forgot-password wizard — `/forgot-password`.
  5  |  *
  6  |  * Observed against the live dev app (2026-08-22):
  7  |  *   * the email field is `#username` (`name="username"`), `type="text"` — **not**
  8  |  *     `type="email"`, so the browser contributes no native validation and every
  9  |  *     message below comes from the app's own schema;
  10 |  *   * its only accessible name is the `Email Address` placeholder — there is no
  11 |  *     `<label>`, so `getByLabel` does not match it;
  12 |  *   * SUBMIT posts `/api/v1/auth/forgotPassword` and, on 200, swaps the card to
  13 |  *     the OTP step at `/reset-password`. For security the app behaves
  14 |  *     identically for registered and unregistered addresses;
  15 |  *   * validation runs **on submit first**, then live on every change. A blur
  16 |  *     alone, before any submit attempt, shows nothing.
  17 |  *
  18 |  * Errors render as a bare `<p class="text-xs text-red-400">` with no `role`,
  19 |  * `id` or `aria-describedby` — hence `validationMessage`'s class hook. Ask the
  20 |  * app team for `forgot-password-email` / `forgot-password-error` testids and
  21 |  * this whole fallback disappears (see SKILL.md §14).
  22 |  */
  23 | export class ForgotPasswordPage {
  24 |   /** @param {import('@playwright/test').Page} page */
  25 |   constructor(page) {
  26 |     this.page = page;
  27 | 
  28 |     this.heading = page.getByText('Forgot your password?', { exact: true });
  29 |     this.instruction = page.getByText(/enter your registered email id below/i);
  30 | 
  31 |     this.form = page.locator('form');
  32 |     this.emailInput = page
  33 |       .getByRole('textbox', { name: 'Email Address' })
  34 |       .or(page.getByPlaceholder('Email Address'))
  35 |       .or(page.locator('#username'))
  36 |       .first();
  37 |     this.submitButton = page.getByRole('button', { name: 'Submit' });
  38 | 
  39 |     // The one error slot on this step. Scoped to the form so the OTP step's
  40 |     // "Didn't receive a code?" paragraph can never satisfy it.
  41 |     this.validationMessage = this.form.locator('p[class*="text-red-400"]').first();
  42 | 
  43 |     this.backToSignInLink = page.getByRole('link', { name: 'Back to Sign In' });
  44 |     this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  45 |   }
  46 | 
  47 |   async goto() {
> 48 |     await this.page.goto(TEST_CONFIG.routes.forgotPassword, { waitUntil: 'domcontentloaded' });
     |                     ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  49 |   }
  50 | 
  51 |   /** Land on /login and take the "Forgot Password?" link across, the way a real
  52 |    *  user reaches this screen. */
  53 |   async gotoFromLogin() {
  54 |     await this.page.goto(TEST_CONFIG.routes.login, { waitUntil: 'domcontentloaded' });
  55 |     await this.page.getByRole('link', { name: 'Forgot Password?' }).click();
  56 |     await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.forgotPassword}$`));
  57 |   }
  58 | 
  59 |   /** @param {string} email */
  60 |   async fillEmail(email) {
  61 |     await this.emailInput.fill(email);
  62 |   }
  63 | 
  64 |   /** Empty the field and blur it, so the app's revalidation fires. */
  65 |   async clearEmail() {
  66 |     await this.emailInput.fill('');
  67 |     await this.emailInput.blur();
  68 |   }
  69 | 
  70 |   async submit() {
  71 |     await this.submitButton.click();
  72 |   }
  73 | 
  74 |   /**
  75 |    * Submit a well-formed address and wait for the request the OTP step depends
  76 |    * on. A wait, not a verification — the spec still asserts what landed.
  77 |    * @param {string} email
  78 |    */
  79 |   async requestOtp(email) {
  80 |     await this.fillEmail(email);
  81 |     const [response] = await Promise.all([
  82 |       this.page.waitForResponse(
  83 |         (r) => r.url().includes('/auth/forgotPassword') && r.request().method() === 'POST',
  84 |       ),
  85 |       this.submit(),
  86 |     ]);
  87 |     return response;
  88 |   }
  89 | }
  90 | 
```