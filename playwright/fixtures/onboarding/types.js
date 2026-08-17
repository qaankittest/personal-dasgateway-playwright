/**
 * JSON-driven onboarding fixtures — shape definitions.
 *
 * One config per flow (`become-a-merchant.json`, `become-a-partner.json`) is
 * loaded by a spec and passed straight into the matching `MerchantRegistrationPage`
 * tab helper. Every field is optional: anything the JSON omits is left empty
 * in the form (the page tabs save partial progress, so unfilled fields don't
 * block Next). File uploads are out of scope for now — they're driven by the
 * legacy hard-coded path and skipped entirely when a config is supplied.
 *
 * String values for selects are matched **case-insensitively as a regex
 * fragment** against the option's visible label (e.g. `"company limited"` →
 * matches the "Company Limited" trigger label). Use the EN label text from
 * `src/language/en/common.ts`.
 *
 * `{{unique}}` anywhere inside a string is substituted with a per-run base-36
 * timestamp so duplicate-rejection from the dev backend (`ERR_AB_0022`) doesn't
 * trip on re-runs. Use it on identifying fields — `companyName`,
 * `registrationNumber`, `identificationId`.
 *
 * This module carries no runtime code — the shapes below are JSDoc typedefs so
 * editors still complete/check the fixture objects in plain JavaScript.
 */

/** Calendar date input — accepts either the literal `"today"` (clicks the
 *  today cell) or an integer years offset from today's month. The wizard's
 *  calendar inputs block keyboard typing, so the helper drives them via the
 *  same a11y shortcuts react-datepicker binds.
 *
 * @typedef {'today' | { yearsOffset: number }} DateConfig
 */

/** Separate mailing address block. Omit or set `null` → the page object ticks
 *  "Same as above" and the mailing fields drop out of the step %. Provide an
 *  object → the helper fills the listed fields literally (leaves the box
 *  unticked, fills what's present).
 *
 * @typedef {object} MailingAddressConfig
 * @property {string} [mailCountry]
 * @property {string} [mailAddress]
 * @property {string} [mailPostcode]
 * @property {string} [mailCity]
 */

/** Business Details — merchant (GUEST) variant.
 *
 * @typedef {object} MerchantBusinessConfig
 * @property {string} [companyType]
 * @property {string} [companyName]
 * @property {string} [registrationNumber]
 * @property {DateConfig} [incorporationDate]
 * @property {string} [registeredAddress]
 * @property {string} [city]
 * @property {string} [postcode]
 * @property {string} [doingBusinessAs]
 * @property {string} [corporateWebsite]
 * @property {MailingAddressConfig | null} [mailingAddress]
 */

/** Business Details — partner (GUESTTHIRDPARTY) variant. Adds partner-only
 *  selects (thirdPartyType / operationalCountry / natureOfBusiness) and the
 *  full Individual identity block. `companyType` decides the layout: when it
 *  matches /individual/i the page object drives the identity block; otherwise
 *  the company-particulars block.
 *
 * @typedef {object} PartnerBusinessConfig
 * @property {string} [companyType]
 * @property {string} [thirdPartyType]
 * @property {string} [companyName] Company-particulars (SOLE / PARTNER / PUBLIC / PRIVATE / STOCK / OTHER).
 * @property {string} [doingBusinessAs]
 * @property {string} [registrationNumber]
 * @property {string} [operationalCountry]
 * @property {string} [natureOfBusiness]
 * @property {DateConfig} [incorporationDate]
 * @property {DateConfig} [indDob] Individual identity block (only when companyType === "Individual").
 * @property {string} [indNationality]
 * @property {string} [indPhoneNumber]
 * @property {string} [indIdentificationType]
 * @property {DateConfig} [indIdentificationIssuedDate]
 * @property {DateConfig} [indIdentificationExpDate]
 * @property {string} [postcode] Address (shared).
 * @property {string} [city]
 * @property {string} [registeredAddress]
 * @property {MailingAddressConfig | null} [mailingAddress]
 */

