// Merchant Account Creation — the final registration step.
// Covers TC_MA_023 – TC_MA_031 of
// Merchant_Account_Creation_Functional_Test_Cases.pdf.
//
// The password card is not reachable by URL, so every test walks the wizard in
// from the account form and verifies with the dev backend's fixed OTP. That
// makes the whole file @mutating: each test starts a registration, and
// TC_MA_031 finishes one, creating a real merchant account on dev under a
// unique mailinator address.
//
// **/onboarding/verify-email is rate-limited (429)**, so this file spends as
// few registrations as it can: one session carries every case that only reads
// the card or is refused by it, and a second carries the one case that spends
// the session by creating the account. Each case keeps its own `test.step`, so
// a failure still names the case it broke.
//
// Five cases are parked with `test.fixme` — each written to the document's
// expected result and failing against the current build, with the observed
// behaviour named above it.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import {
  buildMerchantAccount,
  loadMerchantRegistration,
  newAccountPassword,
  verificationOtp,
} from '../../fixtures/merchant-registration/load.js';
import { log } from '../../utils/logger.js';
import { VERIFY_EMAIL_ENDPOINT } from '../../pages/merchant-registration/MerchantAccountPage.js';
import { VERIFY_OTP_ENDPOINT } from '../../pages/merchant-registration/MerchantOtpPage.js';

const { copy, passwords, messages } = loadMerchantRegistration();

/** @param {string} description */
const defect = (description) => ({ annotation: { type: 'defect', description } });

const HAS_PASSWORD = !!TEST_CONFIG.credentials.password;
const ON_ONBOARDING = /\/onboarding\?step=business/;

/**
 * Walk from the entry card to the password step. Actions only, bar the two
 * checks on the responses — those turn a throttled run into a named failure
 * instead of a timeout on a card that was never going to render.
 *
 * @param {import('../../pages/merchant-registration/MerchantAccountPage.js').MerchantAccountPage} account
 * @param {import('../../pages/merchant-registration/MerchantOtpPage.js').MerchantOtpPage} otp
 * @param {import('../../pages/merchant-registration/SetPasswordPage.js').SetPasswordPage} setPassword
 * @returns {Promise<string>} the address the registration was started with
 */
async function openPasswordStep(account, otp, setPassword) {
  return test.step('walk the wizard to the password step', async () => {
    const merchant = buildMerchantAccount();
    await account.goto();
    await account.fillAccount(merchant);

    const requested = await account.submitAndWaitForVerifyEmail();

    // The dev sign-up endpoint throttles: once a run has registered a handful of
    // merchants the rest of the window answers 429. That is an environment
    // limit, not a product defect and not a bug in this test — so a throttled
    // run reports as skipped-with-a-reason rather than as a red build.
    test.skip(
      requested.status() === 429,
      'POST /onboarding/verify-email is rate-limited right now — rerun once the window clears',
    );
    expect(
      requested.ok(),
      `POST ${VERIFY_EMAIL_ENDPOINT} answered ${requested.status()} — a 429 here means the run tripped the rate limit`,
    ).toBeTruthy();

    await otp.waitForReady();
    await otp.enterOtp(verificationOtp());

    const verified = await otp.verifyAndWaitForResponse();
    expect(verified.ok(), `POST ${VERIFY_OTP_ENDPOINT} answered ${verified.status()}`).toBeTruthy();

    await setPassword.waitForReady();
    return merchant.email;
  });
}

