// Merchant Account Creation — the "Create Your Merchant Account" form.
// Covers TC_MA_006 – TC_MA_016 of
// Merchant_Account_Creation_Functional_Test_Cases.pdf.
//
// Only TC_MA_016 submits, so only that one is @mutating: a successful submit
// posts /onboarding/verify-email and starts a registration against a unique
// mailinator address. Every other case stays client-side.
//
// NOT COVERED HERE — six cases from the document describe behaviour this build
// does not implement, and their tests were removed on request (2026-08-24)
// rather than left parked. Recorded so the gap stays visible; write them back
// once the app catches up, and see `pages/merchant-registration/
// MerchantAccountPage.js` for the full observations:
//
//   TC_MA_009  the Country Code does not follow the Country — picking Hong Kong
//              leaves +81; the two selects are independent.
//   TC_MA_010  CLICK TO VERIFY EMAIL ID is never disabled, even with every
//              field blank.
//   TC_MA_011  a blank submit renders no message; the "… is required" strings
//              appear only on a later submit and then persist once the field
//              holds a value.
//   TC_MA_012b a malformed address is refused (TC_MA_012 proves it) but no
//              message ever renders.
//   TC_MA_013b Phone Number stores letters and symbols verbatim, and the
//              rejection that follows carries no message.
//   TC_MA_014  First/Last Name accept digits and symbols, have no maximum
//              length, and do not trim surrounding spaces.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import {
  buildMerchantAccount,
  loadMerchantRegistration,
} from '../../fixtures/merchant-registration/load.js';
import { log } from '../../utils/logger.js';

const { copy, countries, invalid } = loadMerchantRegistration();

const ON_ACCOUNT_TYPE = new RegExp(`${TEST_CONFIG.routes.chooseAccountType}$`);
const ON_SIGN_UP = new RegExp(`${TEST_CONFIG.routes.signUp}$`);

