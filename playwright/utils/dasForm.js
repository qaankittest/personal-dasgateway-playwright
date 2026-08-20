import { expect } from '@playwright/test';

/**
 * Shared helpers for driving `components/das-form` controls in e2e specs.
 *
 * DasForm renders every field with `id={field.name}`:
 *   - InputField / TextareaField → a real `<input>` / `<textarea>` (`#name`),
 *   - SelectField  → a `<button id="name">` trigger; options render as
 *     `<button>`s inside a `data-filter-portal="true"` body-level portal,
 *   - DateField    → a react-datepicker `<input id="name">`; the calendar
 *     opens in the body-level `#das-datepicker-portal`.
 *
 * Targeting by id keeps locators stable across i18n label changes — the same
 * convention the PBL create drawer POM relies on (`#productName`, `#currency`).
 */

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Open the DasForm Select with `id={fieldId}` and click the option whose
 *  visible label matches `optionLabel` exactly (case-insensitive). The freshly
 *  opened menu is the last `data-filter-portal` in the DOM.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} fieldId
 * @param {string} optionLabel
 */
export async function selectDasFormOption(page, fieldId, optionLabel) {
  await page.locator(`#${fieldId}`).click();
  const portal = page.locator('[data-filter-portal="true"]').last();
  const option = portal
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(optionLabel)}$`, 'i') })
    .first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
}

/**
 * Pick a date in the DasForm DateField with `id={fieldId}`.
 *
 * react-datepicker blocks manual keyboard entry (`onChangeRaw` prevent-default
 * in `DasDatePicker`), so the only way to set a value is via the calendar:
 * focus the input to open the body-level portal calendar, advance
 * `yearsOffset * 12` months, then click today's day-of-month on the target
 * month (every month has a 1..28, so today's DOM is always present and never a
 * greyed-out adjacent-month cell).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} fieldId
 * @param {number} yearsOffset
 */
export async function pickDasFormDate(page, fieldId, yearsOffset) {
  await page.locator(`#${fieldId}`).click();

  const calendar = page.locator('#das-datepicker-portal .react-datepicker').first();
  await expect(calendar).toBeVisible({ timeout: 5_000 });

  const nextMonth = calendar.locator('button[aria-label*="Next Month"]').first();
  for (let i = 0; i < yearsOffset * 12; i += 1) {
    await nextMonth.click();
  }

  // Clamp to 28: on the 29th-31st the target month may not have that day
  // (every month has 1..28), which would otherwise leave the click hanging.
  const dayOfMonth = Math.min(new Date().getDate(), 28);
  const dayCell = calendar
    .locator('.react-datepicker__day:not(.react-datepicker__day--outside-month)')
    .filter({ hasText: new RegExp(`^${dayOfMonth}$`) })
    .first();
  await dayCell.click();
}
