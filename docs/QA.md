# Verification results

Verified on 7 October 2026 using Node.js 24.21.0 and Chromium through agent-browser. These results describe the checks performed, not a guarantee that software can never contain a defect.

## Automated checks

- `npm test`: **19 passed**, zero failed/skipped. Tests use isolated databases and uploads.
- `npm run build`: passed; the frontend is bundled into `dist/`.
- `npm run format:check`: passed.
- `npm audit`: **zero reported vulnerabilities** in the installed application dependency tree at verification time.

Checks cover strict dates including leap days, duration and price arithmetic, percentage rounding and minimum coupon subtotals, salted password hashes, password whitespace, registration/login/logout, session/CSRF/origin enforcement, role and resource ownership, all discovery filters, invalid JSON, live notifications, image decoding and multi-image uploads, persistence, archived history and PDF access. Competing requests yield one booking and one HTTP 409; partial/contained overlaps fail and adjacent ranges succeed. Database triggers also reject a direct overlapping insert. Quoted price changes force rechecking. Expired approved rentals can be closed without retroactive handover.

## Browser journeys

Passed:

- Customer login and owner login with distinct navigation and displayed names.
- New customer registration and automatic session creation.
- Saving a vehicle, viewing the Saved vehicles page and a saved-state button.
- Vehicle detail, calendar pickup/return selection, coupon quote, rental request and confirmation.
- Owner approval in another browser session; the customer view and unread notifications update without a manual page refresh.
- Owner handover and return; the customer can then leave a review and subsequently sees Edit review.
- Owner listing creation using two actual image uploads, price editing, pausing and deletion of the temporary listing.
- Notification inbox and Mark all read.
- Mobile filters, search with no results, reset, and mobile navigation.
- Both development mode and the bundled site served through `npm start`; login works in the bundled site with its automatic local origin.

The generated PDF was downloaded, extracted and rendered for visual inspection: **one page**, readable party/vehicle/date information, correct one-day calculation, FIRST10 discount and total, with no clipping or overlap. The invoice states that it is a cost record, not a collected-payment receipt.

## Responsive and accessibility checks

Inspected desktop discovery and dashboards, plus mobile layouts at **390 × 844** and **320 × 740**. Measured document widths matched viewport widths, with no horizontal overflow. All seven local demo photographs loaded successfully.

Axe-core WCAG 2 A/AA scans report **zero violations** on the corrected desktop discovery, mobile discovery, customer rental dashboard, owner fleet dashboard, owner listing form and bundled discovery page. Low-contrast footer and metric text found in the initial scans were corrected. Native dialogs manage modal focus and Escape dismissal; form labels, visible keyboard focus and reduced-motion rules are included. Automated accessibility scans do not replace evaluation with real assistive-technology users.

## External configuration and practical limits

Both supplied Google client IDs were checked with the app callback. The calendar client still returns redirect_uri_mismatch because it is registered for an existing n8n callback on port 5678; its settings were preserved. The web/Gmail client had no registered callbacks. The exact app callback http://localhost:3001/api/auth/google/callback was added and saved in Google Cloud. Real Google sign-in then completed successfully: code exchange, token verification, session creation and navigation to the signed-in customer dashboard. The Google project-wide consent-screen name remains n8n. Only OpenID/email/profile scopes are requested. Secrets are excluded from source and QA artifacts.

Public HTTPS deployment and payment/email/SMS services were not part of this task. The compiled site was checked locally. The application is designed for one local server; database schema changes, multi-server scaling, and periodic orphan-upload cleanup are documented in README.

Source, setup instructions, API reference and assignment coverage are preserved in the repository. Browser QA output files are under ignored `artifacts/qa/`, rather than shipped as business data or fixtures.

## Wheels 2 Go update verification

- Name, mark, favicon, page titles, invoice headings and W2G booking references updated. Existing demo credentials and session cookie names remain compatible.
- Dedicated login/register screens, password visibility control, shared selects with aligned arrows, reduced-motion support and full-height footer layout implemented.
- Profile name, optional phone, city and private notes saved and persisted after reload in a disposable customer account; displayed names updated immediately. Both customer and owner profile APIs were covered, including validation, privacy, identity preservation and CSRF. Password tests verify current-password checks, replacement, session rotation and revocation of other sessions in isolated databases.
- OAuth tests verify browser-bound state, nonce, replay rejection, roles, password-account protection, safe return routes and rejection of external return URLs.
- Guest calendar dates (15–17 November 2026) and FIRST10 were restored after email login on the same vehicle page. No QA rental was created. An expired session led to login with a clear message. Keyboard Skip to content focused main without breaking the route.
- Updated axe-core WCAG 2/2.1 A/AA checks found zero violations on desktop login, registration, discovery and profile, plus mobile discovery and profile. Prior browser coverage remains recorded above.
- Widths checked at 320, 390 and 768 pixels. A 320px header overflow found during review was fixed. Login/profile screenshots were visually inspected; footer width and position were corrected.
- Temporary QA users and the browser-only accessibility harness removed after validation. The user’s Google account, rental records and demo accounts preserved.

The rebranded PDF was downloaded and its extracted text verified: one page, Wheels 2 Go heading and W2G-00001 reference. The final Google profile page showed no browser console errors or warnings.