test.describe(
  'Merchant registration — setting the password',
  { tag: ['@regression', '@mutating'] },
  () => {
    test.skip(!HAS_PASSWORD, 'TEST_PASSWORD not set — no password to register with');

    test('TC_MA_023/024/025/026b/027b/030 — the card presents the policy and refuses anything short of it', async ({
      page,
      merchantAccountPage: account,
      merchantOtpPage: otp,
      setPasswordPage: setPassword,
    }) => {
      test.slow();
      await openPasswordStep(account, otp, setPassword);
      const password = newAccountPassword();

      await test.step('TC_MA_023 — both fields, the policy and the consent gate are present', async () => {
        await expect.soft(setPassword.heading).toHaveText(copy.password.heading);
        await expect.soft(setPassword.subText).toHaveText(copy.password.subText);
        await expect
          .soft(setPassword.passwordInput)
          .toHaveAttribute('placeholder', copy.password.placeholders.password);
        await expect
          .soft(setPassword.confirmPasswordInput)
          .toHaveAttribute('placeholder', copy.password.placeholders.confirmPassword);
        await expect.soft(setPassword.showPasswordButton).toBeVisible();
        await expect.soft(setPassword.showConfirmPasswordButton).toBeVisible();
        await expect.soft(setPassword.requirementsToggle).toBeVisible();
        await expect.soft(setPassword.consentCheckbox).not.toBeChecked();
        await expect.soft(setPassword.submitButton).toHaveText(copy.password.submit);
        await expect.soft(setPassword.backToStartLink).toBeVisible();
        await expect.soft(setPassword.signInLink).toBeVisible();
      });

      await test.step('TC_MA_024 — Password Requirements opens to the full policy and closes again', async () => {
        await expect(setPassword.requirementsToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(setPassword.requirement(copy.password.requirements[0])).toBeHidden();

        await setPassword.toggleRequirements();
        await expect(setPassword.requirementsToggle).toHaveAttribute('aria-expanded', 'true');
        for (const requirement of copy.password.requirements) {
          await expect.soft(setPassword.requirement(requirement)).toBeVisible();
        }

        await setPassword.toggleRequirements();
        await expect(setPassword.requirementsToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(setPassword.requirement(copy.password.requirements[0])).toBeHidden();
      });

      await test.step('TC_MA_025 — both fields mask their value and each eye toggle acts alone', async () => {
        await setPassword.setPassword(password);
        await expect(setPassword.passwordInput).toHaveAttribute('type', 'password');
        await expect(setPassword.confirmPasswordInput).toHaveAttribute('type', 'password');

        await setPassword.showPasswordButton.click();
        await expect(setPassword.passwordInput).toHaveAttribute('type', 'text');
        await expect(
          setPassword.confirmPasswordInput,
          'the other field stays masked',
        ).toHaveAttribute('type', 'password');

        await setPassword.showConfirmPasswordButton.click();
        await expect(setPassword.confirmPasswordInput).toHaveAttribute('type', 'text');

        await setPassword.hidePasswordButton.click();
        await expect(setPassword.passwordInput).toHaveAttribute('type', 'password');
        await expect(
          setPassword.confirmPasswordInput,
          'the other field stays readable',
        ).toHaveAttribute('type', 'text');

        await setPassword.hideConfirmPasswordButton.click();
        await expect(setPassword.confirmPasswordInput).toHaveAttribute('type', 'password');
      });

      await test.step('TC_MA_030 — the consent links point at the Terms and Privacy documents', async () => {
        await expect.soft(setPassword.termsLink).toHaveText(copy.password.termsLink);
        await expect.soft(setPassword.termsLink).toHaveAttribute('href', /terms-condition/);
        await expect.soft(setPassword.privacyLink).toHaveText(copy.password.privacyLink);
        await expect.soft(setPassword.privacyLink).toHaveAttribute('href', /privacy-policy/);
      });

      await test.step('TC_MA_026b — a compliant password without consent does not create the account', async () => {
        await setPassword.setPassword(password);
        await expect(setPassword.consentCheckbox).not.toBeChecked();
        await setPassword.createAccount();

        await expect(setPassword.heading, 'the card must not advance').toBeVisible();
        await expect(page).not.toHaveURL(ON_ONBOARDING);
      });

      await test.step('TC_MA_030 — the checkbox ticks and unticks independently', async () => {
        await setPassword.acceptTerms();
        await expect(setPassword.consentCheckbox).toBeChecked();
        await setPassword.consentCheckbox.uncheck();
        await expect(setPassword.consentCheckbox).not.toBeChecked();
        await setPassword.acceptTerms();
      });

      // The message the app renders on a refusal is unreliable (TC_MA_026c and
      // TC_MA_027 below), so these assert the outcome that matters: no account
      // is created, and the user keeps what they typed.
      for (const [label, value, confirm] of [
        ['under 14 characters', passwords.short, passwords.short],
        ['no character variety', passwords.weakComplexity, passwords.weakComplexity],
        ['confirm does not match', password, passwords.mismatchConfirm],
      ]) {
        await test.step(`TC_MA_027b — ${label} is refused`, async () => {
          await setPassword.setPassword(value, confirm);
          await setPassword.createAccount();

          await expect(setPassword.heading).toBeVisible();
          await expect(page, `"${label}" must not create the account`).not.toHaveURL(ON_ONBOARDING);
          await expect(setPassword.passwordInput).toHaveValue(value);
        });
      }
    });

    // FAILS on dev (2026-08-23): CREATE ACCOUNT is never `disabled` — it is
    // clickable with both fields blank and the box unticked. The app gates the
    // submit instead, which TC_MA_026b covers.
    test.fixme(
      'TC_MA_026 — CREATE ACCOUNT stays disabled until both fields and consent are set',
      defect(
        'CREATE ACCOUNT is never disabled — it is clickable with both fields blank and consent unticked.',
      ),
      async ({ merchantAccountPage: account, merchantOtpPage: otp, setPasswordPage: setPassword }) => {
        await openPasswordStep(account, otp, setPassword);
        const password = newAccountPassword();

        await expect(setPassword.submitButton).toBeDisabled();

        await setPassword.passwordInput.fill(password);
        await expect(setPassword.submitButton).toBeDisabled();

        await setPassword.confirmPasswordInput.fill(password);
        await expect(setPassword.submitButton, 'consent still unticked').toBeDisabled();

        await setPassword.acceptTerms();
        await expect(setPassword.submitButton).toBeEnabled();
      },
    );

    // FAILS on dev (2026-08-23): with the box unticked the submit is swallowed
    // in silence — nothing tells the user the consent is what is holding them
    // up. "You must accept the Terms and Conditions" does exist in the app, but
    // it surfaces only after other interactions have primed the error state; on
    // a first submit it never appears.
    test.fixme(
      'TC_MA_026c — the unticked consent box explains itself',
      defect(
        'With consent unticked the submit is swallowed in silence; the message exists but never surfaces on a first submit.',
      ),
      async ({ merchantAccountPage: account, merchantOtpPage: otp, setPasswordPage: setPassword }) => {
        await openPasswordStep(account, otp, setPassword);

        await setPassword.setPassword(newAccountPassword());
        await setPassword.createAccount();

        await expect(setPassword.message(messages.termsRequired)).toBeVisible();
      },
    );

    // FAILS on dev (2026-08-23): every rejected password gets the same message,
    // "Password is required", whatever the actual fault — so a user who typed
    // eight characters is told the field is empty. The documented wording never
    // appears. Same for TC_MA_028 and TC_MA_029.
    test.fixme(
      'TC_MA_027 — a password under 14 characters says it is too short',
      defect(
        'Every rejected password reports the same generic required message, whatever the fault; the documented wording never appears.',
      ),
      async ({ merchantAccountPage: account, merchantOtpPage: otp, setPasswordPage: setPassword }) => {
        await openPasswordStep(account, otp, setPassword);

        await setPassword.setPassword(passwords.short);
        await setPassword.acceptTerms();
        await setPassword.createAccount();

        await expect(setPassword.message(messages.documented.passwordTooShort)).toBeVisible();
      },
    );

    test.fixme(
      'TC_MA_028 — a long-enough password still needs every character class',
      defect(
        'Every rejected password reports the same generic required message; the complexity wording never appears.',
      ),
      async ({ merchantAccountPage: account, merchantOtpPage: otp, setPasswordPage: setPassword }) => {
        await openPasswordStep(account, otp, setPassword);

        await setPassword.setPassword(passwords.weakComplexity);
        await setPassword.acceptTerms();
        await setPassword.createAccount();

        await expect(setPassword.message(messages.documented.passwordComplexity)).toBeVisible();
      },
    );

    test.fixme(
      'TC_MA_029 — a confirm password that differs says the two must match',
      defect(
        'Every rejected password reports the same generic required message; the mismatch wording never appears.',
      ),
      async ({ merchantAccountPage: account, merchantOtpPage: otp, setPasswordPage: setPassword }) => {
        await openPasswordStep(account, otp, setPassword);

        await setPassword.setPassword(newAccountPassword(), passwords.mismatchConfirm);
        await setPassword.acceptTerms();
        await setPassword.createAccount();

        await expect(setPassword.message(messages.documented.passwordMismatch)).toBeVisible();
      },
    );

    // FAILS on dev (2026-08-23): neither consent link carries `target="_blank"`,
    // so both navigate in the same tab and take the half-finished registration
    // with them.
    test.fixme(
      'TC_MA_030b — each consent link opens its document in a new tab',
      defect(
        'Neither consent link carries target=_blank, so both navigate in the same tab and discard the half-finished registration.',
      ),
      async ({ merchantAccountPage: account, merchantOtpPage: otp, setPasswordPage: setPassword }) => {
        await openPasswordStep(account, otp, setPassword);

        await expect.soft(setPassword.termsLink).toHaveAttribute('target', '_blank');
        await expect.soft(setPassword.privacyLink).toHaveAttribute('target', '_blank');
      },
    );

    test('TC_MA_031 — a compliant password with consent creates the account and starts onboarding', async ({
      page,
      merchantAccountPage: account,
      merchantOtpPage: otp,
      setPasswordPage: setPassword,
    }) => {
      test.slow();

      const email = await openPasswordStep(account, otp, setPassword);

      await setPassword.setPassword(newAccountPassword());
      await setPassword.acceptTerms();
      await expect(setPassword.validationMessages).toHaveCount(0);

      const response = await setPassword.createAccountAndWaitForRegister();
      expect(
        response.ok(),
        `POST ${response.url()} answered ${response.status()} — the account was not created`,
      ).toBeTruthy();

      await expect(page).toHaveURL(ON_ONBOARDING, { timeout: 45_000 });
      log.info('merchant account created', { email });
    });
  },
);
