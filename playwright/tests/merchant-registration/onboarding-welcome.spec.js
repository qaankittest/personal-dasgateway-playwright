// Merchant Account Creation — where registration hands over to onboarding.
// Covers TC_MA_032 – TC_MA_034 of
// Merchant_Account_Creation_Functional_Test_Cases.pdf.
//
// All three cases describe one continuous handover — welcome banner, then its
// instruction step, then the form behind it — and each needs an account that
// has just been created. Registering three times to assert three halves of the
// same banner would triple the backend writes for nothing, so this is one test
// with three steps (SKILL §9: multi-step flows are one test with steps).
//
// @mutating: reaching the banner means creating a real merchant account on dev.
//
// Execution stops at the Business Details section — the onboarding form's own
// field validation belongs to the onboarding suite.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import {
  buildMerchantAccount,
  loadMerchantRegistration,
  newAccountPassword,
  verificationOtp,
} from '../../fixtures/merchant-registration/load.js';
import { log } from '../../utils/logger.js';
import { escapeRegExp } from '../../utils/dasForm.js';
import { VERIFY_EMAIL_ENDPOINT } from '../../pages/merchant-registration/MerchantAccountPage.js';
import { VERIFY_OTP_ENDPOINT } from '../../pages/merchant-registration/MerchantOtpPage.js';

const { copy } = loadMerchantRegistration();

/** The banner's copy is CSS-uppercased, so the fixture's rendered wording is
 *  matched against the DOM's own casing. */
const asRendered = (text) => new RegExp(`^${escapeRegExp(text)}$`, 'i');
const HAS_PASSWORD = !!TEST_CONFIG.credentials.password;

test.describe(
  'Merchant registration — the onboarding handover',
  { tag: ['@regression', '@onboarding', '@mutating'] },
  () => {
    test.skip(!HAS_PASSWORD, 'TEST_PASSWORD not set — no password to register with');

    test('TC_MA_032/033/034 — the welcome banner explains onboarding and opens the form', async ({
      page,
      merchantAccountPage: account,
      merchantOtpPage: otp,
      setPasswordPage: setPassword,
      onboardingWelcomePage: welcome,
    }) => {
      test.slow();

      const merchant = buildMerchantAccount();

      await test.step('register a new merchant', async () => {
        await account.goto();
        await account.fillAccount(merchant);
        const requested = await account.submitAndWaitForVerifyEmail();

        // Environment limit, not a product defect — see the other specs in this
        // folder: a throttled run is skipped with a reason, not failed.
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
        await setPassword.setPassword(newAccountPassword());
        await setPassword.acceptTerms();

        const response = await setPassword.createAccountAndWaitForRegister();
        expect(response.ok(), `POST ${response.url()} must create the account`).toBeTruthy();
        log.info('merchant account created', { email: merchant.email });
      });

      await test.step('TC_MA_032 — the welcome banner names what onboarding will ask for', async () => {
        await welcome.waitForReady();

        await expect.soft(welcome.heading).toHaveText(asRendered(copy.welcome.heading));
        await expect.soft(welcome.subHeading).toHaveText(asRendered(copy.welcome.subHeading));
        for (const { title, body } of copy.welcome.cards) {
          await expect.soft(welcome.card(title), `card "${title}"`).toBeVisible();
          await expect.soft(welcome.cardBody(body), `body of "${title}"`).toBeVisible();
        }
        await expect.soft(welcome.continueButton).toHaveText(asRendered(copy.welcome.continue));
      });

      await test.step('TC_MA_033 — CONTINUE explains that progress can be resumed', async () => {
        await welcome.continueToInstructions();

        await expect(welcome.instruction).toBeVisible();
        await expect(welcome.instructionBody).toBeVisible();
        await expect(welcome.startNowButton).toBeVisible();
        await expect(welcome.closeBannerButton).toBeVisible();
      });

      await test.step('TC_MA_034 — START NOW closes the banner onto Business Details', async () => {
        await welcome.startNow();

        await expect(welcome.instruction).toBeHidden();
        await expect(welcome.startNowButton).toBeHidden();
        await expect(welcome.businessDetailsSection).toBeVisible();
        await expect(welcome.applicationRefId).toBeVisible();
        await expect(page).toHaveURL(/\/onboarding\?step=business/);
      });
    });
  },
);
