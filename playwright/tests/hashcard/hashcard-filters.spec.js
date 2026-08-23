// E2E: Hash Card → "Hash Cards Whitelist" Advanced Filters.
//
// Logs in, lands on the Hash Card tab, opens FILTERS and applies every filter
// the popover exposes — one by one — asserting the table output matches the
// input in both directions.
//
// The surface has exactly two filterable fields (verified against dev):
//   - Hash Card Number → text,   query param `hashCardNumber`, EXACT match
//   - Status           → select, query param `status` (Active=1, Inactive=0)
//
// Positive cases seed themselves from live row 0, so they stay non-empty
// without a fixed seed. Negative cases cover: a value that matches nothing, a
// partial/prefix value (proving the field is exact-match, not "contains"), an
// incomplete rule (Apply stays disabled), and two rules that contradict each
// other (AND semantics → empty result).
//
// Read-only: nothing here mutates backend state.
import { test, expect } from '../../fixtures/base.js';
import {
  HASHCARD_COL,
  HASHCARD_FILTER_FIELDS,
  HASHCARD_STATUS_PARAM,
} from '../../pages/hashcard/HashCardPage.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';
import { log } from '../../utils/logger.js';

/** @typedef {import('../../pages/hashcard/HashCardPage.js').HashCardStatus} HashCardStatus */

const HAS_CREDS = !!TEST_CONFIG.credentials.username && !!TEST_CONFIG.credentials.password;

/** Displayed status pill → the Status filter option that should select it.
 *
 * @type {Record<string, HashCardStatus>}
 */
const PILL_TO_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

/** A 32-char hex string that is not a real whitelisted card. */
const NON_EXISTENT_CARD = 'deadbeef00000000000000000cafef00d';

