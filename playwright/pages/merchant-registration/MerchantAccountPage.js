import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { selectDasFormOption } from '../../utils/dasForm.js';

/** `POST` issued by CLICK TO VERIFY EMAIL ID. Exported so a spec can assert the
 *  call itself, not just the screen that follows it. */
export const VERIFY_EMAIL_ENDPOINT = '/onboarding/verify-email';

/**
 * Step 1 of merchant registration — the "Create Your Merchant Account" form at
 * `/onboarding/sign-up`.
 *
 * Observed against the live dev app (2026-08-23):
 *   - **the route is guarded**: a cold `page.goto('/onboarding/sign-up')`
 *     redirects to `/choose-account-type`, because the chosen account type
 *     lives in client state. `goto()` therefore always enters through the
 *     merchant card — there is no direct URL into this form;
 *   - every field is a DasForm control keyed by `id={field.name}`:
 *     `#firstName`, `#lastName`, `#phoneNumber` (`type=tel`), `#email`
 *     (`type=email`), plus two Select triggers rendered as **buttons**,
 *     `#businessLocation` (Country) and `#phoneCode` (Country Code), whose
 *     options open in the body-level `[data-filter-portal="true"]` menu;
 *   - the Country menu offers exactly two options on dev — Hong Kong and Japan
 *     — and carries a "Search…" box. The Country Code menu lists 203 dialling
 *     codes and is editable independently of the country;
 *   - the form is `noValidate` and no input carries `required`, `maxlength` or
 *     `pattern`: every rule the screen applies is the app's own;
 *   - CLICK TO VERIFY EMAIL ID is **never `disabled`**, and a submit that fails
 *     validation is silent — no message renders and the URL does not change.
 *     Errors appear only as `<p class="text-xs text-red-400">` beneath a field,
 *     and only once a blank submit has already been attempted (see the specs
 *     parked with `test.fixme` in `merchant-account-form.spec.js`).
 *
 * Locators and actions only — every assertion lives in the spec.
 */
export class MerchantAccountPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---- static content -------------------------------------------------
    this.heading = page.getByText('Create Your Merchant Account', { exact: true });
    this.headingHighlight = page.getByText('Merchant Account', { exact: true });

    // ---- form -----------------------------------------------------------
    this.form = page.locator('form');
    this.firstNameInput = page.locator('#firstName');
    this.lastNameInput = page.locator('#lastName');
    this.countrySelect = page.locator('#businessLocation');
    this.phoneCodeSelect = page.locator('#phoneCode');
    this.phoneInput = page.locator('#phoneNumber');
    this.emailInput = page.locator('#email');
    this.submitButton = page.getByRole('button', { name: /click to verify email id/i });

    // The open Select menu. A closing menu's portal lingers during its
    // animation, so the freshly opened one is always `.last()` (SKILL §8).
    this.optionMenu = page.locator('[data-filter-portal="true"]').last();
    this.optionSearchInput = this.optionMenu.getByPlaceholder(/search/i);

    // ---- validation ------------------------------------------------------
    // The app hangs no `role`, `id` or `aria-describedby` on its error copy —
    // the colour class is the only hook. Scoped to the form so the wizard's
    // other cards can never satisfy it.
    this.validationMessages = this.form.locator('p[class*="text-red"]');

    // ---- chrome ---------------------------------------------------------
    this.backToStartLink = page.getByRole('link', { name: 'Back to Start' });
    this.signInLink = page.getByRole('link', { name: 'Sign in here' });
    this.languageButton = page.getByRole('button', { name: 'English (UK)' });
  }

  // ---- dynamic locators -------------------------------------------------

  /**
   * The error message rendered under one field, located by the field's wrapper
   * so a message never bleeds across fields.
   * @param {string} text
   * @returns {import('@playwright/test').Locator}
   */
  message(text) {
    return this.validationMessages.filter({ hasText: text }).first();
  }

  /** One option inside the open Select menu.
   * @param {string|RegExp} name
   * @returns {import('@playwright/test').Locator} */
  option(name) {
    return this.optionMenu.getByRole('button', { name }).first();
  }

  // ---- navigation -------------------------------------------------------

  /** Open the form the only way the app allows — through the entry card. */
  async goto() {
    await this.page.goto(TEST_CONFIG.routes.chooseAccountType, { waitUntil: 'domcontentloaded' });
    await this.page.getByRole('button', { name: 'Register as a Merchant' }).click();
    await this.waitForReady();
  }

  /** Readiness gate — a wait, not a verification. */
  async waitForReady() {
    await this.firstNameInput.waitFor({ state: 'visible' });
  }

  // ---- actions ----------------------------------------------------------

  /** @param {string} label Visible country label, e.g. `Japan`. */
  async selectCountry(label) {
    await selectDasFormOption(this.page, 'businessLocation', label);
  }

  /** @param {string} label Visible dialling code, e.g. `+81`. */
  async selectPhoneCode(label) {
    await selectDasFormOption(this.page, 'phoneCode', label);
  }

  /** Open the Country menu without picking anything — for specs that inspect
   *  the option list itself. */
  async openCountryMenu() {
    await this.countrySelect.click();
    await this.optionMenu.waitFor({ state: 'visible' });
  }

  async openPhoneCodeMenu() {
    await this.phoneCodeSelect.click();
    await this.optionMenu.waitFor({ state: 'visible' });
  }

  /** Close an open Select menu. It has no Escape handler, so the trigger is
   *  re-clicked instead (SKILL §8). */
  async closeMenu() {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Fill the form. Takes an object, never positional arguments, and fills only
   * the keys it is given so a spec can leave exactly one field blank.
   *
   * @param {Partial<import('../../fixtures/merchant-registration/types.js').MerchantAccount>} account
   */
  async fillAccount(account) {
    if (account.firstName !== undefined) await this.firstNameInput.fill(account.firstName);
    if (account.lastName !== undefined) await this.lastNameInput.fill(account.lastName);
    if (account.country !== undefined) await this.selectCountry(account.country);
    if (account.phoneCode !== undefined) await this.selectPhoneCode(account.phoneCode);
    if (account.phone !== undefined) await this.phoneInput.fill(account.phone);
    if (account.email !== undefined) await this.emailInput.fill(account.email);
  }

  /** Submit without waiting for anything — for the negative cases, where the
   *  app issues no request at all. */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Submit and capture the `verify-email` call, so the spec can assert the
   * backend accepted the details rather than inferring it from the next screen.
   * A wait on a mutation, which §7 allows a POM to own.
   *
   * @returns {Promise<import('@playwright/test').Response>}
   */
  async submitAndWaitForVerifyEmail() {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes(VERIFY_EMAIL_ENDPOINT) && r.request().method() === 'POST',
      ),
      this.submitButton.click(),
    ]);
    return response;
  }

  async backToStart() {
    await this.backToStartLink.click();
    await this.page.waitForURL(new RegExp(`${TEST_CONFIG.routes.chooseAccountType}$`));
  }
}
