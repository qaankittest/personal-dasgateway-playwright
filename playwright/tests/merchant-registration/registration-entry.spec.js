// Merchant Account Creation — the registration entry screen.
// Covers TC_MA_001 – TC_MA_005 of
// Merchant_Account_Creation_Functional_Test_Cases.pdf.
//
// Read-only: nothing here submits the form, so no registration is started and
// no backend record is touched. Everything on this file is client-side
// rendering and navigation.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { loadMerchantRegistration } from '../../fixtures/merchant-registration/load.js';

const { copy } = loadMerchantRegistration();

const ON_LOGIN = new RegExp(`${TEST_CONFIG.routes.login}$`);
const ON_ACCOUNT_TYPE = new RegExp(`${TEST_CONFIG.routes.chooseAccountType}$`);
const ON_SIGN_UP = new RegExp(`${TEST_CONFIG.routes.signUp}$`);

test.describe('Merchant registration — choosing an account type', { tag: ['@regression'] }, () => {
  test('TC_MA_001 — Create an Account on Sign In opens the registration entry screen', async ({
    page,
    accountTypePage: entry,
  }) => {
    await test.step('take the link from the Sign In screen', async () => {
      await entry.gotoFromLogin();
    });

    await test.step('the entry card is rendered', async () => {
      await expect(page).toHaveURL(ON_ACCOUNT_TYPE);
      await expect(entry.heading).toBeVisible();
      await expect(entry.merchantCard).toBeVisible();
      await expect(entry.partnerCard).toBeVisible();
    });
  });

  test('TC_MA_002 — the screen states its purpose and labels both options', async ({
    accountTypePage: entry,
  }) => {
    await entry.goto();

    // Soft, so one copy change reports every mismatch in a single run instead
    // of hiding the rest behind the first failure.
    await expect.soft(entry.heading).toHaveText(copy.entry.heading);
    await expect.soft(entry.subText).toHaveText(copy.entry.subText);
    await expect.soft(entry.merchantCard).toContainText(copy.entry.merchantCard);
    await expect.soft(entry.partnerCard).toContainText(copy.entry.partnerCard);
    await expect.soft(entry.haveAccountText).toHaveText(copy.entry.haveAccount);
    await expect.soft(entry.signInLink).toHaveText(copy.entry.signInLink);
    await expect.soft(entry.signInLink).toHaveAttribute('href', TEST_CONFIG.routes.login);
    await expect.soft(entry.languageButton).toHaveText(copy.entry.language);
  });

  test('TC_MA_003 — Sign in here returns to an empty Sign In form', async ({
    page,
    accountTypePage: entry,
    loginPage: login,
  }) => {
    await entry.goto();
    await entry.backToSignIn();

    await expect(page).toHaveURL(ON_LOGIN);
    await expect(login.emailInput).toHaveValue('');
    await expect(login.passwordInput).toHaveValue('');
  });

  test('TC_MA_004 — Register as a Merchant opens the merchant form, not the partner one', async ({
    page,
    accountTypePage: entry,
    merchantAccountPage: account,
  }) => {
    await entry.goto();
    await entry.chooseMerchant();

    await expect(page).toHaveURL(ON_SIGN_UP);
    await expect(account.heading).toBeVisible();
    await expect(account.firstNameInput).toBeVisible();
    // The partner branch has its own copy — proving it is absent is what makes
    // this a routing test rather than a "some form rendered" test.
    await expect(page.getByText('Create Your Partner Account')).toBeHidden();
  });

  test('TC_MA_005 — the merchant form states its purpose and labels its controls', async ({
    merchantAccountPage: account,
  }) => {
    await account.goto();

    await expect.soft(account.heading).toHaveText(copy.account.heading);
    await expect.soft(account.headingHighlight).toBeVisible();
    await expect.soft(account.submitButton).toHaveText(copy.account.submit);
    await expect.soft(account.backToStartLink).toHaveText(copy.account.backToStart);
    await expect
      .soft(account.backToStartLink)
      .toHaveAttribute('href', TEST_CONFIG.routes.chooseAccountType);
    await expect.soft(account.signInLink).toHaveText(copy.entry.signInLink);
    await expect.soft(account.signInLink).toHaveAttribute('href', TEST_CONFIG.routes.login);
    await expect.soft(account.languageButton).toHaveText(copy.entry.language);
  });
});
