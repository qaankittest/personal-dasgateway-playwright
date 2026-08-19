import { expect } from '@playwright/test';

/**
 * POM for the merchant drawer (DrawerManager → MerchantDetailsDrawer),
 * portaled to <body> via DasDrawer when the URL contains
 * `?drawer=merchant&id=<merchantId>`.
 *
 * The drawer renders:
 *   - a header label "MERCHANT" with the legal name
 *   - a "Live API Keys" toggle
 *   - three collapsible sections: Business Details, Contact Details,
 *     Product Information (with a count badge + external-link icon to the
 *     full merchant details page).
 */
export class MerchantDrawerPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.root = page.getByTestId('merchant-drawer').or(page.locator('[role="dialog"]')).first();
    this.closeButton = this.root.getByRole('button', { name: /close/i }).first();
    this.liveApiKeysToggle = this.root.getByRole('button', { name: /live\s*api\s*keys/i }).first();
    this.openInPageButton = this.root
      .getByRole('button', { name: /open in page|open\s*details/i })
      .first();
    this.businessSection = this.root.getByRole('heading', { name: /business\s*details/i }).first();
    this.contactSection = this.root.getByRole('heading', { name: /contact\s*details/i }).first();
    this.productSection = this.root
      .getByRole('heading', { name: /product\s*information/i })
      .first();
  }

  /** @returns {Promise<void>} */
  async waitForReady() {
    await expect(this.root).toBeVisible({ timeout: 15_000 });
    const spinner = this.root.locator('svg.animate-spin').first();
    await expect(spinner).toHaveCount(0, { timeout: 30_000 });
    await expect(this.page).toHaveURL(/[?&]drawer=/);
  }

  // `businessSection` / `contactSection` / `productSection` are public
  // locators — the spec asserts them one by one so a failure names the missing
  // section instead of a generic "drawer empty".

  /** @returns {Promise<void>} */
  async toggleApiKeys() {
    if ((await this.liveApiKeysToggle.count()) === 0) return;
    await this.liveApiKeysToggle.click();
  }

  /** @returns {Promise<void>} */
  async close() {
    if ((await this.closeButton.count()) > 0 && (await this.closeButton.isVisible())) {
      await this.closeButton.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await expect(this.root).toBeHidden({ timeout: 10_000 });
    await expect(this.page).not.toHaveURL(/[?&]drawer=/, { timeout: 10_000 });
  }
}
