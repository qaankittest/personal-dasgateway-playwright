# Page Object Skill

A page object wraps **locators and user actions** for one page or component. It is the only place selectors are allowed to live.

## Rules

1. **One class per page or major component.** Big pages get component classes (`MerchantGrid`, `DocumentUploadPanel`), not a 900-line god object.
2. **Static locators in the constructor**, dynamic ones as methods returning a `Locator`.
3. **No `expect()` inside a page object.** Assertions belong in the spec, so a failure reads at business level.
4. **No `waitForTimeout`, no `try-catch`, no environment branching.**
5. **Methods are named for user intent** — `approveApplication()`, not `clickBtn3()`.
6. **Return locators, don't return strings.** `get statusCell()` returning a `Locator` lets the spec auto-retry; returning `await ...textContent()` kills retry.
7. **A method that navigates elsewhere returns the next page object.**
8. **No test data inside page objects.** Data comes from the spec or a factory.
9. **Page objects don't call other page objects' internals** — they compose via returned instances.
10. **Keep them thin.** If a page object hides *what* the test verifies, it has gone too far.
11. **Export as an ESM named export**: `export class MerchantPage { … }` — no default exports; `fixtures/base.js` imports it by name.
12. **`goto()` uses a relative path** — `baseURL` is set in config.

## Structure

`pages/MerchantPage.js`

```js
import { MerchantDetailsPage } from './MerchantDetailsPage.js';

export class MerchantPage {
  constructor(page) {
    this.page = page;

    // static locators
    this.searchInput   = page.getByPlaceholder('Search merchant');
    this.addButton     = page.getByRole('button', { name: 'Add Merchant' });
    this.successToast  = page.getByText('Merchant created successfully');
    this.grid          = page.getByTestId('merchant-grid');
  }

  // dynamic locators
  row(name) {
    return this.grid.getByRole('row', { name });
  }

  statusFor(name) {
    return this.row(name).getByTestId('status-cell');
  }

  // actions
  async goto() {
    await this.page.goto('/merchants');
  }

  async search(name) {
    await this.searchInput.fill(name);
    await this.searchInput.press('Enter');
  }

  async approve(name) {
    await this.row(name).getByRole('button', { name: 'Approve' }).click();
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

  async openDetails(name) {
    await this.row(name).getByRole('link', { name }).click();
    return new MerchantDetailsPage(this.page);   // navigation returns next POM
  }
}
```

Spec:

```js
test('approves a pending merchant', async ({ merchantPage, merchant }) => {
  await merchantPage.goto();
  await merchantPage.search(merchant.name);
  await merchantPage.approve(merchant.name);

  await expect(merchantPage.successToast).toBeVisible();
  await expect(merchantPage.statusFor(merchant.name)).toHaveText('Active');
});
```

Note the split: the page object knows **how**, the spec states **what must be true**.

## Component objects

For a widget reused across pages, scope it to a root locator:

```js
export class DocumentUploadPanel {
  constructor(page, root = page.getByTestId('document-upload')) {
    this.page = page;
    this.root = root;
    this.dropZone = root.getByText('Drag files here');
  }

  fileRow(fileName) {
    return this.root.getByRole('row', { name: fileName });
  }

  async upload(docType, filePath) {
    await this.root.getByLabel(docType).setInputFiles(filePath);
  }
}
```

Compose it from the page object:

```js
constructor(page) {
  this.page = page;
  this.documents = new DocumentUploadPanel(page);
}
```

## Base page (optional)

Only if there is genuinely shared behaviour — a nav bar, a common toast, a logout:

```js
class BasePage {
  constructor(page) {
    this.page = page;
    this.toast = page.getByRole('alert');
    this.userMenu = page.getByTestId('user-menu');
  }

  async logout() {
    await this.userMenu.click();
    await this.page.getByRole('menuitem', { name: 'Log out' }).click();
  }
}
```

Don't create a base class just to inherit `page` — that is inheritance for its own sake.

## Multi-step forms

Give each step its own method and return `this` for chaining, or return the next step object:

```js
async fillBusinessDetails({ name, uen, country }) {
  await this.page.getByLabel('Business Name').fill(name);
  await this.page.getByLabel('UEN').fill(uen);
  await this.page.getByLabel('Country').selectOption(country);
  await this.page.getByRole('button', { name: 'Next' }).click();
  return this;
}
```

Accept an **object** of field values, not five positional arguments — positional args silently break when the form changes.

## Anti-patterns

| Wrong | Right |
|---|---|
| `expect()` inside the page object | Expose the locator; assert in the spec |
| `async getStatus() { return await cell.textContent(); }` | `get statusCell() { return cell; }` |
| `await this.page.waitForTimeout(2000)` | Rely on auto-wait / assert in the spec |
| `if (await modal.isVisible()) await modal.close()` | Make the flow deterministic |
| Selectors written inline in the spec | Move to the page object |
| `login(user, pass, remember, role, market)` | `login({ user, pass, market })` |
| One `AppPage` class with 60 methods | Split by page/component |
| Hardcoded `https://uat.portal...` in `goto()` | Relative path + `baseURL` |
| Page object constructing its own test data | Data factory supplies it |
