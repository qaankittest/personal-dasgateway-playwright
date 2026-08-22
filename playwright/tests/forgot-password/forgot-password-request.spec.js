// Forgot Password — step 1, the email-request card at /forgot-password.
// Covers TC_FP_001 – TC_FP_007 of Forgot_Password_Functional_Test_Cases.pdf.
//
// Read-only: the flow creates no account and mutates no merchant record. The
// happy path does trigger a real password-reset mail to a unique mailinator
// address, so the suite is tagged @regression rather than @smoke.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import {
  FORGOT_PASSWORD_MESSAGES,
  INVALID_EMAILS,
  forgotPasswordEmail,
} from '../../data/forgot-password.js';

test.describe('Forgot Password — request a verification code', { tag: ['@regression'] }, () => {
  test('TC_FP_001 — Forgot Password? link on Sign In opens the reset-request screen', async ({
    page,
    forgotPasswordPage: forgotPassword,
  }) => {
    await test.step('take the link from the Sign In screen', async () => {
      await forgotPassword.gotoFromLogin();
    });

    await test.step('the reset-request card is rendered', async () => {
      await expect(page).toHaveURL(new RegExp(`${TEST_CONFIG.routes.forgotPassword}$`));
      await expect(forgotPassword.heading).toBeVisible();
      await expect(forgotPassword.emailInput).toBeVisible();
      await expect(forgotPassword.submitButton).toBeVisible();
      await expect(forgotPassword.backToSignInLink).toBeVisible();
      await expect(forgotPassword.languageButton).toBeVisible();
    });
  });

  test('TC_FP_002 — the screen states its purpose and labels its controls', async ({
    forgotPasswordPage: forgotPassword,
  }) => {
    await forgotPassword.goto();

    // Soft, so one copy change reports every mismatch in a single run instead
    // of hiding the rest behind the first failure.
    await expect.soft(forgotPassword.heading).toHaveText('Forgot your password?');
    await expect
      .soft(forgotPassword.instruction)
      .toHaveText(
        'Enter your registered email ID below and we shall send you a verification code to help you reset your password.',
      );
    await expect.soft(forgotPassword.emailInput).toHaveAttribute('placeholder', 'Email Address');
    await expect.soft(forgotPassword.submitButton).toHaveText('Submit');
    await expect.soft(forgotPassword.backToSignInLink).toHaveText('Back to Sign In');
    await expect
      .soft(forgotPassword.backToSignInLink)
      .toHaveAttribute('href', TEST_CONFIG.routes.login);
    await expect.soft(forgotPassword.languageButton).toHaveText('English (UK)');
  });

  test('TC_FP_003 — a blank email is rejected without leaving the screen', async ({
    page,
    forgotPasswordPage: forgotPassword,
  }) => {
    await forgotPassword.goto();
    await forgotPassword.submit();

    await expect(forgotPassword.validationMessage).toHaveText(
      FORGOT_PASSWORD_MESSAGES.emailRequired,
    );
    await expect(page).toHaveURL(new RegExp(`${TEST_CONFIG.routes.forgotPassword}$`));
    await expect(forgotPassword.emailInput).toBeVisible();
  });

  // One case per invalid value: a failure names the exact address that slipped
  // through, and a single bad shape cannot mask the others.
  for (const email of INVALID_EMAILS) {
    test(`TC_FP_004 — "${email}" is rejected as a malformed address`, async ({
      page,
      forgotPasswordPage: forgotPassword,
    }) => {
      await forgotPassword.goto();
      await forgotPassword.fillEmail(email);
      await forgotPassword.submit();

      await expect(forgotPassword.validationMessage).toHaveText(
        FORGOT_PASSWORD_MESSAGES.emailInvalid,
      );
      await expect(page).toHaveURL(new RegExp(`${TEST_CONFIG.routes.forgotPassword}$`));
    });
  }

  test('TC_FP_005 — clearing an accepted address brings the required error back', async ({
    forgotPasswordPage: forgotPassword,
  }) => {
    await forgotPassword.goto();

    // The app validates on submit first and only then live on every change, so
    // this submit is what arms the re-validation the case is about. Without it,
    // typing and clearing shows nothing — verified against the live dev app.
    await test.step('arm validation with a blank submit', async () => {
      await forgotPassword.submit();
      await expect(forgotPassword.validationMessage).toHaveText(
        FORGOT_PASSWORD_MESSAGES.emailRequired,
      );
    });

    await test.step('a valid address clears the error', async () => {
      await forgotPassword.fillEmail('test.user@mailinator.com');
      await expect(forgotPassword.validationMessage).toBeHidden();
    });

    await test.step('clearing the field brings it back', async () => {
      await forgotPassword.clearEmail();
      await expect(forgotPassword.emailInput).toHaveValue('');
      await expect(forgotPassword.validationMessage).toHaveText(
        FORGOT_PASSWORD_MESSAGES.emailRequired,
      );
    });
  });

  test('TC_FP_006 — Back to Sign In returns to an empty Sign In form', async ({
    page,
    forgotPasswordPage: forgotPassword,
    loginPage: login,
  }) => {
    await forgotPassword.goto();
    await forgotPassword.backToSignInLink.click();

    await expect(page).toHaveURL(new RegExp(`${TEST_CONFIG.routes.login}$`));
    await expect(login.username).toHaveValue('');
    await expect(login.password).toHaveValue('');
  });

  test('TC_FP_007 — a well-formed address advances to the OTP screen', async ({
    forgotPasswordPage: forgotPassword,
    otpVerificationPage: otp,
  }) => {
    const email = forgotPasswordEmail();

    await forgotPassword.goto();
    const response = await forgotPassword.requestOtp(email);

    // The endpoint answers 200 for registered and unregistered addresses alike
    // — a deliberate account-enumeration defence — so the OTP card is the
    // expected outcome either way.
    expect(response.ok(), `POST /auth/forgotPassword for ${email}`).toBeTruthy();
    await expect(otp.heading).toBeVisible();
    await expect(otp.otpInputs).toHaveCount(6);
    await expect(forgotPassword.validationMessage).toBeHidden();
  });
});
