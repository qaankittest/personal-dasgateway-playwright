// TEMP discovery spec (phase 2): for every filterable column, derive a live
// value from the table, apply its quick filter, and record the URL param +
// resulting rows + whether the value round-trips. Delete after use.
import { test, expect } from '../../fixtures/base.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { log } from '../../utils/logger.js';

const HAS_CREDS = !!TEST_CONFIG.credentials.username && !!TEST_CONFIG.credentials.password;

test('discover column filters', { tag: ['@temp'] }, async ({ page, loginPage, transactionsPage: transactions }) => {
  test.skip(!HAS_CREDS, 'TEST_USERNAME / TEST_PASSWORD env vars not set');
  test.slow();
  test.setTimeout(300_000);

  await loginPage.goto();
  await loginPage.login(TEST_CONFIG.credentials.username, TEST_CONFIG.credentials.password);
  await transactions.goto();

  // label -> {tdIndex, lineIndex} built from the header (th index === td index).
  const colMap = await page.evaluate(() => {
    const map = {};
    const ths = Array.from(document.querySelectorAll('table thead th'));
    ths.forEach((th, tdIndex) => {
      Array.from(th.querySelectorAll('button[data-column-search-trigger]')).forEach((b, lineIndex) => {
        const label = (b.getAttribute('aria-label') || '').replace(/^Filter\s+/, '');
        map[label] = { tdIndex, lineIndex };
      });
    });
    return map;
  });
  const labels = Object.keys(colMap);

  // Read a column's value from a specific rendered row (title attr preferred).
  async function readValue(rowIdx, tdIndex, lineIndex) {
    return page
      .locator('table tbody tr')
      .nth(rowIdx)
      .evaluate(
        (row, { tdIndex, lineIndex }) => {
          const td = row.querySelectorAll('td')[tdIndex];
          if (!td) return '';
          const titled = td.querySelectorAll('span[title]');
          if (titled[lineIndex]?.getAttribute('title')) return titled[lineIndex].getAttribute('title');
          const lineDivs = td.querySelectorAll(':scope > div > div');
          if (lineDivs[lineIndex]) return (lineDivs[lineIndex].textContent || '').trim();
          return (td.textContent || '').trim();
        },
        { tdIndex, lineIndex }
      );
  }

  const results = [];
  for (const label of labels) {
    const { tdIndex, lineIndex } = colMap[label];
    try {
      await page.goto(TEST_CONFIG.routes.transactions, { waitUntil: 'domcontentloaded' });
      await transactions.rows.first().waitFor({ state: 'visible', timeout: 20_000 });
      const rowN = Math.min(await transactions.rows.count(), 6);

      // Find the first row with a usable (non-empty, non-N/A) value.
      let value = '';
      for (let r = 0; r < rowN; r++) {
        const v = (await readValue(r, tdIndex, lineIndex)).trim();
        if (v && !/^n\/?a$/i.test(v) && v !== '—' && v !== '-') {
          value = v;
          break;
        }
      }
      if (!value) {
        results.push({ label, tdIndex, lineIndex, skipped: 'no non-NA value in first rows' });
        continue;
      }

      const trigger = page
        .locator(`button[data-column-search-trigger][aria-label="Filter ${label}"]`)
        .first();
      await trigger.click();
      const dialog = page.locator('[role="dialog"][aria-label="Search transactions"]');
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
      const input = dialog.locator('input[type="text"]').first();
      const placeholder = await input.getAttribute('placeholder');
      await input.fill(value);
      const urlBefore = page.url();
      await input.press('Enter');
      // Applying a filter pushes its param onto the URL — wait for that push
      // rather than sleeping. Discovering *which* columns do this is the whole
      // point of the probe, so a column that pushes nothing simply falls
      // through after the timeout and is recorded with its unchanged params.
      await page.waitForURL((u) => u.toString() !== urlBefore, { timeout: 10_000 }).catch(() => {});
      await expect(transactions.rows.first().or(transactions.emptyState)).toBeVisible();

      const url = new URL(page.url());
      const params = Object.fromEntries(url.searchParams.entries());
      const rowCount = await transactions.rows.count();
      const firstVal = rowCount > 0 ? (await readValue(0, tdIndex, lineIndex)).trim() : '';
      results.push({ label, tdIndex, lineIndex, placeholder, value, params, rowCount, firstVal });
    } catch (e) {
      results.push({ label, tdIndex, lineIndex, error: String(e).slice(0, 140) });
    }
  }
  log.info('discovered column filters', results);
});
