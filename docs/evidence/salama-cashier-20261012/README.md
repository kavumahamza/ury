# Cashier layout evidence — 12 October 2026

These images render the actual POS AppLayout, Header, Footer, Orders, Notifications, shared UI and CSS with synthetic cashier bills and native notification inputs. An outside-repository harness mocks external API/realtime/printing boundaries and rejects live ERP requests and business writes. The displayed cashier, bill IDs, items, prices, request and alerts are synthetic. The logo is the existing URY source asset; this default-theme local rendering does not attest to the live MAX\MUS branding or Salama serving revision.

The native POS document renders without scaling inside a fixed-size iframe. Its media queries use the labelled **1366×768** or **1024×768** document viewport. The PNG includes the evidence wrapper and surrounding browser area. The wrapper's browser dimensions label is **1440×773** for the desktop frames and **1098×773** for the tablet frame; saved PNG dimensions are separately recorded below. These captures are implementation evidence, not operator approval, live role/financial acceptance or printer transport verification.

| Capture | Rendered source SHA | POS document viewport | Saved PNG | Observation |
| --- | --- | --- | --- | --- |
| [Before](cashier-before-1366.png) | `1e690ffaef45a46b4306e2e9f674fdb71bb6e693` | 1366×768 | 1440×860 | Native baseline: fixed detail panel follows the dense, fully expanded narrow alert rail; selected bill ID truncates. |
| [After](cashier-after-1366.png) | `64a92b4e7f93b22a3ef5f8bde62f7a4c940e184e` | 1366×768 | 1440×860 | Queue and selected bill precede general alerts; identity/items/total and Print/Split/Settle are visible; compact headlines offer Full notification. |
| [After, tablet](cashier-after-1024.png) | `64a92b4e7f93b22a3ef5f8bde62f7a4c940e184e` | 1024×768 | 1098×860 | Selected bill occupies the right column; alerts sit below the scrollable queue; status labels and native actions remain visible. |

All three PNGs were inspected locally. These static images show the default English populated state with disclosures collapsed. They do not establish expanded-content, keyboard, enlarged-text, empty/stale/error, other-language, dark-theme, Dashboard consumer or ordinary-role acceptance. Focused React regressions separately cover native disclosure expansion/focus persistence, safe full text, permission/read/session protection and existing settlement/split/printing contracts. The tablet queue remains scrollable; its lower rows and split siblings are not all visible in this single frame.

[capture-manifest.json](capture-manifest.json) records source revision, capture time, local harness URL, dimensions, bytes and SHA-256 for every image. The evidence-only commit adds no production code; later evidence commits do not change the rendered source implementation above.
