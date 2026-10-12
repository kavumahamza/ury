# Waiter readability evidence

Actual native Vue `Table.vue` and `Menu.vue` components rendered locally with their native Tailwind/Flowbite CSS and identical safe synthetic store records. Source base: `1e690ffaef45a46b4306e2e9f674fdb71bb6e693`; implementation: `b774118e8fe27753a4e6d6eb1a7abec17f1f6c49`. Later evidence-only commits preserve that exact implementation. References [SiteOps #3286](https://github.com/Maximus-Tech-Enterprise-Apps/maximus-siteops/issues/3286).

The user authorized an isolated Chrome renderer after the normal browser capture tool timed out. Capture used a fresh temporary profile and no live session or ERP access. A labelled evidence wrapper holds the real components inside an iframe at the specified document viewport without scaling. The PNG's outer raster dimensions differ from the document viewport; both are recorded in [manifest.json](manifest.json).

| Screen | Before | After | Actual document viewport |
|---|---|---|---|
| Tables | [before](waiter-tables-before-1366.png) | [after](waiter-tables-after-1366.png) | 1366 × 768 |
| Menu | [before](waiter-menu-before-1366.png) | [after](waiter-menu-after-1366.png) | 1366 × 768 |
| Menu tablet | Not captured | [after](waiter-menu-after-1024.png) | 1024 × 768 |

Visual inspection of these five images shows larger table identities and supported ages, preserved Free/Occupied/Attention/Active text and colours, and full long dish names with aligned UGX amounts and native action controls at the captured widths. Neutral images are explicitly synthetic; initials use the native missing-image path for each revision. No menu photographs are assigned by this change.

This evidence proves local component rendering only. Ordinary-waiter/site rehearsal, live order creation/send/billing, auth/session/branch isolation, painted keyboard-focus inspection and the remaining agreed viewport checks stay open. The PR remains draft; these images are not deployment or complete waiter acceptance.
