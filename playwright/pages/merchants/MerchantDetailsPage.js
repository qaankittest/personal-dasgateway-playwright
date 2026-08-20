import { expect } from '@playwright/test';

/**
 * @typedef {'merchant-information'
 *   | 'product-information'
 *   | 'user-management'
 *   | 'merchant-settings'
 *   | 'merchant-catalogue'} MerchantTabId
 */

/** @type {Record<MerchantTabId, RegExp>} */
export const TAB_LABELS = {
  'merchant-information': /^merchant\s*information$/i,
  'product-information': /^product\s*information$/i,
  'user-management': /^user\s*management$/i,
  'merchant-settings': /^merchant\s*settings$/i,
  'merchant-catalogue': /^merchant\s*catalogue$/i,
};

/** @typedef {'ip-whitelist' | 'webhook-url-configuration'} MerchantSettingId */

/** @type {Record<MerchantSettingId, RegExp>} */
export const SETTING_LABELS = {
  'ip-whitelist': /^ip\s*whitelisting$/i,
  'webhook-url-configuration': /^webhook\s*url\s*configuration$/i,
};

/** @typedef {'categories' | 'products'} MerchantCatalogueId */

/** @type {Record<MerchantCatalogueId, RegExp>} */
export const CATALOGUE_LABELS = {
  categories: /^categories$/i,
  products: /^products$/i,
};

/** @typedef {'all' | 'business-details' | 'contact-details'} InfoFilterPill */

/** @type {Record<InfoFilterPill, RegExp>} */
export const INFO_PILL_LABELS = {
  all: /^all$/i,
  'business-details': /^business\s*details$/i,
  'contact-details': /^contact\s*details$/i,
};

/**
 * POM for `/accounts/merchants/merchant-details/:id`.
 *
 * Surfaces every primary surface on the page:
 *   - the back button + breadcrumb header,
 *   - the LIVE API KEYS popover trigger,
 *   - the five tabs (two of which are dropdowns: settings + catalogue),
 *   - the merchant-information filter pills (All / Business / Contact),
 *   - the in-tab section headings used to assert the active surface rendered.
 *
 * Tab state is encoded as URL query params (`?tab=&setting=&catalogue=`),
 * so each interaction below also asserts the resulting URL.
 */
