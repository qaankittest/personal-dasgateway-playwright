// Forgot Password — step 3, the new-password card at /reset-password.
// Covers TC_FP_013 – TC_FP_019 and TC_FP_021 – TC_FP_024 of
// Forgot_Password_Functional_Test_Cases.pdf.
//
// The password card is not reachable by URL — a cold hit on /reset-password
// always renders the OTP card — so every test opens it by walking forward from
// there. Two routes in, deliberately:
//
//   - `openResetCard` (most cases): cold-load the OTP card, type six digits,
//     VERIFY. The app defers the code check to the final reset call, so VERIFY
//     issues no request at all and the card opens offline. Everything from
//     TC_FP_013 to TC_FP_022 tests client-side rendering and validation, which
//     needs nothing from the backend.
//   - `openResetCardFromEmailRequest` (TC_FP_023 / TC_FP_024): the real flow,
//     starting at /forgot-password, because those two cases turn on the
//     backend's answer and on the reset session being discarded.
//
// That split matters: `/auth/forgotPassword` is rate-limited, and requesting a
// code for all eleven tests tripped "Too Many Requests" part-way through the
// file, failing later tests for a reason unrelated to what they verify.
//
// The suite stays read-only — the OTP is a random six-digit value, so the reset
// always fails at the backend and no account's password ever changes.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { writeToClipboard } from '../../utils/clipboard.js';
import {
  FORGOT_PASSWORD_MESSAGES,
  MISMATCHED_PASSWORD,
  PASSWORD_POLICY,
  RANDOM_OTP,
  SHORT_PASSWORD,
  VALID_PASSWORD,
  WEAK_COMPLEXITY_PASSWORD,
  forgotPasswordEmail,
} from '../../data/forgot-password.js';

const ON_RESET_PASSWORD = new RegExp(`${TEST_CONFIG.routes.resetPassword}$`);
const ON_LOGIN = new RegExp(`${TEST_CONFIG.routes.login}$`);

/**
 * Open the password card without touching the backend. Actions only — the card
 * is awaited by the page object's own readiness gate, and each test states for
 * itself what must then be true.
 *
 * @param {import('../../pages/forgot-password/OtpVerificationPage.js').OtpVerificationPage} otp
 * @param {import('../../pages/forgot-password/ResetPasswordPage.js').ResetPasswordPage} reset
 */
async function openResetCard(otp, reset) {
  await test.step('open the Reset Password card', async () => {
    await otp.goto();
    await otp.enterOtp(RANDOM_OTP);
    await otp.verify();
    await reset.waitForReady();
  });
}

/**
 * Open the password card the way a user does — request a code first. Returns
 * the `/auth/forgotPassword` response so the calling test can assert the run
 * did not trip the rate limit.
 *
 * @param {import('../../pages/forgot-password/ForgotPasswordPage.js').ForgotPasswordPage} forgotPassword
 * @param {import('../../pages/forgot-password/OtpVerificationPage.js').OtpVerificationPage} otp
 * @param {import('../../pages/forgot-password/ResetPasswordPage.js').ResetPasswordPage} reset
 * @returns {Promise<import('@playwright/test').Response>}
 */
async function openResetCardFromEmailRequest(forgotPassword, otp, reset) {
  return test.step('walk the wizard from the email request', async () => {
    await forgotPassword.goto();
    const response = await forgotPassword.requestOtp(forgotPasswordEmail());
    await otp.waitForReady();
    await otp.enterOtp(RANDOM_OTP);
    await otp.verify();
    await reset.waitForReady();
    return response;
  });
}

