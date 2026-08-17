import { expect } from '@playwright/test';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { scrollUntilRowCount } from '../../utils/scroll.js';
import { log } from '../../utils/logger.js';

/**
 * @typedef {object} TransactionRowSnapshot
 * @property {number} index
 * @property {string | null} refId
 */

export class TransactionsPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.tableContainer = page
      .getByTestId('transactions-table')
      .or(
        page
          .locator('table')
          .first()
          .locator('xpath=ancestor::div[contains(@class, "overflow-auto")][1]')
      )
      .first();
    this.rows = page
      .getByTestId('transactions-row')
      .or(
        page
          .locator('table tbody tr:not([data-testid="skeleton-row"])')
          .filter({ hasNotText: /no more data|empty/i })
      )
      .filter({ has: page.locator('td:not([colspan])') });
    this.skeletonRows = page
      .getByTestId('skeleton-row')
      .or(page.locator('[class*="animate-pulse"]'));
    this.emptyState = page.getByText(/no\s*data|empty/i).first();
    this.endOfData = page.getByText(/no more data/i);
    /** The centered "Search transactions" dialog opened by a header quick filter. */
    this.quickSearchDialog = page
      .getByRole('dialog', { name: /search transactions/i })
      .or(page.locator('[role="dialog"][aria-label="Search transactions"]'))
      .first();
  }

  async goto() {
    await this.page.goto(TEST_CONFIG.routes.transactions);
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

  /**
   * @param {number} targetCount
   * @returns {Promise<number>}
   */
  async loadAtLeast(targetCount) {
    const url = this.page.url();
    const onListRoute = new RegExp(`${TEST_CONFIG.routes.transactions}(?:/?($|\\?))`).test(url);
    if (!onListRoute) {
      throw new Error(
        `loadAtLeast called while not on the transactions list route. Current URL: ${url}`
      );
    }
    log.info(`Loading rows via infinite scroll`, { targetCount });
    const rendered = await scrollUntilRowCount(this.page, {
      targetCount,
      rowsLocator: this.rows,
      scrollContainer: this.tableContainer,
      stepPx: TEST_CONFIG.scroll.stepPx,
      settleMs: TEST_CONFIG.scroll.settleMs,
      maxAttempts: TEST_CONFIG.scroll.maxAttempts,
      idleAttemptsBeforeStop: TEST_CONFIG.scroll.idleAttemptsBeforeStop,
    });
    await expect(this.skeletonRows).toHaveCount(0, { timeout: 15_000 });
    return rendered;
  }

  /**
   * @param {number} limit
   * @returns {Promise<TransactionRowSnapshot[]>}
   */
  async getRowSnapshots(limit) {
    const total = Math.min(await this.rows.count(), limit);
    /** @type {TransactionRowSnapshot[]} */
    const snapshots = [];
    for (let i = 0; i < total; i++) {
      const row = this.rows.nth(i);
      const refId = (await row.locator('td').first().innerText()).split('\n')[0]?.trim() || null;
      snapshots.push({ index: i, refId });
    }
    return snapshots;
  }

  /**
   * Click the transaction-ref-id link in the first cell to navigate to the
   * full details page (`/transactions/:id`). The ref-id span is the only
   * navigation trigger in the row; clicks anywhere else open the drawer.
   *
   * @param {number} index
   */
  async openRow(index) {
    const row = this.rows.nth(index);
    await row.scrollIntoViewIfNeeded();
    const firstCell = row.locator('td').first();
    const refLink = firstCell
      .getByTestId('transactions-row-ref-link')
      .or(firstCell.locator('span.cursor-pointer'))
      .or(firstCell.locator('span').first())
      .first();
    await refLink.click();
    await this.page.waitForURL(/\/transactions\/[^/]+(?:[?#]|$)/, { timeout: 15_000 });
  }

  /**
   * Click anywhere on the row body (outside the first cell's ref-id link)
   * to open the global drawer (DrawerManager). This does NOT navigate the
   * page — it adds `?drawer=details&id=...`.
   *
   * @param {number} index
   */
  async openDrawer(index) {
    const row = this.rows.nth(index);
    await row.scrollIntoViewIfNeeded();
    // Click a non-first cell — the first cell's ref-id span navigates instead.
    const bodyCell = row.locator('td:not([colspan])').nth(1);
    await bodyCell.click();
    await this.page.waitForURL(/[?&]drawer=/, { timeout: 15_000 });
  }

  async returnToList() {
    await this.page.goBack();
    await this.waitForInitialLoad();
  }

  // ── Header quick filter (per-column search) ─────────────────────────────
  //
  // Every column header carries a funnel button
  // `button[data-column-search-trigger][aria-label="Filter <Column>"]`. Clicking
  // it opens a centered "Search transactions" dialog with a single text box
  // pre-scoped to that column. Applying (Enter) pushes the value into the URL as
  // a column-specific query param (Transaction Ref ID → `?uuid=...`) and the
  // table re-fetches. Clearing the box and re-applying removes the param.

  /** The funnel button in a column header that opens its quick-search dialog.
   *
   * @param {string} columnLabel
   * @returns {import('@playwright/test').Locator}
   */
  columnFilterTrigger(columnLabel) {
    return this.page
      .locator(`button[data-column-search-trigger][aria-label="Filter ${columnLabel}"]`)
      .first();
  }

  /** The text box inside the open quick-search dialog.
   *
   * @returns {import('@playwright/test').Locator}
   */
  get quickSearchInput() {
    return this.quickSearchDialog.locator('input[type="text"]').first();
  }

  /**
   * The FULL (untruncated) Transaction Ref ID for a row. The visible cell text
   * is middle-truncated (e.g. `1c14e1....d9ae3`), so the real value is read from
   * the ref-id span's `title` attribute — this is what the quick filter expects.
   *
   * @param {number} index
   * @returns {Promise<string>}
   */
  async fullRefId(index) {
    const row = this.rows.nth(index);
    await row.scrollIntoViewIfNeeded();
    const title = await row.locator('td').nth(1).locator('span[title]').first().getAttribute('title');
    return (title ?? '').trim();
  }

  /** Open a column's quick-search dialog and assert it is scoped to that column.
   *
   * @param {string} columnLabel
   */
  async openColumnQuickFilter(columnLabel) {
    await this.columnFilterTrigger(columnLabel).click();
    await expect(this.quickSearchDialog).toBeVisible();
    await expect(this.quickSearchInput).toHaveAttribute(
      'placeholder',
      new RegExp(`Search ${columnLabel}`, 'i')
    );
  }

  /**
   * Type a value into the open quick-search box and apply it via Enter. Waits for
   * the dialog to close and the table's re-fetch skeletons to clear.
   *
   * @param {string} value
   */
  async applyQuickSearch(value) {
    await this.quickSearchInput.fill(value);
    await this.quickSearchInput.press('Enter');
    await expect(this.quickSearchDialog).toBeHidden();
    await expect(this.skeletonRows).toHaveCount(0, { timeout: 15_000 });
  }

  /** Open + apply in one step.
   *
   * @param {string} columnLabel
   * @param {string} value
   */
  async quickSearch(columnLabel, value) {
    await this.openColumnQuickFilter(columnLabel);
    await this.applyQuickSearch(value);
  }

  /** Reopen a column's quick-search and clear it (empty + Enter), restoring the table.
   *
   * @param {string} columnLabel
   */
  async clearQuickSearch(columnLabel) {
    await this.openColumnQuickFilter(columnLabel);
    await this.applyQuickSearch('');
  }
}
