// Forgot Password — step 2, the OTP card at /reset-password.
// Covers TC_FP_008 – TC_FP_012 and TC_FP_020 of
// Forgot_Password_Functional_Test_Cases.pdf.
//
// A cold hit on /reset-password renders this card with no reset in flight, so
// most cases need no email request first. The two that must arrive through the
// real flow (TC_FP_011, TC_FP_012) say so in their own steps.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { RANDOM_OTP, forgotPasswordEmail } from '../../data/forgot-password.js';

test.describe('Forgot Password — OTP verification', { tag: ['@regression'] }, () => {
  test('TC_FP_008 — the OTP screen shows six boxes and a disabled VERIFY', async ({
    otpVerificationPage: otp,
  }) => {
    await otp.goto();

    await expect.soft(otp.heading).toHaveText('Enter OTP to verify your account');
    await expect
      .soft(otp.instruction)
      .toHaveText('Please enter below the verification code sent to your registered email ID');
    await expect.soft(otp.otpInputs).toHaveCount(6);
    await expect.soft(otp.verifyButton).toBeDisabled();
    await expect.soft(otp.resendPrompt).toBeVisible();
    await expect.soft(otp.resendOtpButton).toBeVisible();
    await expect.soft(otp.backToSignInLink).toHaveAttribute('href', TEST_CONFIG.routes.login);
    await expect.soft(otp.languageButton).toHaveText('English (UK)');
  });

  test('TC_FP_009 — VERIFY unlocks only once all six digits are entered', async ({
    otpVerificationPage: otp,
  }) => {
    await otp.goto();

    await expect(otp.verifyButton, 'disabled with no digits entered').toBeDisabled();

    await otp.focusFirstDigit();
    for (const [index, digit] of [...RANDOM_OTP.slice(0, 5)].entries()) {
      await otp.appendDigit(digit);

      await expect(otp.verifyButton, `still disabled at ${index + 1} of 6 digits`).toBeDisabled();
    }

    await otp.appendDigit(RANDOM_OTP[5]);

    await expect(otp.verifyButton, 'enabled once all six boxes are filled').toBeEnabled();
  });

  test('TC_FP_010 — each box takes one digit, auto-advances, and refuses letters', async ({
    otpVerificationPage: otp,
  }) => {
    await otp.goto();

    await test.step('a digit fills the box and moves focus on', async () => {
      await otp.typeIntoDigit(1, '1');

      await expect(otp.digit(1)).toHaveValue('1');
      await expect(otp.digit(2)).toBeFocused();
    });

    await test.step('a second character neither stacks nor replaces', async () => {
      // The box holds exactly one digit: a further keystroke on a filled box is
      // dropped, leaving the original value in place.
      await otp.typeIntoDigit(1, '9');

      await expect(otp.digit(1)).toHaveValue('1');
    });

    await test.step('letters and symbols are refused', async () => {
      for (const character of ['a', '@', ' ']) {
        await otp.typeIntoDigit(3, character);

        await expect(otp.digit(3), `"${character}" must not be accepted`).toHaveValue('');
      }
    });

    await test.step('Backspace clears the current box, then walks back', async () => {
      // Reload for a clean set of boxes — the steps above deliberately left
      // digit 1 filled, and a filled box swallows further keystrokes.
      await otp.goto();
      await otp.enterOtp(RANDOM_OTP);

      await expect(otp.digit(6)).toHaveValue('6');

      await otp.pressBackspace();

      await expect(otp.digit(6), 'a filled box is cleared in place').toHaveValue('');
      await expect(otp.digit(6)).toBeFocused();

      await otp.pressBackspace();

      await expect(otp.digit(5), 'an empty box clears the one before it').toHaveValue('');
      await expect(otp.digit(5)).toBeFocused();
    });
  });

  // TC_FP_011. The PDF expects a resend cap; the dev app currently has none —
  // eight consecutive clicks all returned 200 with the link still enabled and no
  // error rendered (verified 2026-08-22). That is exactly the PDF's own Open
  // Point #2 ("Confirm the configured maximum number of Resend OTP attempts and
  // the cool-down period"). Left as `fixme` rather than asserting the current
  // uncapped behaviour, which would lock in a defect as the expectation.
  // Un-fix and set `RESEND_LIMIT` once the cap is confirmed and shipped.
  test.fixme(
    'TC_FP_011 — Resend OTP is blocked once the attempt limit is reached',
    async ({ forgotPasswordPage: forgotPassword, otpVerificationPage: otp }) => {
      const RESEND_LIMIT = 5; // TODO: confirm with the app team.

      await forgotPassword.goto();
      await forgotPassword.requestOtp(forgotPasswordEmail());

      await expect(otp.heading).toBeVisible();

      for (let attempt = 1; attempt <= RESEND_LIMIT; attempt += 1) {
        const accepted = await otp.resendOtp();

        expect(accepted.ok(), `resend attempt ${attempt} should be accepted`).toBeTruthy();
      }

      const rejected = await otp.resendOtp();

      expect(rejected.ok(), 'the attempt past the limit should be rejected').toBeFalsy();
      await expect(otp.resendOtpButton).toBeDisabled();
    },
  );

  test('TC_FP_012 — VERIFY advances to the Reset Password screen', async ({
    forgotPasswordPage: forgotPassword,
    otpVerificationPage: otp,
    resetPasswordPage: reset,
  }) => {
    await test.step('reach the OTP card through the real flow', async () => {
      await forgotPassword.goto();
      const response = await forgotPassword.requestOtp(forgotPasswordEmail());

      expect(response.ok(), 'POST /auth/forgotPassword').toBeTruthy();
      await expect(otp.heading).toBeVisible();
    });

    await test.step('enter six digits and verify', async () => {
      await otp.enterOtp(RANDOM_OTP);

      await expect(otp.verifyButton).toBeEnabled();

      await otp.verify();
    });

    // VERIFY does not check the code — the app defers that to the final reset
    // call — so a syntactically complete OTP always lands on the password card.
    await test.step('the password card is rendered', async () => {
      await expect(reset.heading).toBeVisible();
      await expect(reset.newPasswordInput).toBeVisible();
      await expect(reset.confirmPasswordInput).toBeVisible();
    });
  });

  // TC_FP_020 verifies the delivered email's OTP, sender and branding. That
  // needs a mailbox API (Mailinator / Mailosaur) this suite has no credentials
  // for, so it is skipped rather than faked. Wire `MAILINATOR_API_KEY` into
  // .env, fetch the inbox for the address `forgotPasswordEmail()` minted, and
  // assert the six-digit code and the stated validity period.
  test.skip('TC_FP_020 — the verification email arrives with a six-digit code', async () => {});
});
