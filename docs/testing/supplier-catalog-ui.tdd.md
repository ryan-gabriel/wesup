# Supplier catalog UI TDD evidence

## Scope

Supplier create/edit mutations now show an accessible confirmation modal after a successful API response. Supplier catalog cards use the configured Next image optimizer and fall back to the product placeholder when an image cannot be loaded.

## Regression coverage

- `tests/components/CatalogSuccessDialog.test.tsx` verifies draft, publish, and edit copy, the primary action, Escape/backdrop dismissal, initial focus, and mutation-action mapping.
- `tests/components/CreateCatalogForm.test.tsx` drives the review flow for create draft, create publish, edit update, and repository failure; it confirms only successful mutations open the modal.
- `tests/components/SupplierCatalogUi.test.tsx` verifies catalog cards render the optimized image and replace it with a product placeholder after an image error.
- API failures remain handled by the form alert; the success dialog is only opened after the repository mutation resolves successfully.

## Verification commands

Targeted component tests:
`npx vitest run tests/components/CatalogSuccessDialog.test.tsx tests/components/CreateCatalogForm.test.tsx tests/components/SupplierCatalogUi.test.tsx`

Full verification:
`npx tsc --noEmit`
`npm run lint`
`npm run build`
`npm test`
