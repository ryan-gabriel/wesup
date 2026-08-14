# Leaflet Demo TDD Evidence

## Scope

No separate implementation plan was used. The journey was derived from the request to expose a temporary interactive Leaflet map at `/demo/leaflet`.

## User journey

As a Wesup developer, I want an isolated Leaflet demo page so I can verify interactive pickup-point selection before integrating maps into Supplier and UMKM flows.

## RED

Command:

```text
npm test -- tests/unit/leaflet-demo.test.ts
```

Result: failed as expected because `@/lib/maps/leaflet-demo` did not exist. This established the missing coordinate contract before production code was added.

## GREEN

Command:

```text
npm test -- tests/unit/leaflet-demo.test.ts
```

Result: 1 test file passed, 4 tests passed.

The passing tests guarantee:

| Guarantee | Evidence |
| --- | --- |
| The initial coordinate is central Bandung | `uses central Bandung as the initial map position` |
| Coordinates have stable five-decimal formatting | `formats coordinates consistently for the demo panel` |
| Valid geographic boundaries are accepted | `accepts geographic coordinate boundaries` |
| Non-finite and out-of-range values are rejected | `rejects non-finite and out-of-range coordinates` |

## Verification

- `npx tsc --noEmit`: passed.
- Targeted ESLint for the route, components, helper, and test: passed.
- `npm test`: 9 test files passed, 1 live-test file skipped; 431 tests passed.
- `npm run build`: passed with Next.js 16.2.10/Turbopack; `/demo/leaflet` generated as a static route.
- Feature-scoped V8 coverage: 100% statements, branches, functions, and lines for `lib/maps/leaflet-demo.ts`.

## Known gaps

- Browser interaction is not covered by an automated E2E test because Playwright is not currently part of the project test stack.
- Map tiles depend on the public OpenStreetMap tile service and an active network connection.
- Device geolocation depends on browser permission and a secure context outside localhost.
