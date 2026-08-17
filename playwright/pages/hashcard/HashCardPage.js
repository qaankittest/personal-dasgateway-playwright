import { expect } from '@playwright/test';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { log } from '../../utils/logger.js';

/** Backend list endpoint the grid + the count tiles both read from. */
export const HASHCARD_LIST_ENDPOINT = '/api/v1/hashcard/list';

/**
 * The two filterable fields the Advanced-Filters popover exposes, mapped to
 * the header text of the column each one narrows.
 *
 * Verified live on dev: the Field dropdown offers exactly these two.
 */
export const HASHCARD_FILTER_FIELDS = {
  hashCardNumber: /hash card number/i,
  status: /^status$/i,
};

/** Status option label → the `status` query param the app sends. */
export const HASHCARD_STATUS_PARAM = {
  Active: '1',
  Inactive: '0',
};

/** @typedef {'Active' | 'Inactive'} HashCardStatus */

/** Column headers, for resolving a `<td>` index without hardcoding positions. */
export const HASHCARD_COL = {
  hashCardNumber: /hash card number/i,
  status: /^status$/i,
  createdDate: /created date/i,
  createdBy: /created by/i,
  updatedBy: /updated by/i,
  comments: /comments/i,
};

/**
 * Page object for the Hash Card → "Hash Cards Whitelist" list.
 *
 * The grid is the shared `DataTable` (testId `hashcard-table` / `hashcard-row`).
 * Filtering goes through the Advanced-Filters popover, which renders inline
 * (rule rows are `div.grid-cols-[1fr_1fr_40px]`) while each Select's option menu
 * portals to a body-level `[data-filter-portal="true"]` — the same shape as the
 * Statements filters.
 *
 * Two behaviours discovered against the live dev app that the specs rely on:
 *  - Filter state is **not** mirrored into the URL, so reset is a reload.
 *  - `Apply` is `disabled` until *every* draft rule has both a field and a
 *    value, which is the app's only client-side validation on this surface.
 */
