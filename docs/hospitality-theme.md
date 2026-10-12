# Hospitality selection source contract

Approved by delivery parent 12 October 2026 before production implementation.
Existing Frappe site-config field: `ury_hospitality_theme` is new source contract,
with exactly one admitted value: `"hospitality"`. It is not a native DocType setting.
`ury.brand.get_brand_context(surface="staff")` accepts only that exact string;
missing, null, empty, `off`, dictionaries, arbitrary URLs and all other values
resolve to None. Public/default brand context and guest `/order` ignore it.
Staff `/pos`, `/urypos`, `/mosaic` templates render a fixed HTML
`data-ury-theme="hospitality"` marker for accepted context, or an empty data attribute otherwise. Their boot
mirrors `ury_hospitality_theme`, including authenticated/developer POS boot.
No new endpoints, settings owner, URL loader or CSS service.

All three existing index.css files import the same framework-neutral built-in
`packages/ui/src/styles/hospitality.css`. Original React theme.css is untouched.
Warm semantic overrides use existing @ury/ui token names. Legacy neutral utility
adapters and system-serif headings apply only on light devices; original Vue
system-dark classes remain the authority. Explicit `.dark` retains existing React
tokens. Brand primary/actions and operational red/green/blue states are native.
Existing body fonts are retained; no font asset or remote URL is introduced.

No deployment/config activation is performed here. A future reviewed exact-pin
and site-config declaration change is independent. Rollback is prior URY source
pin plus removing/reverting only this approved site-config field.