export class MerchantDetailsPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.heading = page.locator('h1').first();
    this.backButton = page.getByRole('button', { name: /^back$/i }).first();
    this.breadcrumbMerchants = page.getByRole('link', { name: /^merchants$/i }).first();
    this.liveApiKeysButton = page.getByRole('button', { name: /^live\s*api\s*keys$/i }).first();
  }

  /**
   * @param {string} [merchantId]
   * @returns {Promise<void>}
   */
  async waitForReady(merchantId) {
    await expect(this.page).toHaveURL(/\/accounts\/merchants\/merchant-details\/[^/]+/);
    if (merchantId) {
      await expect(this.page).toHaveURL(new RegExp(`/merchant-details/${merchantId}(?:[/?]|$)`));
    }
    // Initial spinner from `useMerchantDetails` — let it resolve before
    // any tab interactions, otherwise tab clicks race with the loader.
    const spinner = this.page.locator('svg.animate-spin').first();
    await expect(spinner).toHaveCount(0, { timeout: 30_000 });
    await expect(this.heading).toBeVisible();
  }

  // ---- tabs -----------------------------------------------------------

  /**
   * @param {MerchantTabId} id
   * @returns {import('@playwright/test').Locator}
   */
  #tabButton(id) {
    return this.page.getByRole('button', { name: TAB_LABELS[id] }).first();
  }

  /**
   * @param {MerchantTabId} id
   * @returns {Promise<void>}
   */
  async switchTab(id) {
    const btn = this.#tabButton(id);
    await expect(btn).toBeVisible();
    await btn.click();
    if (id === 'merchant-information') {
      await expect(this.page).not.toHaveURL(/[?&]tab=/);
    } else {
      await expect(this.page).toHaveURL(new RegExp(`[?&]tab=${id}(?:&|$)`));
    }
  }

  /**
   * Open one of the dropdown tabs (settings / catalogue) AND pick a
   * sub-item from its menu. Both URL keys are asserted.
   *
   * @param {MerchantSettingId} setting
   * @returns {Promise<void>}
   */
  async openSettings(setting) {
    await this.#tabButton('merchant-settings').click();
    const item = this.page.getByRole('menuitem', { name: SETTING_LABELS[setting] }).first();
    await expect(item).toBeVisible({ timeout: 5_000 });
    await item.click();
    await expect(this.page).toHaveURL(/[?&]tab=merchant-settings(?:&|$)/);
    await expect(this.page).toHaveURL(new RegExp(`[?&]setting=${setting}(?:&|$)`));
  }

  /**
   * @param {MerchantCatalogueId} item
   * @returns {Promise<void>}
   */
  async openCatalogue(item) {
    await this.#tabButton('merchant-catalogue').click();
    const menuItem = this.page.getByRole('menuitem', { name: CATALOGUE_LABELS[item] }).first();
    await expect(menuItem).toBeVisible({ timeout: 5_000 });
    await menuItem.click();
    await expect(this.page).toHaveURL(/[?&]tab=merchant-catalogue(?:&|$)/);
    await expect(this.page).toHaveURL(new RegExp(`[?&]catalogue=${item}(?:&|$)`));
  }

  // ---- merchant-information surface ----------------------------------

  // Verification surfaces are exposed as locators, never as `assert*` methods:
  // the page object knows *how* to find them, the spec states *what* must be
  // true. Returning a locator also keeps Playwright's auto-retry alive at the
  // assertion, which a method returning a boolean would throw away.

  /** The pill buttons that switch the merchant-information layout.
   *
   * @param {InfoFilterPill} pill
   * @returns {import('@playwright/test').Locator}
   */
  infoPill(pill) {
    return this.page.getByRole('button', { name: INFO_PILL_LABELS[pill] });
  }

  /** @returns {import('@playwright/test').Locator} */
  get businessDetailsHeading() {
    return this.page.getByRole('heading', { name: /business\s*details/i }).first();
  }

  /** @returns {import('@playwright/test').Locator} */
  get contactDetailsHeading() {
    return this.page.getByRole('heading', { name: /contact\s*details/i }).first();
  }

  /** Present while a tab's content panel is still loading. */
  get loadingSpinner() {
    return this.page.locator('svg.animate-spin').first();
  }

  /** User Management's signature CTA — only mounts on that tab. */
  get addNewUserButton() {
    return this.page.getByRole('button', { name: /add\s*new\s*user/i });
  }

  /** @returns {import('@playwright/test').Locator} */
  get ipWhitelistHeading() {
    return this.page.getByRole('heading', { name: /ip\s*whitelisting\s*configuration/i }).first();
  }

  /** @returns {import('@playwright/test').Locator} */
  get addIpAddressButton() {
    return this.page.getByRole('button', { name: /add\s*ip\s*address/i });
  }

  /** @returns {import('@playwright/test').Locator} */
  get webhookConfigHeading() {
    return this.page.getByRole('heading', { name: /webhook\s*url\s*configuration/i }).first();
  }

  /** @param {MerchantCatalogueId} item
   *  @returns {import('@playwright/test').Locator} */
  catalogueHeading(item) {
    const name = item === 'categories' ? /categories/i : /products/i;
    return this.page.getByRole('heading', { name }).first();
  }

  /**
   * @param {InfoFilterPill} pill
   * @returns {Promise<void>}
   */
  async selectInfoPill(pill) {
    await this.infoPill(pill).first().click();
  }

  // ---- product / user / settings / catalogue surfaces ----------------

  // ---- navigation -----------------------------------------------------

  /** @returns {Promise<void>} */
  async openLiveApiKeys() {
    await this.liveApiKeysButton.click();
    // Popover renders a heading "Live API Keys" — assert it became visible.
    await expect(
      this.page.getByRole('heading', { name: /live\s*api\s*keys/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  }

  /** @returns {Promise<void>} */
  async backToList() {
    await this.backButton.click();
    await this.page.waitForURL(/\/accounts\/merchants(?:[/?#]|$)/, { timeout: 15_000 });
  }
}