test.describe('Hash Card — Advanced Filters', { tag: ['@regression'] }, () => {
  test.skip(!HAS_CREDS, 'TEST_USERNAME / TEST_PASSWORD env vars not set');

  test('every filter narrows the table to matching rows (positive + negative)', async ({ page, loginPage, hashCardPage: hashCard }) => {
    test.slow();

    await test.step('login and navigate to the Hash Card tab', async () => {
      await loginPage.goto();
      await loginPage.login(TEST_CONFIG.credentials.username, TEST_CONFIG.credentials.password);
      await hashCard.goto();
      await expect(page).toHaveURL(new RegExp(`${TEST_CONFIG.routes.hashCard}$`));
      await expect(hashCard.tableContainer).toBeVisible();
    });

    const baselineRowCount = await hashCard.rowCount();
    if (baselineRowCount === 0) {
      await expect(hashCard.emptyState.or(hashCard.endOfData)).toBeVisible();
      test.info().annotations.push({
        type: 'note',
        description: 'Hash card whitelist is empty — filters not exercised',
      });
      return;
    }
    log.info('hash card baseline', { rows: baselineRowCount });

    // Seed every case from a real row so they can't go vacuously empty.
    const seedCard = await hashCard.cellText(0, await hashCard.columnIndex(HASHCARD_COL.hashCardNumber));
    const seedPill = (
      await hashCard.cellText(0, await hashCard.columnIndex(HASHCARD_COL.status))
    ).toUpperCase();
    const seedStatus = PILL_TO_STATUS[seedPill];
    expect(seedCard.length, 'row 0 has no Hash Card Number to seed from').toBeGreaterThan(0);
    expect(seedStatus, `row 0 status "${seedPill}" has no known filter option`).toBeTruthy();
    log.info('seeded from row 0', { seedCard, seedStatus });

    // ── FILTER 1: Hash Card Number ───────────────────────────────────────────

    await test.step('POSITIVE — Hash Card Number returns exactly the matching card', async () => {
      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.hashCardNumber);
      await hashCard.setRuleText(seedCard);
      const params = await hashCard.applyFilter();

      // input → request
      expect(params.get('hashCardNumber'), 'hashCardNumber not sent').toBe(seedCard);
      // request → output
      const numbers = await hashCard.columnValues(HASHCARD_COL.hashCardNumber);
      expect(numbers.length, 'no rows for a card number read off the live table').toBeGreaterThan(0);
      for (const n of numbers) expect(n).toBe(seedCard);
      await expect.poll(() => hashCard.appliedFilterCount()).toBe(1);
    });

    await hashCard.resetFiltersViaReload();

    await test.step('NEGATIVE — a non-existent Hash Card Number shows the empty state', async () => {
      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.hashCardNumber);
      await hashCard.setRuleText(NON_EXISTENT_CARD);
      const params = await hashCard.applyFilter();

      expect(params.get('hashCardNumber')).toBe(NON_EXISTENT_CARD);
      await expect
        .poll(() => hashCard.rowCount(), { message: 'a bogus card number returned rows' })
        .toBe(0);
      await expect(hashCard.emptyState).toBeVisible();
    });

    await hashCard.resetFiltersViaReload();

    await test.step('NEGATIVE — a partial Hash Card Number matches nothing (exact match, not contains)', async () => {
      const prefix = seedCard.slice(0, Math.max(1, Math.floor(seedCard.length / 2)));
      expect(prefix.length, 'seed card too short to derive a prefix').toBeGreaterThan(0);
      expect(prefix).not.toBe(seedCard);

      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.hashCardNumber);
      await hashCard.setRuleText(prefix);
      const params = await hashCard.applyFilter();

      expect(params.get('hashCardNumber')).toBe(prefix);
      // The backend matches the whole value; a prefix of a real card must not
      // resolve to that card. If this ever fails the field became a LIKE match
      // and the positive case above needs a `toContain` assertion instead.
      expect(
        await hashCard.rowCount(),
        `prefix "${prefix}" matched rows — Hash Card Number is no longer an exact match`
      ).toBe(0);
      await expect(hashCard.emptyState).toBeVisible();
    });

    await hashCard.resetFiltersViaReload();

    // ── FILTER 2: Status ─────────────────────────────────────────────────────

    await test.step(`POSITIVE — Status = ${seedStatus} returns only ${seedPill} rows`, async () => {
      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.status);
      await hashCard.setRuleSelect(new RegExp(`^${seedStatus}$`, 'i'));
      const params = await hashCard.applyFilter();

      expect(params.get('status'), 'status param mismatch').toBe(HASHCARD_STATUS_PARAM[seedStatus]);
      const statuses = await hashCard.columnValues(HASHCARD_COL.status);
      expect(statuses.length, `no rows for Status = ${seedStatus}`).toBeGreaterThan(0);
      for (const s of statuses) expect(s.toUpperCase()).toBe(seedPill);
      await expect.poll(() => hashCard.appliedFilterCount()).toBe(1);
    });

    await hashCard.resetFiltersViaReload();

    await test.step('POSITIVE/NEGATIVE — the other Status agrees with its header count', async () => {
      /** @type {HashCardStatus} */
      const other = seedStatus === 'Active' ? 'Inactive' : 'Active';
      const expectedTotal = await hashCard.summaryCount(other);

      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.status);
      await hashCard.setRuleSelect(new RegExp(`^${other}$`, 'i'));
      const params = await hashCard.applyFilter();

      expect(params.get('status')).toBe(HASHCARD_STATUS_PARAM[other]);
      const rows = await hashCard.rowCount();
      log.info('opposite status filter', { other, rows, expectedTotal });

      // The header count is the authority when it resolves. When it does not,
      // fall back to what the grid returned rather than demanding rows: this
      // data set can legitimately hold none of the opposite status, and an
      // unresolved tile used to send that case down the "must be non-empty"
      // path and fail a filter that was working correctly.
      const total = expectedTotal ?? rows;

      if (total === 0) {
        // Negative path: the data set has none of this status, so the filter
        // must produce the empty state rather than falling back to all rows.
        expect(rows, `Status = ${other} returned rows although the header count is 0`).toBe(0);
        await expect(hashCard.emptyState).toBeVisible();
        test.info().annotations.push({
          type: 'note',
          description: `no ${other} hash cards in this data set — the negative path was exercised, not the positive one`,
        });
      } else {
        expect(rows, `Status = ${other} returned no rows`).toBeGreaterThan(0);
        const statuses = await hashCard.columnValues(HASHCARD_COL.status);
        for (const s of statuses) expect(s.toUpperCase()).toBe(other.toUpperCase());
      }
    });

    await hashCard.resetFiltersViaReload();

    // ── Combined rules ───────────────────────────────────────────────────────

    await test.step('POSITIVE — Hash Card Number AND Status together still return the row', async () => {
      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.hashCardNumber);
      await hashCard.setRuleText(seedCard);
      await hashCard.addRule();
      // The second row auto-selects the only remaining field (Status); pin it
      // explicitly so the test doesn't depend on that convenience.
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.status, 1);
      await hashCard.setRuleSelect(new RegExp(`^${seedStatus}$`, 'i'), 1);
      const params = await hashCard.applyFilter();

      expect(params.get('hashCardNumber')).toBe(seedCard);
      expect(params.get('status')).toBe(HASHCARD_STATUS_PARAM[seedStatus]);
      await expect.poll(() => hashCard.appliedFilterCount()).toBe(2);

      const numbers = await hashCard.columnValues(HASHCARD_COL.hashCardNumber);
      const statuses = await hashCard.columnValues(HASHCARD_COL.status);
      expect(numbers.length, 'consistent card + status combination returned no rows').toBeGreaterThan(0);
      for (const n of numbers) expect(n).toBe(seedCard);
      for (const s of statuses) expect(s.toUpperCase()).toBe(seedPill);
    });

    await hashCard.resetFiltersViaReload();

    await test.step('NEGATIVE — contradictory rules AND to an empty result', async () => {
      /** @type {HashCardStatus} */
      const other = seedStatus === 'Active' ? 'Inactive' : 'Active';

      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.hashCardNumber);
      await hashCard.setRuleText(seedCard);
      await hashCard.addRule();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.status, 1);
      await hashCard.setRuleSelect(new RegExp(`^${other}$`, 'i'), 1);
      const params = await hashCard.applyFilter();

      expect(params.get('hashCardNumber')).toBe(seedCard);
      expect(params.get('status')).toBe(HASHCARD_STATUS_PARAM[other]);
      // The rules are ANDed: the seeded card is `seedStatus`, so pairing it with
      // the opposite status can never match. An OR would leak rows back in.
      expect(
        await hashCard.rowCount(),
        'contradictory rules returned rows — filters are not ANDed'
      ).toBe(0);
      await expect(hashCard.emptyState).toBeVisible();
    });

    await hashCard.resetFiltersViaReload();

    // ── Validation + reset ───────────────────────────────────────────────────

    await test.step('NEGATIVE — Apply stays disabled while a rule is incomplete', async () => {
      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.hashCardNumber);
      await hashCard.setRuleText(seedCard);
      await expect(hashCard.applyButton, 'Apply disabled for a complete rule').toBeEnabled();

      // A second rule arrives with a field but no value → Apply must lock.
      await hashCard.addRule();
      await expect(hashCard.ruleRows).toHaveCount(2);
      await expect(
        hashCard.applyButton,
        'Apply was enabled with an empty Value on rule 2'
      ).toBeDisabled();

      // Removing the incomplete rule re-enables it.
      await hashCard.removeRule(1);
      await expect(hashCard.ruleRows).toHaveCount(1);
      await expect(hashCard.applyButton).toBeEnabled();

      // Clearing the remaining value locks Apply again.
      await hashCard.setRuleText('');
      await expect(hashCard.applyButton, 'Apply was enabled with an empty Value').toBeDisabled();
      await hashCard.closeFilter();
    });

    await hashCard.resetFiltersViaReload();

    await test.step('Reset restores the unfiltered table', async () => {
      await hashCard.openFilter();
      await hashCard.setRuleField(HASHCARD_FILTER_FIELDS.hashCardNumber);
      await hashCard.setRuleText(seedCard);
      await hashCard.applyFilter();
      await expect.poll(() => hashCard.rowCount()).toBeGreaterThan(0);
      await expect.poll(() => hashCard.appliedFilterCount()).toBe(1);

      await hashCard.openFilter();
      await hashCard.resetFilter();

      await expect
        .poll(() => hashCard.appliedFilterCount(), { message: 'filter badge survived Reset' })
        .toBe(0);
      await expect
        .poll(() => hashCard.rowCount(), { message: 'Reset did not restore the full table' })
        .toBe(baselineRowCount);
    });
  });
});
