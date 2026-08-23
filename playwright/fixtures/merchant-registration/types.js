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
 * the dev build does not yet render; the specs that assert it are parked with
 * `test.fixme` and cite the observed string instead.
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

export {};