test.describe('Merchant registration — the account form', { tag: ['@regression'] }, () => {
  test('TC_MA_006 — every field is present, in order, with its placeholder', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();

    await expect
      .soft(account.firstNameInput)
      .toHaveAttribute('placeholder', copy.account.placeholders.firstName);
    await expect
      .soft(account.lastNameInput)
      .toHaveAttribute('placeholder', copy.account.placeholders.lastName);
    await expect
      .soft(account.phoneInput)
      .toHaveAttribute('placeholder', copy.account.placeholders.phone);
    await expect
      .soft(account.emailInput)
      .toHaveAttribute('placeholder', copy.account.placeholders.email);
    await expect.soft(account.countrySelect).toBeVisible();
    await expect.soft(account.phoneCodeSelect).toBeVisible();

    // Order, read off the DOM rather than off the screenshot: First Name, Last
    // Name, Country, Country Code, Phone Number, Email Address.
    const order = await account.form.evaluate((form) =>
      [...form.querySelectorAll('input, button[id]')]
        .map((el) => el.id)
        .filter((id) =>
          ['firstName', 'lastName', 'businessLocation', 'phoneCode', 'phoneNumber', 'email'].includes(
            id,
          ),
        ),
    );
    expect(order).toEqual([
      'firstName',
      'lastName',
      'businessLocation',
      'phoneCode',
      'phoneNumber',
      'email',
    ]);
  });

  test('TC_MA_007 — the Country menu lists the supported countries and selects one', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();

    await test.step('the menu opens with a searchable, duplicate-free list', async () => {
      await account.openCountryMenu();
      await expect(account.optionSearchInput).toBeVisible();

      const options = await account.optionMenu.getByRole('button').allInnerTexts();
      const names = options.map((o) => o.trim()).filter(Boolean);

      // Dev offers exactly two countries; assert the set rather than a count so
      // the failure names what changed.
      expect(new Set(names).size, 'the country list must not repeat an entry').toBe(names.length);
      expect(names).toEqual(countries.map((c) => c.name));
      expect(names, 'countries are listed alphabetically').toEqual([...names].sort());
    });

    await test.step('search narrows the list', async () => {
      await account.optionSearchInput.fill('Jap');
      await expect(account.optionMenu.getByRole('button', { name: 'Japan' })).toBeVisible();
      await expect(account.optionMenu.getByRole('button', { name: 'Hong Kong' })).toBeHidden();
    });

    await test.step('picking Japan closes the menu and shows the choice', async () => {
      await account.optionMenu.getByRole('button', { name: 'Japan' }).click();
      await expect(account.countrySelect).toHaveText('Japan');
      await expect(account.optionMenu).toBeHidden();
    });
  });

  test('TC_MA_008 — the Country Code menu lists dialling codes and selects one', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();
    await account.openPhoneCodeMenu();

    const codes = (await account.optionMenu.getByRole('button').allInnerTexts())
      .map((c) => c.trim())
      .filter(Boolean);

    expect(codes.length, 'the dialling-code list must not be empty').toBeGreaterThan(1);
    expect(
      codes.every((c) => /^\+\d+$/.test(c)),
      `every entry is a dialling code, got: ${codes.slice(0, 5)}`,
    ).toBe(true);
    expect(new Set(codes).size, 'the dialling-code list must not repeat an entry').toBe(codes.length);

    await account.optionMenu.getByRole('button', { name: '+852', exact: true }).click();
    await expect(account.phoneCodeSelect).toHaveText('+852');
  });

  test('TC_MA_012 — a malformed email address never leaves the screen', async ({
    page,
    merchantAccountPage: account,
  }) => {
    // A fresh form per address: the app's error state is sticky once a submit
    // has failed, so reusing one form would test the leftovers, not the address.
    for (const email of invalid.emails) {
      await test.step(`"${email}" is rejected`, async () => {
        await account.goto();
        await account.fillAccount({ ...buildMerchantAccount(), email });
        await account.submit();

        await expect(page).toHaveURL(ON_SIGN_UP);
        await expect(account.emailInput).toHaveValue(email);
        await expect(
          page.getByText(copy.otp.heading),
          `"${email}" must not reach the OTP step`,
        ).toBeHidden();
      });
    }
  });

  test('TC_MA_013 — a phone number the app rejects never leaves the screen', async ({
    page,
    merchantAccountPage: account,
  }) => {
    for (const [label, phone] of Object.entries(invalid.phones)) {
      await test.step(`${label} ("${phone}") is rejected`, async () => {
        await account.goto();
        await account.fillAccount({ ...buildMerchantAccount(), phone });
        await account.submit();

        await expect(page).toHaveURL(ON_SIGN_UP);
        await expect(page.getByText(copy.otp.heading)).toBeHidden();
      });
    }
  });

  test('TC_MA_015 — Back to Start returns to the entry screen and discards the entries', async ({
    page,
    merchantAccountPage: account,
    accountTypePage: entry,
  }) => {
    const merchant = buildMerchantAccount();

    await account.goto();
    await account.fillAccount({ firstName: merchant.firstName, email: merchant.email });
    await account.backToStart();

    await expect(page).toHaveURL(ON_ACCOUNT_TYPE);
    await expect(entry.heading).toBeVisible();

    await test.step('reopening the form shows it empty', async () => {
      await entry.chooseMerchant();
      await expect(account.firstNameInput).toHaveValue('');
      await expect(account.emailInput).toHaveValue('');
    });
  });
});

test.describe(
  'Merchant registration — submitting the account form',
  { tag: ['@regression', '@mutating'] },
  () => {
    test('TC_MA_016 — valid details are accepted and advance to the OTP step', async ({
      merchantAccountPage: account,
      merchantOtpPage: otp,
    }) => {
      const merchant = buildMerchantAccount();

      await account.goto();
      await account.fillAccount(merchant);

      const response = await account.submitAndWaitForVerifyEmail();

      // The dev sign-up endpoint throttles: once a run has registered a handful
      // of merchants the rest of the window answers 429. That is an environment
      // limit, not a product defect, so a throttled run reports as
      // skipped-with-a-reason rather than as a red build.
      test.skip(
        response.status() === 429,
        'POST /onboarding/verify-email is rate-limited right now — rerun once the window clears',
      );

      expect(
        response.ok(),
        `POST ${response.url()} answered ${response.status()} — a 429 here means the run tripped the rate limit`,
      ).toBeTruthy();

      await expect(otp.heading).toBeVisible();
      await expect(otp.otpInputs).toHaveCount(copy.otp.boxCount);
      await expect(account.validationMessages).toHaveCount(0);

      log.info('merchant registration started', { email: merchant.email });
    });
  },
);
