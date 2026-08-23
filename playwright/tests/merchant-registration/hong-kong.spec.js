// Merchant Account Creation — the Hong Kong market.
// Covers Merchant_Account_Creation_HongKong_Functional_Test_Cases.pdf
// (TC_MA_HK_001 – TC_MA_HK_035).
//
// The wizard is the same one the Japan suite drives; only the market data
// changes. Re-implementing all 35 cases here would duplicate ~25 tests that
// differ by one dropdown value, and — because /onboarding/verify-email is
// rate-limited (429) — a second full set of registrations would break the run
// for both suites. So this file carries what is genuinely Hong Kong specific
// and inherits the rest.
//
// COVERAGE MAP — every case in the document, and where it is verified:
//
//   HK_001–006     market-agnostic screens, already covered by
//                  registration-entry.spec.js and merchant-account-form.spec.js.
//   HK_007         "the account form offers the Hong Kong market" below.
//   HK_008         same test — the +852 dialling code.
//   HK_009         NOT COVERED. The Country Code does not follow the Country:
//                  picking Hong Kong leaves the code at +81 and it has to be set
//                  by hand (re-verified 2026-08-24, same defect the Japan suite
//                  found). The document's Open Point #3 also leaves it undecided
//                  whether the two fields should be coupled at all.
//   HK_010, 011    NOT COVERED — the same two defects the Japan document hit:
//                  the submit button is never disabled, and a blank submit
//                  renders no message. See merchant-account-form.spec.js.
//   HK_012         market-agnostic; covered by TC_MA_012.
//   HK_013         partly covered below: with Hong Kong selected, letters and
//                  symbols are refused client-side. The 8-digit **length** rule
//                  is NOT covered — the dev build accepts both 9123 (4 digits)
//                  and 912345678901 (12 digits), answering 201 and advancing to
//                  the OTP step, where the same build refuses out-of-range Japan
//                  numbers outright. The document's Open Point #2 leaves the
//                  Hong Kong length unconfirmed, so the fixture holds those two
//                  values (`invalid.unenforcedLengths`) and nothing asserts them
//                  until the rule is settled.
//   HK_014, 015    market-agnostic; covered by TC_MA_014 (removed defect) and
//                  TC_MA_015.
//   HK_016         "a Hong Kong merchant registers…" below, first step.
//   HK_017–030     the OTP and password cards are identical in every market;
//                  covered in depth by otp-verification.spec.js and
//                  set-password.spec.js. The Hong Kong journey below still walks
//                  both, so a market-specific regression there would surface.
//   HK_031–034     the same journey's closing steps.
//   HK_035         the reason this file exists — the Hong Kong market has to
//                  survive into onboarding.
//
// @mutating: the journey creates a real Hong Kong merchant on dev under a
// unique mailinator address. One registration for the whole file.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import {
  buildHongKongAccount,
  loadHongKongRegistration,
  loadMerchantRegistration,
  newAccountPassword,
  verificationOtp,
} from '../../fixtures/merchant-registration/load.js';
import { VERIFY_EMAIL_ENDPOINT } from '../../pages/merchant-registration/MerchantAccountPage.js';
import { log } from '../../utils/logger.js';

const { market, invalid, onboarding } = loadHongKongRegistration();
const { copy } = loadMerchantRegistration();

const HAS_PASSWORD = !!TEST_CONFIG.credentials.password;
const ON_SIGN_UP = new RegExp(`${TEST_CONFIG.routes.signUp}$`);
const ON_ONBOARDING = /\/onboarding\?step=business/;

