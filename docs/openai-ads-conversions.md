# OpenAI Ads server purchase repair

Next.js 14, Node runtime; incremental Pixel+CAPI repair. The existing browser
pixel remains installed once in app/layout.tsx. Production debug logging is off.

## Scope

- `order_created` now sends from confirmed Studio top-ups (Mercado Pago
  approval, Stripe webhook, authenticated payment sync) and confirmed plan
  payments (Mercado Pago direct approval/webhook and Stripe webhook).
- Top-ups require paid status and paid_at; plans read their paid ledger record,
  preserving actual charged value/currency rather than catalog prices.
- Uses existing server-only `OPENAI_CONVERSIONS_API_KEY`. The browser and server
  use the same existing Pixel ID. No secrets are exposed in browser code/logs.
- Browser dedupe IDs remain `dcc_order_topup_<topup ID>` and
  `dcc_order_plan_<payment row ID>`. Server retries reuse them and paid_at.
- No changes to Meta/Google credentials, payloads, event IDs or dispatch calls.
  Existing top-up fan-out adds an independent OpenAI promise at the end.
- No schema migrations, new infrastructure, queues or scheduled jobs.

## Attribution, data and privacy

Checkout metadata stores OpenAI context separately as `openai_ads`. Raw
`__oppref` and `__obref` cookie values pass unchanged to the event-level oppref
and user.obref fields, respectively. Checkout capture reads no query parameters.
Emails are trimmed/lowercased before SHA-256; external IDs are trimmed with case
preserved. Client IP/UA come only from saved checkout browser context, never
payment gateway webhook identity. Older paid checkouts can reuse their saved
browser metadata for matching; absent click references are not invented.

Source URLs allow HTTP(S) and a trusted checkout/request or configured origin,
then strip query strings and fragments. The sender accepts the configured
canonical origin; any other URL falls back to a canonical Studio URL. Webhook
URLs therefore need not match the original browser conversion page: checkout
page URLs are preferred where available.

Existing measurement behavior is preserved, without expanding browser user-data
collection or changing consent/opt-out semantics. Existing browser matching
remains in PartnerAttribution. No new personalization opt-out setting is added.
Review privacy, security, consent and data-handling requirements before release.

## Reliability and limitations

All OpenAI event building, hashing, URL validation and fetch operations are
caught. HTTP errors cannot fail payment processing or other advertising calls.
Two bounded transport attempts (2.5 seconds each) retry only network, 429 or 5xx
failures using identical events. The awaited parallel fan-out may add at most
approximately five seconds if the OpenAI service is unavailable. The existing
paid-topup sync provides another OpenAI-only retry; no new durable queue exists.
Logs expose event ID plus transport status, never keys or raw customer fields.
HTTP success means submitted, not yet attributed or counted in Ads Manager.
Only events inside the documented seven-day window are eligible; timestamps
are never rewritten to disguise old payments. No historical replay was run.

## Events intentionally unchanged or skipped

Existing browser order_created and registration_completed remain in place.
No new page_viewed, contents_viewed, items_added, checkout_started,
lead_created, appointment_scheduled, subscription_created or trial_started:
this repair is limited to confirmed purchases. Registration and checkout server
coverage can be evaluated separately at verified success boundaries. There is
no confirmed cart, appointment, lead or trial flow in scope. Native/mobile and
offline surfaces are outside this web repair.

## Verification

Targeted OpenAI tests cover schema, dedupe, identifier hashing, URL sanitization,
actual payment timestamps, currency units, paid-only guards and failure isolation.
Existing Meta dedupe and GA4 identity tests are run unchanged. TypeScript checks
are run before the single main-branch production release. Runtime OpenAI receipt
and eventual attribution require production evidence; no synthetic purchases
are submitted to advertising systems.
