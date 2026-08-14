# Supplier Registration & Location Consent TDD Evidence

## Scope

Implementation of the Supplier registration API route (`/api/auth/register/supplier` & `/api/suppliers/register`), input validation (essential data, 16-digit NIK, photo URLs), Bandung geographic boundary checks, and absolute timestamp recording for location consent.

## User journey

As a prospective Wesup Supplier, I want to register my account with business profile data, pin map coordinates in Bandung, and explicit location consent, so that my account can enter the Admin verification queue.

## RED

Commands:

```text
npx vitest run tests/unit/maps-bandung.test.ts tests/unit/api-supplier-registration.test.ts
```

Result: Failed before implementation because `lib/maps/bandung.ts` and `app/api/auth/register/supplier/route.ts` did not exist.

## GREEN

Commands:

```text
npx vitest run tests/unit/maps-bandung.test.ts tests/unit/api-supplier-registration.test.ts
```

Result: 2 test files passed, 14 tests passed.

The passing tests guarantee:

| Guarantee | Evidence |
| --- | --- |
| Bandung geographic bounding box correctly covers Greater Bandung | `defines consistent bounding box covering Greater Bandung` |
| Bandung coordinates & landmarks are accepted | `validates various landmarks in Bandung` |
| Coordinates outside Bandung region (e.g. Jakarta, Surabaya) are rejected | `rejects coordinates outside Bandung region` |
| Non-numeric, null, undefined, or empty coordinates are rejected with 400 | `rejects when coordinates are empty / null / non-numeric` |
| Missing / false location consent is rejected with 400 | `rejects when location_consent is false or missing` |
| Invalid NIK (< or > 16 digits) is rejected with 400 | `rejects when NIK is invalid (not 16 digits)` |
| Missing essential business data (name, address, ktp url) is rejected with 400 | `rejects when essential fields are missing` |
| Duplicate email is handled with 409 Conflict | `handles duplicate email (user_already_exists) with 409` |
| Duplicate NIK is handled with 409 Conflict | `handles duplicate NIK with 409` |
| Successful registration records absolute timestamp for location consent | `successfully registers a supplier with valid data, Bandung coordinates, and consent` |

## Verification

- `npx tsc --noEmit`: passed (0 errors).
- `npm run lint`: passed (0 errors, 0 warnings).
- `npm test`: all test suites passed.
- `npm run build`: passed.
