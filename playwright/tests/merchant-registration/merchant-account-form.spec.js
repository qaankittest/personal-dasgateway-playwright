// Merchant Account Creation — the "Create Your Merchant Account" form.
// Covers TC_MA_006 – TC_MA_016 of
// Merchant_Account_Creation_Functional_Test_Cases.pdf.
//
// Only TC_MA_016 submits, so only that one is @mutating: a successful submit
// posts /onboarding/verify-email and starts a registration against a unique
// mailinator address. Every other case stays client-side.
//
// Six cases in this file are parked with `test.fixme`. Each one is written to
// the behaviour the test-case document specifies and fails against the current
// dev build; the comment above each states what the app does instead. They are
// bug reports in executable form, not skipped work — unpark them when the app
// catches up.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import {
  buildMerchantAccount,
  loadMerchantRegistration,
} from '../../fixtures/merchant-registration/load.js';
import { log } from '../../utils/logger.js';

const { copy, countries, invalid, messages } = loadMerchantRegistration();

const ON_ACCOUNT_TYPE = new RegExp(`${TEST_CONFIG.routes.chooseAccountType}$`);
const ON_SIGN_UP = new RegExp(`${TEST_CONFIG.routes.signUp}$`);

test.describe('Merchant registration — the account form', { tag: ['@regression'] }, () => {
  test('TC_MA_006 — every field is present, in order, with its placeholder', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();

    await expect.soft(account.firstNameInput).toHaveAttribute('placeholder', copy.account.placeholders.firstName);
    await expect.soft(account.lastNameInput).toHaveAttribute('placeholder', copy.account.placeholders.lastName);
    await expect.soft(account.phoneInput).toHaveAttribute('placeholder', copy.account.placeholders.phone);
    await expect.soft(account.emailInput).toHaveAttribute('placeholder', copy.account.placeholders.email);
    await expect.soft(account.countrySelect).toBeVisible();
    await expect.soft(account.phoneCodeSelect).toBeVisible();

    // Order, read off the DOM rather than off the screenshot: First Name, Last
    // Name, Country, Country Code, Phone Number, Email Address.
    const order = await account.form.evaluate((form) =>
      [...form.querySelectorAll('input, button[id]')]
        .map((el) => el.id)
        .filter((id) => ['firstName', 'lastName', 'businessLocation', 'phoneCode', 'phoneNumber', 'email'].includes(id)),
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
    expect(codes.every((c) => /^\+\d+$/.test(c)), `every entry is a dialling code, got: ${codes.slice(0, 5)}`).toBe(true);
    expect(new Set(codes).size, 'the dialling-code list must not repeat an entry').toBe(codes.length);

    await account.optionMenu.getByRole('button', { name: '+852', exact: true }).click();
    await expect(account.phoneCodeSelect).toHaveText('+852');
  });

  // FAILS on dev (2026-08-23): the Country Code field does not follow the
  // Country. Selecting Hong Kong leaves the code at +81, and switching back to
  // Japan leaves whatever was there. The two selects are independent.
  test.fixme('TC_MA_009 — the country code follows the selected country', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();

    for (const { name, phoneCode } of countries) {
      await account.selectCountry(name);
      await expect(account.countrySelect).toHaveText(name);
      await expect(
        account.phoneCodeSelect,
        `selecting ${name} must populate its dialling code`,
      ).toHaveText(phoneCode);
    }
  });

  // FAILS on dev (2026-08-23): CLICK TO VERIFY EMAIL ID is never `disabled` —
  // it is clickable with every field blank. The app instead swallows the
  // submit, focusing the first empty field.
  test.fixme('TC_MA_010 — the submit button stays disabled until every field is filled', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();
    const merchant = buildMerchantAccount();

    await expect(account.submitButton).toBeDisabled();

    await account.fillAccount({ firstName: merchant.firstName });
    await expect(account.submitButton).toBeDisabled();

    await account.fillAccount({ lastName: merchant.lastName });
    await expect(account.submitButton).toBeDisabled();

    await account.fillAccount({ phone: merchant.phone });
    await expect(account.submitButton, 'still blank: Email Address').toBeDisabled();

    await account.fillAccount({ email: merchant.email });
    await expect(account.submitButton).toBeEnabled();
  });

  // FAILS on dev (2026-08-23): a blank submit renders no message at all — the
  // app only moves focus to First Name. The four "… is required" strings do
  // exist, but they surface only on a *later* submit and then stay put even
  // once the field holds a value, so they never describe the current state.
  test.fixme('TC_MA_011 — each blank field names itself in its error message', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();
    await account.submit();

    await expect.soft(account.message(messages.firstNameRequired)).toBeVisible();
    await expect.soft(account.message(messages.lastNameRequired)).toBeVisible();
    await expect.soft(account.message(messages.phoneRequired)).toBeVisible();
    await expect.soft(account.message(messages.emailRequired)).toBeVisible();

    // …and each clears once its own field is filled.
    await account.fillAccount(buildMerchantAccount());
    await expect(account.validationMessages).toHaveCount(0);
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

  // FAILS on dev (2026-08-23): the screen refuses the address (TC_MA_012 above
  // proves that much) but tells the user nothing — no message renders beside
  // the field, so a real user is left guessing why nothing happened.
  test.fixme('TC_MA_012b — a malformed email address explains itself', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();
    await account.fillAccount({ ...buildMerchantAccount(), email: invalid.emails[0] });
    await account.submit();

    await expect(account.validationMessages).not.toHaveCount(0);
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

  // FAILS on dev (2026-08-23): the Phone Number field accepts letters and
  // symbols into its value — `abcdefghi` sits in the box untouched — and the
  // rejection that follows carries no message.
  test.fixme('TC_MA_013b — the phone field refuses letters and symbols outright', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();
    await account.phoneInput.fill(invalid.phones.alphabetic);
    await expect(account.phoneInput).toHaveValue('');

    await account.phoneInput.fill(invalid.phones.symbols);
    await expect(account.phoneInput).toHaveValue('');
  });

  // FAILS on dev (2026-08-23): the name fields accept anything. `12345` and
  // `@#$%` are stored verbatim with no message, there is no `maxlength`, and
  // surrounding spaces are not trimmed.
  test.fixme('TC_MA_014 — the name fields reject digits, symbols and overlong input', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();

    await account.firstNameInput.fill(invalid.names.numeric);
    await account.lastNameInput.fill(invalid.names.symbols);
    await account.submit();
    await expect(account.validationMessages).not.toHaveCount(0);

    await account.firstNameInput.fill(invalid.names.tooLong);
    const stored = await account.firstNameInput.inputValue();
    expect(stored.length, 'input is capped at the permitted maximum').toBeLessThan(
      invalid.names.tooLong.length,
    );

    await account.firstNameInput.fill(invalid.names.padded);
    await account.lastNameInput.click();
    await expect(account.firstNameInput, 'surrounding spaces are trimmed').toHaveValue(
      invalid.names.padded.trim(),
    );
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
      expect(
        response.ok(),
        `POST ${response.url()} must succeed for the wizard to advance`,
      ).toBeTruthy();

      await expect(otp.heading).toBeVisible();
      await expect(otp.otpInputs).toHaveCount(copy.otp.boxCount);
      await expect(account.validationMessages).toHaveCount(0);

      log.info('merchant registration started', { email: merchant.email });
    });
  },
);
