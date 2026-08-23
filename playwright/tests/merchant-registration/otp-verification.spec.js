// Merchant Account Creation — the OTP step.
// Covers TC_MA_017 – TC_MA_022 of
// Merchant_Account_Creation_Functional_Test_Cases.pdf.
//
// The OTP card is not reachable by URL — a cold hit on /onboarding/sign-up
// bounces to /choose-account-type — so every test walks in from the account
// form. That posts /onboarding/verify-email against a unique mailinator
// address, which is why the whole file is @mutating.
//
// **/onboarding/verify-email is rate-limited (429).** One registration per test
// case tripped it part-way through this file, failing later cases for a reason
// unrelated to what they verify. The six cases are therefore grouped into the
// two tests that genuinely need separate sessions: everything that inspects the
// card as it stands, and the one case that spends the code and leaves. Each
// case keeps its own `test.step`, so a failure still names the case it broke.
//
// The dev backend accepts a fixed verification code (TEST_OTP, default 1234),
// so TC_MA_022 can complete the step without reading a mailbox.
import { test, expect } from '../../fixtures/base.js';
import {
  buildMerchantAccount,
  loadMerchantRegistration,
  verificationOtp,
} from '../../fixtures/merchant-registration/load.js';
import { VERIFY_EMAIL_ENDPOINT } from '../../pages/merchant-registration/MerchantAccountPage.js';

const { copy, otp: otpData } = loadMerchantRegistration();

/**
 * Walk from the entry card to the OTP step and return the address the wizard
 * was started with. Actions only, bar the one check on the response — that is
 * what turns a throttled run into a named failure instead of a mystery timeout
 * on a card that was never going to render.
 *
 * @param {import('../../pages/merchant-registration/MerchantAccountPage.js').MerchantAccountPage} account
 * @param {import('../../pages/merchant-registration/MerchantOtpPage.js').MerchantOtpPage} otp
 * @returns {Promise<string>}
 */
async function openOtpStep(account, otp) {
  return test.step('start a registration and reach the OTP step', async () => {
    const merchant = buildMerchantAccount();
    await account.goto();
    await account.fillAccount(merchant);

    const response = await account.submitAndWaitForVerifyEmail();

    // The dev sign-up endpoint throttles: once a run has registered a handful of
    // merchants the rest of the window answers 429. That is an environment
    // limit, not a product defect and not a bug in this test — so a throttled
    // run reports as skipped-with-a-reason rather than as a red build.
    test.skip(
      response.status() === 429,
      'POST /onboarding/verify-email is rate-limited right now — rerun once the window clears',
    );
    expect(
      response.ok(),
      `POST ${VERIFY_EMAIL_ENDPOINT} answered ${response.status()} — a 429 here means the run tripped the rate limit`,
    ).toBeTruthy();

    await otp.waitForReady();
    return merchant.email;
  });
}

test.describe(
  'Merchant registration — OTP verification',
  { tag: ['@regression', '@mutating'] },
  () => {
    test('TC_MA_017/018/019/020/021 — the OTP card is complete, addressed, and typed one digit at a time', async ({
      page,
      merchantAccountPage: account,
      merchantOtpPage: otp,
    }) => {
      test.slow();
      const email = await openOtpStep(account, otp);

      await test.step('TC_MA_017 — four boxes, a locked VERIFY and a resend offer', async () => {
        await expect.soft(otp.heading).toHaveText(copy.otp.heading);
        await expect.soft(otp.otpInputs).toHaveCount(copy.otp.boxCount);
        await expect.soft(otp.verifyButton).toBeVisible();
        await expect.soft(otp.verifyButton).toBeDisabled();
        await expect.soft(otp.resendPrompt).toHaveText(copy.otp.resendPrompt);
        await expect.soft(otp.resendButton).toHaveText(copy.otp.resend);
        await expect.soft(otp.backToStartLink).toBeVisible();
        await expect.soft(otp.languageButton).toBeVisible();
      });

      await test.step('TC_MA_018 — the card echoes back the address just submitted', async () => {
        await expect(otp.instruction).toContainText(copy.otp.instruction);
        await expect(otp.echoedEmail(email)).toBeVisible();
        await expect(otp.instruction).toContainText(email);
      });

      await test.step('TC_MA_020 — VERIFY unlocks only once all four digits are in', async () => {
        for (const partial of otpData.partial) {
          await otp.clearOtp();
          await otp.enterOtp(partial);
          await expect(
            otp.verifyButton,
            `VERIFY must stay locked with ${partial.length} of ${copy.otp.boxCount} digits`,
          ).toBeDisabled();
        }

        await otp.clearOtp();
        await otp.enterOtp(verificationOtp());
        await expect(otp.verifyButton).toBeEnabled();
      });

      await test.step('TC_MA_021 — typing walks the caret across the boxes', async () => {
        await otp.clearOtp();
        await otp.typeOtpSequentially('1234');
        for (const [index, digit] of ['1', '2', '3', '4'].entries()) {
          await expect(otp.digit(index + 1), `box ${index + 1} holds one digit`).toHaveValue(digit);
        }
      });

      await test.step('TC_MA_021 — a filled box takes no second character', async () => {
        await otp.digit(1).click();
        await page.keyboard.type('9');
        await expect(otp.digit(1)).not.toHaveValue('19');
      });

      await test.step('TC_MA_021 — letters and symbols never land', async () => {
        await otp.clearOtp();
        await otp.digit(1).click();
        await page.keyboard.type('a');
        await expect(otp.digit(1)).toHaveValue('');
        await page.keyboard.type('@');
        await expect(otp.digit(1)).toHaveValue('');
      });

      await test.step('TC_MA_021 — Backspace clears the digit just typed', async () => {
        await otp.clearOtp();

        // Typed, not clicked into: clicking a filled box drops the caret in
        // front of the character, where Backspace has nothing to delete. The
        // path a user actually takes is type-then-correct, so that is the path
        // this asserts.
        await otp.typeOtpSequentially('12');
        await page.keyboard.press('Backspace');

        await expect(otp.digit(2), 'the digit just typed is gone').toHaveValue('');
        await expect(otp.digit(1), 'the digit before it is untouched').toHaveValue('1');
      });

      await test.step('TC_MA_019 — Resend OTP asks the backend for a new code', async () => {
        const response = await otp.resendAndWaitForResponse();
        expect(response.ok(), `POST ${response.url()} answered ${response.status()}`).toBeTruthy();

        // The card stays put and stays usable — a resend must not cost the user
        // the step they are on.
        await expect(otp.heading).toBeVisible();
        await expect(otp.otpInputs).toHaveCount(copy.otp.boxCount);
      });
    });

    test('TC_MA_022 — the correct code advances to the password step', async ({
      merchantAccountPage: account,
      merchantOtpPage: otp,
      setPasswordPage: setPassword,
    }) => {
      await openOtpStep(account, otp);

      await otp.enterOtp(verificationOtp());
      const response = await otp.verifyAndWaitForResponse();
      expect(
        response.ok(),
        `POST ${response.url()} answered ${response.status()} — the wizard cannot advance without it`,
      ).toBeTruthy();

      await expect(setPassword.heading).toBeVisible();
      await expect(setPassword.passwordInput).toBeVisible();
      await expect(setPassword.confirmPasswordInput).toBeVisible();
    });
  },
);