/** Add/Edit Stakeholder drawer — single stakeholder per config (matches the
 *  current `StakeholderInput` shape in the POM).
 *
 * @typedef {object} StakeholderConfig
 * @property {string} [firstName]
 * @property {string} [middleName]
 * @property {string} [lastName]
 * @property {DateConfig} [dob]
 * @property {string} [phone]
 * @property {string} [email] Editable only for an added (non-primary) stakeholder. The primary
 *   stakeholder's email is the account-creation email — seeded server-side and
 *   rendered disabled; the helper asserts it rather than typing.
 * @property {string} [nationality]
 * @property {boolean} [ubo]
 * @property {string} [ownershipPercentage]
 * @property {boolean} [authorizedSignatory]
 * @property {string} [countryOfResidence]
 * @property {string} [postcode]
 * @property {string} [address]
 * @property {string} [city]
 * @property {string} [identificationType]
 * @property {string} [identificationId]
 * @property {DateConfig} [identificationIssuedDate]
 * @property {DateConfig} [identificationExpDate]
 */

/** Payout Details — `paymentFrequency` is merchant-only (partner schema hides
 *  it). A partner config can leave it `undefined` and the merchant helper
 *  silently skips it when the field isn't on the tab.
 *
 * @typedef {object} PayoutConfig
 * @property {string} [accountNumber]
 * @property {string} [accountType]
 * @property {string} [settlementCurrency]
 * @property {string} [paymentFrequency]
 * @property {string} [bankName]
 * @property {string} [bankCode]
 * @property {string} [bankCountry]
 * @property {string} [branchCode]
 * @property {string} [bankAccountName]
 */

/** Payment Methods — merchant-only step (partner wizard skips it).
 *
 * @typedef {object} PaymentMethodsConfig
 * @property {boolean} [hasHpp]
 * @property {boolean} [hasServerApi]
 * @property {boolean} [hasQR]
 * @property {boolean} [hasPBL]
 * @property {boolean} [hasRecurring]
 * @property {string} [website]
 * @property {string} [describeProduct]
 * @property {string[]} [transactionalCountries]
 * @property {string} [maximumTransactionAmount]
 * @property {string} [averageTransactionAmount]
 * @property {string} [totalAnnualProjectionAmount]
 */

/** Public sign-up step that lands the new GUEST / GUESTTHIRDPARTY on
 *  `/onboarding`. Drives `/choose-account-type` → `/onboarding/sign-up`
 *  (account → OTP → password) before the wizard tabs begin.
 *
 *  Every field is optional with a runtime fallback:
 *   - `email` omitted → `GuestSignUpPage.uniqueEmail()` (per-run, never collides).
 *     When provided, `{{unique}}` is substituted with the module-load suffix.
 *   - `otp` omitted → `TEST_CONFIG.otp` (env-driven, dev backend default `1234`).
 *   - `password` omitted → `TEST_CONFIG.credentials.password` (env). Keeping it
 *     out of JSON in CI is the **recommended** posture; the field is here for
 *     local single-run experiments.
 *   - `businessLocation` / `phoneCode` omitted → the form's defaults (JP / +81).
 *     `businessLocation` is the country **label** (e.g. `"Japan"`), matched
 *     case-insensitively against the select's visible option text.
 *
 * @typedef {object} SignUpConfig
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [businessLocation] Country in the public sign-up's business-location select.
 *   Merchant accounts are restricted to JP/HK; Partner accounts see the full list.
 * @property {string} [phoneCode] Dial code (e.g. `"+81"`). Normally auto-syncs from
 *   `businessLocation`, so most JSONs can omit it.
 * @property {string} [phone]
 * @property {string} [email]
 * @property {string} [otp]
 * @property {string} [password]
 */

/** Top-level merchant flow config (`become-a-merchant.json`).
 *
 * @typedef {object} MerchantOnboardingConfig
 * @property {SignUpConfig} [signUp]
 * @property {MerchantBusinessConfig} [businessDetails]
 * @property {StakeholderConfig} [stakeholder]
 * @property {PayoutConfig} [payout]
 * @property {PaymentMethodsConfig} [paymentMethods]
 */

/** Top-level partner flow config (`become-a-partner.json`). No paymentMethods.
 *
 * @typedef {object} PartnerOnboardingConfig
 * @property {SignUpConfig} [signUp]
 * @property {PartnerBusinessConfig} [businessDetails]
 * @property {StakeholderConfig} [stakeholder]
 * @property {PayoutConfig} [payout]
 */

export {};