test.describe(
  'Merchant registration — the Hong Kong market',
  { tag: ['@regression', '@mutating'] },
  () => {
    test('TC_MA_HK_007/008/013 — the account form offers Hong Kong, its dialling code, and screens its phone field', async ({
      page,
      merchantAccountPage: account,
    }) => {
      await account.goto();

      await test.step('TC_MA_HK_007 — Hong Kong is listed and selectable', async () => {
        await account.openCountryMenu();

        const names = (await account.optionMenu.getByRole('button').allInnerTexts())
          .map((n) => n.trim())
          .filter(Boolean);
        expect(new Set(names).size, 'the country list must not repeat an entry').toBe(names.length);
        expect(names, 'countries are listed alphabetically').toEqual([...names].sort());
        expect(
          names,
          `Hong Kong must be offered under a name the business recognises, got: ${names}`,
        ).toContain(market.country);

        await account.optionSearchInput.fill('Hong');
        await expect(account.option(market.country)).toBeVisible();
        await account.option(market.country).click();
        await expect(account.countrySelect).toHaveText(market.country);
        await expect(account.optionMenu).toBeHidden();
      });

      await test.step('TC_MA_HK_008 — +852 is offered and selectable', async () => {
        await account.selectPhoneCode(market.phoneCode);
        await expect(account.phoneCodeSelect).toHaveText(market.phoneCode);
      });

      await test.step('TC_MA_HK_013 — letters and symbols never reach the backend', async () => {
        for (const [label, phone] of Object.entries(invalid.phones)) {
          const merchant = buildHongKongAccount({ phone });

          let requested = false;
          const watcher = (/** @type {import('@playwright/test').Request} */ request) => {
            if (request.url().includes(VERIFY_EMAIL_ENDPOINT)) requested = true;
          };
          page.on('request', watcher);

          await account.fillAccount({
            firstName: merchant.firstName,
            lastName: merchant.lastName,
            phone: merchant.phone,
            email: merchant.email,
          });
          await account.submit();

          // The form stays put *and* asks the backend nothing — checking only
          // the screen would pass while a request was still in flight.
          await expect(page, `a ${label} phone must not advance the wizard`).toHaveURL(ON_SIGN_UP);
          await expect(page.getByText(copy.otp.heading)).toBeHidden();
          expect(requested, `a ${label} phone must not reach ${VERIFY_EMAIL_ENDPOINT}`).toBe(false);

          page.off('request', watcher);
        }
      });
    });

    test('TC_MA_HK_016/031/035 — a Hong Kong merchant registers and lands on the Hong Kong onboarding', async ({
      page,
      merchantAccountPage: account,
      merchantOtpPage: otp,
      setPasswordPage: setPassword,
      onboardingWelcomePage: welcome,
    }) => {
      test.skip(!HAS_PASSWORD, 'TEST_PASSWORD not set — no password to register with');
      test.slow();

      const merchant = buildHongKongAccount();

      await test.step('TC_MA_HK_016 — valid Hong Kong details are accepted', async () => {
        await account.goto();
        await account.fillAccount(merchant);

        // The code has to be set by hand: selecting the country does not carry
        // it across on this build (HK_009, see the header).
        await expect(account.countrySelect).toHaveText(market.country);
        await expect(account.phoneCodeSelect).toHaveText(market.phoneCode);
        expect(
          merchant.phone.length,
          'the document specifies an 8-digit Hong Kong number',
        ).toBe(market.phoneDigits);

        const response = await account.submitAndWaitForVerifyEmail();
        test.skip(
          response.status() === 429,
          'POST /onboarding/verify-email is rate-limited right now — rerun once the window clears',
        );
        expect(
          response.ok(),
          `POST ${VERIFY_EMAIL_ENDPOINT} answered ${response.status()}`,
        ).toBeTruthy();
      });

      await test.step('TC_MA_HK_017/018 — the OTP card is addressed to the Hong Kong applicant', async () => {
        await otp.waitForReady();
        await expect(otp.heading).toHaveText(copy.otp.heading);
        await expect(otp.otpInputs).toHaveCount(copy.otp.boxCount);
        await expect(otp.verifyButton).toBeDisabled();
        await expect(otp.instruction).toContainText(merchant.email);
      });

      await test.step('TC_MA_HK_022 — the correct code opens the password card', async () => {
        await otp.enterOtp(verificationOtp());
        const verified = await otp.verifyAndWaitForResponse();
        expect(verified.ok(), `verify-otp answered ${verified.status()}`).toBeTruthy();
        await setPassword.waitForReady();
      });

      await test.step('TC_MA_HK_031 — a compliant password creates the account', async () => {
        await setPassword.setPassword(newAccountPassword());
        await setPassword.acceptTerms();
        await expect(setPassword.validationMessages).toHaveCount(0);

        const registered = await setPassword.createAccountAndWaitForRegister();
        expect(
          registered.ok(),
          `register answered ${registered.status()} — the account was not created`,
        ).toBeTruthy();

        await expect(page).toHaveURL(ON_ONBOARDING, { timeout: 45_000 });
        log.info('hong kong merchant created', { email: merchant.email });
      });

      await test.step('TC_MA_HK_032/033/034 — the welcome banner hands over to the form', async () => {
        await welcome.waitForReady();
        await expect(welcome.subHeading).toBeVisible();

        await welcome.continueToInstructions();
        await expect(welcome.instruction).toBeVisible();
        await expect(welcome.startNowButton).toBeVisible();

        await welcome.startNow();
        await expect(welcome.businessDetailsSection).toBeVisible();
      });

      await test.step('TC_MA_HK_035 — onboarding carries the Hong Kong market, not the default', async () => {
        // The market itself, read from the field the application is filed under.
        await expect(
          welcome.businessLocationField,
          'the country chosen at registration must survive into onboarding',
        ).toHaveText(market.country);

        // …and the field set that market configures. Hong Kong asks for one
        // combined registration document and no Postcode, where Japan asks for
        // two separate uploads and a Postcode — so these two assertions are what
        // separate "Hong Kong" from "the default set with a Hong Kong label".
        await expect(
          welcome.formField(onboarding.hongKongDocument),
          'the Hong Kong document set must be presented',
        ).toBeVisible();
        await expect(
          welcome.postcodeField,
          `${onboarding.japanOnlyField} belongs to the Japan field set, not Hong Kong`,
        ).toBeHidden();
        await expect(welcome.cityField).toBeVisible();
      });
    });
  },
);
