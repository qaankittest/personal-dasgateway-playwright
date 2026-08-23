/**
 * Shapes for `merchant-account.json` — the fixture behind the merchant
 * registration suite (Merchant_Account_Creation_Functional_Test_Cases.pdf,
 * TC_MA_001 – TC_MA_034).
 *
 * The file carries three kinds of data, deliberately kept apart:
 *   - `account` / `countries` — the inputs a happy path submits,
 *   - `invalid` / `passwords` / `otp` — the negative data sets,
 *   - `copy` / `messages` — the app's **verbatim** on-screen strings, so a
 *     copy change fails in one obvious place instead of across a dozen specs.
 *
 * `messages.documented` holds the wording the test-case document specifies but
 * the dev build does not yet render, and `invalid.names` the name-field data the
 * app does not police. Nothing asserts either today — the cases that did were
 * removed on 2026-08-24 (each spec header lists which, and why). Both are kept
 * here so the expected values are to hand when those cases are written back.
 *
 * No runtime code — JSDoc typedefs only, so editors still complete the fixture
 * in plain JavaScript.
 */

/** @typedef {object} MerchantAccount
 *  @property {string} firstName
 *  @property {string} lastName
 *  @property {string} country     Visible label in the Country select, e.g. `Japan`.
 *  @property {string} phoneCode   Visible label in the Country Code select, e.g. `+81`.
 *  @property {string} phone
 *  @property {string} email       May contain `{{unique}}`; `buildMerchantAccount` substitutes it.
 */

/** @typedef {object} CountryOption
 *  @property {string} name
 *  @property {string} phoneCode  The dialling code the document expects the country to populate.
 */

/** @typedef {object} InvalidPhones
 *  @property {string} alphabetic
 *  @property {string} symbols
 *  @property {string} tooShort
 *  @property {string} tooLong
 */

/** @typedef {object} InvalidNames
 *  @property {string} numeric
 *  @property {string} symbols
 *  @property {string} tooLong
 *  @property {string} padded
 */

/** @typedef {object} InvalidData
 *  @property {string[]} emails
 *  @property {InvalidPhones} phones
 *  @property {InvalidNames} names
 */

/** @typedef {object} MerchantRegistrationFixture
 *  @property {MerchantAccount} account
 *  @property {CountryOption[]} countries
 *  @property {{short: string, weakComplexity: string, mismatchConfirm: string}} passwords
 *  @property {{wrong: string, partial: string[]}} otp
 *  @property {InvalidData} invalid
 *  @property {Record<string, any>} copy
 *  @property {Record<string, any>} messages
 */

/** Shapes for `hong-kong.json` — the same wizard driven with Hong Kong data.
 *
 *  `invalid.unenforcedLengths` holds the two numbers the Hong Kong test-case
 *  document expects to be rejected for length (4 and 12 digits against an
 *  8-digit rule). The dev build accepts both, and the document's own Open Point
 *  #2 leaves the rule unconfirmed, so nothing asserts them — they are kept here
 *  so the case can be written the moment the rule is settled.
 *
 * @typedef {object} HongKongRegistrationFixture
 * @property {MerchantAccount} account
 * @property {{country: string, phoneCode: string, phoneDigits: number}} market
 * @property {{phones: {alphabetic: string, symbols: string}, unenforcedLengths: {tooShort: string, tooLong: string}, emails: string[]}} invalid
 * @property {{businessLocationField: string, hongKongDocument: string, japanOnlyField: string}} onboarding
 */

export {};
