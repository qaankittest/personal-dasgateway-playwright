// E2E: GUESTTHIRDPARTY (reseller) creates a Sole-Prop partner application,
// starting from the public Sign-In page.
//
// Flow:
//   /login → "Create an Account" link → /choose-account-type → Partner card
//   → /onboarding/sign-up (account → OTP → password) → /onboarding
//   → Business Details (Company Type = Sole Proprietor / Sole Trader)
//   → Stakeholders Details → Payout Details → Submit Application
//
// The partner wizard has NO Payment Methods step (per
// `buildOnboardingSteps({ isPartner: true })`), so the last data step is
// Payout — Next from there lands on the final Submit Application tab.
//
// The test STOPS on the Submit step — the "Submit Application" CTA must be
// reached but the application is deliberately NOT submitted, leaving it
// PENDING / in-progress (same posture as the merchant onboarding suite).
//
// Each run signs up a brand-new GUESTTHIRDPARTY under a unique email, so the
// suite is repeatable without an "email already registered" clash.
//
// Env (playwright/.env — see fixtures/test-config.js):
//   TEST_PASSWORD            password for the new GUESTTHIRDPARTY account.
//   TEST_OTP                 fixed verification OTP the dev backend accepts.
//   TEST_GUEST_EMAIL_DOMAIN  domain for the generated sign-up address.
// The suite is skipped when TEST_PASSWORD is not set — a fresh checkout
// doesn't fail noisily before .env is configured.
import { test, expect } from '../../fixtures/base.js';
import { guestEmail } from '../../data/builders.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { log } from '../../utils/logger.js';

const HAS_PASSWORD = !!TEST_CONFIG.credentials.password;

test.describe('GUESTTHIRDPARTY onboarding — Sole-Prop reseller application', { tag: ['@regression', '@onboarding'] }, () => {
  test.skip(!HAS_PASSWORD, 'TEST_PASSWORD env var not set');

  test('starts from /login, signs up a Partner (Sole-Prop), fills every tab, stops at Submit', async ({
    page,
    guestSignUpPage: signUp,
    merchantRegistrationPage: registration,
  }) => {
    test.slow();

    const email = guestEmail();
    log.info('Partner SOLE application e2e — sign-up email', { email });

    await test.step('start on /login and cross to /choose-account-type', async () => {
      await signUp.gotoFromLogin();
      await expect(page).toHaveURL(new RegExp(TEST_CONFIG.routes.chooseAccountType));
    });

    await test.step('choose the Partner (reseller) card and complete sign-up', async () => {
      await signUp.selectPartner();
      await signUp.fillAccount({
        firstName: 'PO',
        lastName: 'Reseller',
        phone: '9012345678',
        email,
      });
      await signUp.submitOtp(TEST_CONFIG.otp);
      await signUp.setPassword(TEST_CONFIG.credentials.password);
    });

    await test.step('land on the Merchant Registration shell (partner flow)', async () => {
      await registration.waitForReady();
      await expect(page).toHaveURL(new RegExp(`${TEST_CONFIG.routes.onboarding}(\\?|$|/)`));
      // The partner wizard drops the Payment Methods step — sanity-check that
      // the step strip omits it before we drive the form.
      await expect(
        page.getByRole('tab', { name: /payment methods/i }),
        'partner onboarding wizard should NOT include a Payment Methods step'
      ).toHaveCount(0);
    });

    await test.step('fill Business Details — Company Type: Sole Proprietor', async () => {
      await registration.fillPartnerSoleBusinessTab();
    });

    await test.step('pass through Stakeholders', async () => {
      // The seeded primary stakeholder's email is the account-creation
      // email; `fillStakeholdersTab` asserts that disabled+prefilled field.
      await registration.fillStakeholdersTab(email);
    });

    await test.step('fill Payout Details (partner flow → Submit is next)', async () => {
      await registration.fillPartnerPayoutTab();
    });

    await test.step('stop at the final step — do NOT submit', async () => {
      await expect(
        registration.submitStepTab,
        'the wizard should be on the final (Submit) step'
      ).toBeVisible({ timeout: 30_000 });
      // The submit step's footer drops the Next button.
      await expect(registration.nextButton).toHaveCount(0);
      log.info(
        'Partner SOLE: reached the Submit Application step — leaving the application unsubmitted.'
      );
    });
  });
});