export class HashCardPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.tableContainer = page
      .getByTestId('hashcard-table')
      .or(page.locator('table').first().locator('xpath=ancestor::div[contains(@class,"overflow")][1]'))
      .first();
    this.rows = page.getByTestId('hashcard-row');
    this.skeletonRows = page
      .getByTestId('skeleton-row')
      .or(page.locator('[class*="animate-pulse"]'));
    this.headerCells = this.tableContainer.locator('thead th');
    this.emptyState = page.getByText(/no records found|no\s*data|empty/i).first();
    this.endOfData = page.getByText(/no more data/i);

    this.filterTrigger = page.getByRole('button', { name: /filters?$/i }).first();
    this.applyButton = page.getByRole('button', { name: /^apply$/i });
    this.resetButton = page.getByRole('button', { name: /^reset$/i });
    this.addFilterButton = page.getByRole('button', { name: /^add new filter$/i });
    this.closeFilterButton = page.getByRole('button', { name: /^close$/i });
  }

  async goto() {
    await this.page.goto(TEST_CONFIG.routes.hashCard);
    await this.waitForInitialLoad();
  }

  async waitForInitialLoad() {
    await expect(async () => {
      const rowCount = await this.rows.count();
      if (rowCount > 0) return;
      await expect(this.emptyState.or(this.endOfData)).toBeVisible();
    }).toPass({ timeout: 30_000 });
    await expect(this.skeletonRows).toHaveCount(0, { timeout: 30_000 });
  }

  /** @returns {Promise<number>} */
  async rowCount() {
    return this.rows.count();
  }

  // ── Column reading ───────────────────────────────────────────────────────

  /**
   * @param {RegExp} headerPattern
   * @returns {Promise<number>}
   */
  async columnIndex(headerPattern) {
    const count = await this.headerCells.count();
    for (let i = 0; i < count; i++) {
      const text = (await this.headerCells.nth(i).innerText()).trim();
      if (headerPattern.test(text)) return i;
    }
    throw new Error(`Column header matching ${headerPattern} not found`);
  }

  /** The primary (first) line of one body cell at [rowIndex][colIndex].
   *
   * @param {number} rowIndex
   * @param {number} colIndex
   * @returns {Promise<string>}
   */
  async cellText(rowIndex, colIndex) {
    const cell = this.rows.nth(rowIndex).locator('td').nth(colIndex);
    return (await cell.innerText()).split('\n')[0]?.trim() ?? '';
  }

  /**
   * @param {RegExp} headerPattern
   * @returns {Promise<string[]>}
   */
  async columnValues(headerPattern) {
    const colIndex = await this.columnIndex(headerPattern);
    const total = await this.rows.count();
    /** @type {string[]} */
    const out = [];
    for (let i = 0; i < total; i++) out.push(await this.cellText(i, colIndex));
    return out;
  }

  /** The "Hash Cards / Active / Inactive" stats pill in the page header.
   *
   * @returns {import('@playwright/test').Locator}
   */
  get #summaryPill() {
    return this.page.locator('[class*="stats-pill"]').first();
  }

  /**
   * One count tile from the header pill.
   *
   * `Active`/`Inactive` come from two `take=1` probe calls that carry the
   * *currently applied* filter — so these are counts within the active filter
   * context, not of the whole table. Call it on an unfiltered page to get the
   * data-set totals. Returns null while a tile still shows its em-dash
   * placeholder (probe in flight).
   *
   * @param {'Hash Cards' | 'Active' | 'Inactive'} label
   * @returns {Promise<number | null>}
   */
  async summaryCount(label) {
    const tile = this.#summaryPill
      .locator('div')
      .filter({ hasText: new RegExp(`^${label}\\s*[\\d—-]*$`) })
      .first();
    const raw = (await tile.innerText()).replace(label, '').trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  // ── Filters ──────────────────────────────────────────────────────────────

  /** Body-level portal that Select option menus render into.
   *
   * @returns {import('@playwright/test').Locator}
   */
  get #filterPortal() {
    // A closing menu's portal can linger through its exit animation, so the
    // freshly opened one is always the last.
    return this.page.locator('[data-filter-portal="true"]').last();
  }

  async openFilter() {
    await this.filterTrigger.click();
    await expect(this.applyButton).toBeVisible();
  }

  async closeFilter() {
    await this.closeFilterButton.click();
    await expect(this.applyButton).toBeHidden();
  }

  /** Number of applied rules, read off the badge on the FILTERS trigger.
   *
   * @returns {Promise<number>}
   */
  async appliedFilterCount() {
    const text = (await this.filterTrigger.innerText()).replace(/\s+/g, ' ').trim();
    const match = /^(\d+)\s/.exec(text);
    return match ? Number(match[1]) : 0;
  }

  /** Draft rule rows currently in the popover.
   *
   * @returns {import('@playwright/test').Locator}
   */
  get ruleRows() {
    return this.page
      .locator('button[aria-label="Remove filter"]')
      .locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  }

  /**
   * @param {number} [index]
   * @returns {import('@playwright/test').Locator}
   */
  #ruleRow(index = 0) {
    return this.page
      .locator('button[aria-label="Remove filter"]')
      .nth(index)
      .locator('xpath=ancestor::div[contains(@class,"grid")][1]');
  }

  /** Append an empty rule row. The app pre-selects the next unused field. */
  async addRule() {
    await this.addFilterButton.click();
  }

  /** @param {number} [index] */
  async removeRule(index = 0) {
    await this.page.locator('button[aria-label="Remove filter"]').nth(index).click();
  }

  /**
   * @param {RegExp} fieldLabel
   * @param {number} [index]
   */
  async setRuleField(fieldLabel, index = 0) {
    const row = this.#ruleRow(index);
    await row.locator(':scope > div').first().getByRole('button').click();
    await this.#filterPortal.getByRole('button', { name: fieldLabel }).first().click();
  }

  /**
   * @param {number} [index]
   * @returns {import('@playwright/test').Locator}
   */
  #valueCell(index = 0) {
    return this.#ruleRow(index).locator(':scope > div').nth(1);
  }

  /** Hash Card Number is a plain text input.
   *
   * @param {string} value
   * @param {number} [index]
   */
  async setRuleText(value, index = 0) {
    await this.#valueCell(index).locator('input').fill(value);
  }

  /** Status is a searchable Select whose options are `<button>`s in the portal.
   *
   * @param {RegExp} optionLabel
   * @param {number} [index]
   */
  async setRuleSelect(optionLabel, index = 0) {
    await this.#valueCell(index).getByRole('button').click();
    await this.#filterPortal.getByRole('button', { name: optionLabel }).first().click();
  }

  /** Convenience: a single-rule filter on Hash Card Number.
   *
   * @param {string} value
   */
  async filterByHashCardNumber(value) {
    await this.openFilter();
    await this.setRuleField(HASHCARD_FILTER_FIELDS.hashCardNumber);
    await this.setRuleText(value);
    await this.applyFilter();
  }

  /** Convenience: a single-rule filter on Status.
   *
   * @param {HashCardStatus} status
   */
  async filterByStatus(status) {
    await this.openFilter();
    await this.setRuleField(HASHCARD_FILTER_FIELDS.status);
    await this.setRuleSelect(new RegExp(`^${status}$`, 'i'));
    await this.applyFilter();
  }

  /** @returns {Promise<boolean>} */
  async isApplyEnabled() {
    return this.applyButton.isEnabled();
  }

  /**
   * Apply the draft rules and assert the list re-fetch resolves 2xx. Returns
   * the query params the app sent, so a spec can check input → request →
   * output rather than just input → output.
   *
   * @returns {Promise<URLSearchParams>}
   */
  async applyFilter() {
    const [resp] = await Promise.all([
      this.page.waitForResponse(
        (r) =>
          r.url().includes(HASHCARD_LIST_ENDPOINT) &&
          r.request().method() === 'GET' &&
          // The `take=1` calls are the Active/Inactive count probes; the grid
          // fetch is the paged one.
          !/[?&]take=1(&|$)/.test(r.url()),
        { timeout: 30_000 }
      ),
      this.applyButton.click(),
    ]);
    expect(resp.ok(), `hashcard/list returned HTTP ${resp.status()}`).toBeTruthy();

    const params = new URL(resp.url()).searchParams;
    log.info('hashcard list re-fetched', { query: params.toString() });

    await expect(this.skeletonRows).toHaveCount(0, { timeout: 30_000 });
    await this.waitForInitialLoad();
    return params;
  }

  /** Click the popover's Reset. Clears applied rules without a navigation. */
  async resetFilter() {
    await this.resetButton.click();
    await expect(this.skeletonRows).toHaveCount(0, { timeout: 30_000 });
    await this.waitForInitialLoad();
  }

  /**
   * Reset by reloading. Filter state lives only in the client store (nothing is
   * mirrored into the URL) while auth is persisted, so a fresh navigation is
   * the cheapest way to guarantee a clean slate between cases.
   */
  async resetFiltersViaReload() {
    await this.goto();
  }
}