test.describe('Forgot Password — reset the password', { tag: ['@regression'] }, () => {
  test('TC_FP_013 — the screen shows both password fields with their toggles', async ({
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    await openResetCard(otp, reset);

    await expect.soft(reset.heading).toHaveText('Reset Password');
    await expect.soft(reset.newPasswordInput).toHaveAttribute('placeholder', 'Enter New Password');
    await expect
      .soft(reset.confirmPasswordInput)
      .toHaveAttribute('placeholder', 'Confirm New Password');
    await expect.soft(reset.newPasswordToggle).toBeVisible();
    await expect.soft(reset.confirmPasswordToggle).toBeVisible();
    await expect.soft(reset.submitButton).toHaveText('Reset Password');
    await expect.soft(reset.backToSignInLink).toHaveAttribute('href', TEST_CONFIG.routes.login);
    await expect.soft(reset.languageButton).toHaveText('English (UK)');
  });

  test('TC_FP_014 — both blank fields are rejected without submitting', async ({
    page,
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    await openResetCard(otp, reset);
    await reset.submit();

    await expect(reset.validationMessages).toHaveText([
      FORGOT_PASSWORD_MESSAGES.passwordRequired,
      FORGOT_PASSWORD_MESSAGES.passwordRequired,
    ]);
    await expect(page).toHaveURL(ON_RESET_PASSWORD);
    await expect(reset.heading).toBeVisible();
  });

  test(`TC_FP_015 — a password under ${PASSWORD_POLICY.minLength} characters is rejected`, async ({
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    expect(
      SHORT_PASSWORD.length,
      'the fixture must actually be under the minimum for this case to mean anything',
    ).toBeLessThan(PASSWORD_POLICY.minLength);

    await openResetCard(otp, reset);
    await reset.fillPasswords(SHORT_PASSWORD);
    await reset.submit();

    await expect(reset.message(FORGOT_PASSWORD_MESSAGES.passwordTooShort)).toBeVisible();
    await expect(reset.heading).toBeVisible();
  });

  test('TC_FP_016 — a long-enough password still needs every character class', async ({
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    expect(
      WEAK_COMPLEXITY_PASSWORD.length,
      'this case is about complexity, so the fixture must clear the length rule',
    ).toBeGreaterThanOrEqual(PASSWORD_POLICY.minLength);

    await openResetCard(otp, reset);
    await reset.fillPasswords(WEAK_COMPLEXITY_PASSWORD);
    await reset.submit();

    await expect(reset.message(FORGOT_PASSWORD_MESSAGES.passwordComplexity)).toBeVisible();
    await expect(reset.heading).toBeVisible();
  });

  test('TC_FP_017 — both fields mask what is typed', async ({
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    await openResetCard(otp, reset);
    await reset.fillPasswords(VALID_PASSWORD);

    await expect(reset.newPasswordInput).toHaveAttribute('type', 'password');
    await expect(reset.confirmPasswordInput).toHaveAttribute('type', 'password');
    // The value still round-trips — masked in the UI, not discarded.
    await expect(reset.newPasswordInput).toHaveValue(VALID_PASSWORD);
    await expect(reset.confirmPasswordInput).toHaveValue(VALID_PASSWORD);
  });

  test('TC_FP_018 — each eye icon unmasks only its own field', async ({
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    await openResetCard(otp, reset);
    await reset.fillPasswords(VALID_PASSWORD);

    await test.step('unmasking the new password leaves the confirm field masked', async () => {
      await reset.toggleNewPasswordVisibility();

      await expect(reset.newPasswordInput).toHaveAttribute('type', 'text');
      await expect(reset.newPasswordToggle).toHaveAccessibleName('Hide password');
      await expect(reset.confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    await test.step('clicking again re-masks it', async () => {
      await reset.toggleNewPasswordVisibility();

      await expect(reset.newPasswordInput).toHaveAttribute('type', 'password');
      await expect(reset.newPasswordToggle).toHaveAccessibleName('Show password');
    });

    await test.step('the confirm field toggles independently', async () => {
      await reset.toggleConfirmPasswordVisibility();

      await expect(reset.confirmPasswordInput).toHaveAttribute('type', 'text');
      await expect(reset.newPasswordInput).toHaveAttribute('type', 'password');

      await reset.toggleConfirmPasswordVisibility();

      await expect(reset.confirmPasswordInput).toHaveAttribute('type', 'password');
    });
  });

  test('TC_FP_019 — a confirm password that differs is rejected', async ({
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    await openResetCard(otp, reset);
    await reset.fillPasswords(VALID_PASSWORD, MISMATCHED_PASSWORD);
    await reset.submit();

    await expect(reset.message(FORGOT_PASSWORD_MESSAGES.passwordsMustMatch)).toBeVisible();
    await expect(reset.heading).toBeVisible();
  });

  // TC_FP_021. The PDF expects copy to be blocked on the password fields; the
  // dev app installs no `copy`, `cut` or `contextmenu` guard, so Ctrl+C works
  // there like any other input (verified 2026-08-22). The PDF's own Open Point
  // #4 flags this rule as unconfirmed, so the case stays `fixme` rather than
  // asserting today's behaviour as correct. Un-fix once the rule is decided —
  // if copy is meant to be allowed, invert the assertion instead.
  test.fixme('TC_FP_021 — the password fields refuse to be copied out', async ({
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    await openResetCard(otp, reset);
    await reset.fillNewPassword(VALID_PASSWORD);
    await reset.copyNewPassword();
    await reset.pasteIntoConfirmPassword();

    await expect(reset.confirmPasswordInput).toHaveValue('');
  });

  test('TC_FP_022 — a pasted password lands in full and stays masked', async ({
    page,
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    await openResetCard(otp, reset);

    // Seed the clipboard directly rather than copying out of the password field,
    // so this case measures paste behaviour only and does not depend on
    // TC_FP_021's unresolved copy rule.
    await writeToClipboard(page, VALID_PASSWORD);

    await test.step('paste into Enter New Password', async () => {
      await reset.pasteIntoNewPassword();

      await expect(reset.newPasswordInput).toHaveValue(VALID_PASSWORD);
      await expect(reset.newPasswordInput).toHaveAttribute('type', 'password');
    });

    await test.step('unmasking shows the whole pasted value', async () => {
      await reset.toggleNewPasswordVisibility();

      await expect(reset.newPasswordInput).toHaveAttribute('type', 'text');
      await expect(reset.newPasswordInput).toHaveValue(VALID_PASSWORD);

      await reset.toggleNewPasswordVisibility();
    });

    await test.step('Confirm New Password behaves the same', async () => {
      await reset.pasteIntoConfirmPassword();

      await expect(reset.confirmPasswordInput).toHaveValue(VALID_PASSWORD);
      await expect(reset.confirmPasswordInput).toHaveAttribute('type', 'password');
    });
  });

  test('TC_FP_023 — a valid password submitted against a wrong OTP is refused', async ({
    forgotPasswordPage: forgotPassword,
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    // Must come through the real flow: the backend only rejects the code once
    // there is a reset session to reject it against.
    const requested = await openResetCardFromEmailRequest(forgotPassword, otp, reset);

    expect(
      requested.ok(),
      'POST /auth/forgotPassword must succeed for the wizard to advance — a 429 here means the run tripped the rate limit',
    ).toBeTruthy();

    await reset.fillPasswords(VALID_PASSWORD);
    const verified = await reset.submitAndWaitForVerify();

    expect(verified.status(), 'POST /auth/forgotPasswordVerify with a wrong OTP').toBe(400);
    await expect(reset.message(FORGOT_PASSWORD_MESSAGES.invalidOtp)).toBeVisible();
    await expect(reset.heading).toBeVisible();
  });

  test('TC_FP_024 — leaving the wizard discards the in-progress reset', async ({
    page,
    forgotPasswordPage: forgotPassword,
    otpVerificationPage: otp,
    resetPasswordPage: reset,
    loginPage: login,
  }) => {
    const requested = await openResetCardFromEmailRequest(forgotPassword, otp, reset);

    expect(
      requested.ok(),
      'POST /auth/forgotPassword must succeed for the wizard to advance — a 429 here means the run tripped the rate limit',
    ).toBeTruthy();

    await test.step('Back to Sign In from the password card', async () => {
      await reset.backToSignIn();

      await expect(page).toHaveURL(ON_LOGIN);
      await expect(login.emailInput).toBeVisible();
    });

    await test.step('returning to the wizard URL restarts at the OTP step', async () => {
      await reset.gotoWizardUrl();

      await expect(otp.heading).toBeVisible();
      await expect(otp.otpInputs).toHaveCount(6);
      await expect(reset.newPasswordInput).toBeHidden();
    });

    await test.step('Back to Sign In works from the OTP card too', async () => {
      await otp.backToSignIn();

      await expect(page).toHaveURL(ON_LOGIN);
    });
  });
});
