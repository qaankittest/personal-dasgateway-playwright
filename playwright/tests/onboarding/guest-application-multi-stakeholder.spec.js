// E2E: GUEST creates a merchant onboarding application with THREE stakeholders.
//
// A variant of guest-application.spec.js. Where that test edits the single
// seeded primary stakeholder, this one exercises the Stakeholders tab's "+"
// Add button: it edits the primary, adds two more stakeholders via "+", and
// asserts all three are listed before moving on.
//
// Coverage:
//   1. Full public sign-up — choose-account-type (Merchant) → account form →
//      e-mail OTP → password — landing the new GUEST on /onboarding.
//   2. The first-visit welcome modal + banner are dismissed.
//   3. Business Details filled and advanced.
//   4. Stakeholders — the primary is edited (100% UBO) and TWO more are added
//      via the "+" button; the test asserts three rows in the table.
//   5. Payout Details + Payment Methods filled.
//   6. The flow STOPS on the final (Submit) step — it asserts the "Submit
//      Application" CTA is reached but deliberately does NOT submit.
//
// Each run signs up a brand-new GUEST under a unique email, so the test is
// repeatable without an "email already registered" clash.
//
// Env (playwright/.env — see fixtures/test-config.js):
//   TEST_PASSWORD            password for the new GUEST account (reused).
//   TEST_OTP                 fixed verification OTP the dev backend accepts.
//   TEST_GUEST_EMAIL_DOMAIN  domain for the generated sign-up address.
// The suite is skipped when TEST_PASSWORD is not set, matching the login
// suite — a fresh checkout doesn't fail noisily before .env is configured.
import { test, expect } from '../../fixtures/base.js';
import { guestEmail } from '../../data/builders.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { log } from '../../utils/logger.js';

const HAS_PASSWORD = !!TEST_CONFIG.credentials.password;

test.describe('GUEST onboarding — application with three stakeholders', { tag: ['@regression', '@onboarding'] }, () => {
  test.skip(!HAS_PASSWORD, 'TEST_PASSWORD env var not set');

  test('signs up a fresh GUEST, adds three stakeholders, stopping at the final step', async ({
    page,
    guestSignUpPage: signUp,
    merchantRegistrationPage: registration,
  }) => {
    test.slow();

    const email = guestEmail();
    log.info('GUEST 3-stakeholder application e2e — sign-up email', { email });

    await test.step('sign up a fresh GUEST merchant', async () => {
      await signUp.registerMerchant(
        { firstName: 'PO', lastName: 'Tester', phone: '9012345678', email },
        TEST_CONFIG.credentials.password
      );
    });

    await test.step('land on the Merchant Registration shell', async () => {
      await registration.waitForReady();
      await expect(page).toHaveURL(new RegExp(`${TEST_CONFIG.routes.onboarding}(\\?|$|/)`));
    });

    await test.step('fill Business Details', async () => {
      await registration.fillBusinessTab();
    });

    await test.step('add three stakeholders — primary + two via the "+" button', async () => {
      // The seeded primary's email field is disabled and prefilled with the
      // account-creation email — `fillStakeholdersTabWithThree` asserts that.
      await registration.fillStakeholdersTabWithThree(email);
    });

    await test.step('fill Payout Details', async () => {
      await registration.fillPayoutTab();
    });

    await test.step('fill Payment Methods', async () => {
      await registration.fillPaymentTab();
    });

    await test.step('stop at the final step — do NOT submit', async () => {
      await expect(
        registration.submitStepTab,
        'the wizard should be on the final (Submit) step'
      ).toBeVisible({ timeout: 30_000 });
      // The submit step's footer drops the Next button.
      await expect(registration.nextButton).toHaveCount(0);
      log.info('Reached the Submit step — leaving the application unsubmitted.');
    });
  });
});
