# Assertion Skill

How a senior automation engineer writes verifications in Playwright + JavaScript.

## Rules

1. **Always `await expect(...)`.** A missing `await` makes the assertion silently pass — this is the single most common cause of a "passing" broken test.
2. **Web-first only.** `expect(locator)` auto-retries until the condition is met or the timeout expires. `expect(await locator.isVisible())` evaluates once and is flaky by construction.
3. **Assert what the user sees**, or what the API returns — not internal DOM structure or class names.
4. **Pick the specific matcher.** `toBeVisible()` beats `toHaveCount(1)`; `toHaveValue()` beats `toHaveAttribute('value')`.
5. **Every test ends in at least one assertion.** A test that only performs actions verifies nothing.
6. **Never assert inside a page object** — the spec must show what is being verified.
7. **Assert state, not steps.** After an approval, assert the row says `Active`; don't assert that a spinner appeared.
8. **No conditional assertions.** `if (x) expect(a); else expect(b);` means the test doesn't know what correct is.
9. **One logical outcome per test**, but multiple assertions to prove that outcome are fine.
10. **Add a message when a bare failure would be cryptic.**

## Matcher reference

| Check | Matcher |
|---|---|
| Element shown / hidden | `toBeVisible()` / `toBeHidden()` |
| Enabled / disabled | `toBeEnabled()` / `toBeDisabled()` |
| Checkbox, radio | `toBeChecked()` |
| Exact text | `toHaveText('Active')` |
| Partial text | `toContainText('Active')` |
| Input value | `toHaveValue('ACME Pte Ltd')` |
| Dropdown selection | `toHaveValue()` / `toHaveText()` on the selected option |
| List size | `toHaveCount(10)` |
| Attribute / class | `toHaveAttribute('href', /merchant/)`, `toHaveClass(/active/)` |
| Page URL | `await expect(page).toHaveURL(/\/merchant\/\d+/)` |
| Page title | `await expect(page).toHaveTitle('Merchants')` |
| API response | `await expect(response).toBeOK()` |
| Non-locator value | `expect(total).toBe(1080)` (no retry — use only for computed values) |

`toHaveText` is **exact** (whitespace-normalized); `toContainText` is partial. Choose deliberately — using `toContainText` everywhere hides real defects.

## Patterns

### Standard

```js
await expect(page.getByText('Saved successfully')).toBeVisible();
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
await expect(page.getByTestId('merchant-grid')).toContainText(merchant.name);
await expect(page.getByRole('row')).toHaveCount(10);
```

### Custom message

```js
await expect(
  totalCell,
  'Settlement total must include 8% JP consumption tax'
).toHaveText('1,080.00');
```

### Soft assertions — collect several failures in one run

```js
await expect.soft(page.getByTestId('gross')).toHaveText('1,000.00');
await expect.soft(page.getByTestId('tax')).toHaveText('80.00');
await expect.soft(page.getByTestId('net')).toHaveText('1,080.00');
// test still fails at the end, but you see all three mismatches
```

Use soft assertions for field-by-field verification of a form or statement. Use hard assertions for anything the rest of the test depends on.

### List / table contents

```js
await expect(page.getByRole('row').filter({ hasText: 'ILK' })).toHaveCount(1);
await expect(page.getByTestId('status-cell')).toHaveText(['Active', 'Pending', 'Rejected']);
```

`toHaveText` with an array asserts the whole list in order — better than looping.

### Polling a non-locator value

```js
await expect.poll(async () => {
  const res = await request.get(`/api/applications/${id}`);
  return (await res.json()).status;
}, { timeout: 30_000 }).toBe('APPROVED');
```

Use this for backend state (settlement job, async status change) instead of a hard wait.

### API assertion

```js
const res = await request.post('/api/merchants', { data: payload });
await expect(res).toBeOK();
expect(res.status()).toBe(201);
expect((await res.json()).uen).toBe(payload.uen);
```

### Negative assertions

```js
await expect(page.getByRole('button', { name: 'Delete' })).toBeHidden();
await expect(page.getByText('Error')).not.toBeVisible();
```

`not.toBeVisible()` passes as soon as the element is absent — fine. But be careful: it also passes if the page hasn't loaded yet. Anchor it by first asserting something that proves the page rendered.

## Anti-patterns

| Wrong | Right |
|---|---|
| `expect(await el.isVisible()).toBe(true)` | `await expect(el).toBeVisible()` |
| `expect(el).toBeVisible()` (no `await`) | `await expect(el).toBeVisible()` |
| `const t = await el.textContent(); expect(t).toBe('X')` | `await expect(el).toHaveText('X')` |
| `if (await el.count() > 0) expect(...)` | Assert the expected count directly |
| `expect(true).toBe(true)` placeholder | Delete it or write a real check |
| Screenshot comparison to verify text/logic | `toHaveText()`; reserve `toHaveScreenshot()` for deliberate visual regression |
| Assertion inside the page object | Return the locator; assert in the spec |
