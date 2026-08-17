import { expect } from '@playwright/test';
import { STATEMENT_ENDPOINTS } from './StatementsPage.js';

/**
 * Page object for the statement EDIT drawer.
 *
 * Opened from a list row: a row-body click opens the statement-DETAILS drawer
 * (`?drawer=statement-details`), then the header EDIT tab swaps in the edit
 * form (transient — no URL change). The STATUS control is a das-form `select`
 * whose trigger carries `id="STATUS"`; its menu renders in the shared
 * `[data-filter-portal]`. Submit posts the singular `approve` endpoint.
 */
export class StatementEditDrawer {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.panel = page.getByTestId('transaction-drawer');
    this.editTab = this.panel.getByRole('button', { name: /^edit$/i });
    this.statusTrigger = this.panel.locator('#STATUS');
    this.submitButton = this.panel.getByRole('button', { name: /^submit$/i });
  }

  /** @returns {import('@playwright/test').Locator} */
  get #portal() {
    return this.page.locator('[data-filter-portal="true"]');
  }

  /**
   * Open the statement-DETAILS drawer from a row body click. `row` is one
   * `statements-row` locator; the first cell is the id-link (navigates), so
   * click a later cell to open the drawer instead.
   *
   * @param {import('@playwright/test').Locator} row
   */
  async openDetailsFromRow(row) {
    await row.scrollIntoViewIfNeeded();
    // Skip the checkbox (0) and the Statement-ID link (1) — click a body cell.
    await row.locator('td:not([colspan])').nth(2).click();
    await this.page.waitForURL(/[?&]drawer=statement-details/, { timeout: 15_000 });
    await expect(this.editTab).toBeVisible();
  }

  /**
   * Whether this statement can be edited at all — the EDIT tab is `disabled`
   * for CARRYFORWARD / APPROVED / regeneration-required rows (or without
   * permission). Check this before `enterEdit()`; clicking a disabled control
   * just hangs on Playwright's enabled-actionability wait.
   *
   * @returns {Promise<boolean>}
   */
  async editEnabled() {
    return this.editTab.isEnabled();
  }

  /** Switch to the EDIT form. Only call when `editEnabled()` is true. */
  async enterEdit() {
    await this.editTab.click();
    await expect(this.submitButton).toBeVisible();
  }

  /** Close the drawer (used to move on to the next row without a full reload). */
  async close() {
    // DrawerManager closes on Escape (a `window` keydown listener). Prefer the
    // keyboard: a click on the Close button can be swallowed by an injected
    // dev overlay (e.g. the agentation "Block page interactions" layer), but a
    // keydown isn't. The container unmounts on close (DrawerManager returns
    // null), so assert the panel is gone.
    await this.page.keyboard.press('Escape');
    await expect(this.panel).toBeHidden();
  }

  /** Whether STATUS is editable for this row (disabled for APPROVED / CARRYFORWARD).
   *
   * @returns {Promise<boolean>}
   */
  async isStatusEditable() {
    return this.statusTrigger.isEnabled();
  }

  /** The STATUS trigger's currently displayed label.
   *
   * @returns {Promise<string>}
   */
  async currentStatus() {
    return (await this.statusTrigger.innerText()).trim();
  }

  /** Pick a STATUS option by its label (e.g. /approved/i, /carry forward/i).
   *
   * @param {RegExp} optionLabel
   */
  async setStatus(optionLabel) {
    await this.statusTrigger.click();
    await this.#portal.getByRole('button', { name: optionLabel }).first().click();
  }

  /** Submit the edit and assert the edit POST resolves 2xx. */
  async submit() {
    const [resp] = await Promise.all([
      this.page.waitForResponse(
        (r) => STATEMENT_ENDPOINTS.edit.test(r.url()) && r.request().method() === 'POST'
      ),
      this.submitButton.click(),
    ]);
    expect(resp.ok(), `statement edit returned HTTP ${resp.status()}`).toBeTruthy();
    return resp;
  }
}
