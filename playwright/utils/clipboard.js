// Clipboard helpers for copy / paste cases.
//
// This is test infrastructure, not app behaviour, so it lives here rather than
// on a page object: seeding the OS clipboard is something the harness does to
// set a case up, not something a user does to a screen.

/**
 * Put a value on the browser's clipboard.
 *
 * Chromium gates `navigator.clipboard` behind a permission the test context
 * does not grant by default, so the grant is part of the helper — a caller that
 * forgets it gets a silent no-op instead of a failure.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} value
 */
export async function writeToClipboard(page, value) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate((text) => navigator.clipboard.writeText(text), value);
}
