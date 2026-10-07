# Wheels 2 Go

A complete vehicle rental assignment project: React frontend, Express API and a persistent SQLite database. Customers discover and rent vehicles; owners manage listings, requests and handovers. All eight optional bonus features are implemented.

## Run locally

Prerequisites: **Node.js 24 or newer**, npm and a modern browser. No database installation or cloud account is needed for email login. Node's built-in SQLite module is used.

```sh
cd "/Users/arjun/siva car rental"
npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:5173**. The API runs on port 3001; Vite proxies API requests and uploaded images. `npm run dev` starts both processes, and Ctrl+C stops both. Local database and demo accounts are created automatically on the first start. The same steps work on macOS, Linux and Windows; adjust the directory and use your platform's copy command.

For the built frontend, stop the development servers, then run:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. `npm start` serves the built site and API together. Leave `APP_ORIGIN` unset for the automatic local defaults. If you set it, it must exactly match the browser origin, including its port.

## Demo accounts

All demo accounts use **`SivaDemo2026!`**.

| Role | Email | Name |
| --- | --- | --- |
| Customer | `customer@siva.test` | Arjun Kumar |
| Owner | `owner@siva.test` | Siva Motors |
| Second owner | `meera@siva.test` | Meera Nair |

The customer has one completed Swift rental with an editable demo review and one upcoming approved Creta rental. Dates are relative to the day the database is first seeded. The two owners have separate fleets. Demo content and vehicle registration numbers are fictional; photography depicts example vehicle models. Sample credentials also appear in the sign-in dialog when demo mode is enabled.

For a full demonstration, open the app in two separate browser profiles: sign in as the customer in one and the owner in the other. Book an available Siva Motors vehicle for today to tomorrow, approve the request as owner, mark handed over, then mark returned. The customer receives live status notifications and can then review the completed rental. Future rentals can be approved but cannot be handed over before pickup day.

## Stack and installed versions

| Technology | Version verified during implementation |
| --- | --- |
| JavaScript runtime | Node.js 24.21.0 |
| Package manager | npm 11.19.0 |
| Database | SQLite 3.53.4, bundled with this Node installation |
| React / React DOM | 19.3.0 |
| Vite | 8.3.3 |
| Express | 5.2.1 |
| Helmet | 8.3.0 |
| express-rate-limit | 8.7.1 |
| Multer | 2.4.0 |
| Sharp | 0.35.5 |
| PDFKit | 0.20.2 |
| google-auth-library | 10.9.1 |
| Phosphor React icons | 2.1.10 |
| Prettier | 3.9.9 |

`package-lock.json` records the exact dependency tree. Use `npm ci` to reproduce it. SQLite's version depends on your installed Node runtime; Node 24 may describe the SQLite API as experimental. The app uses plain CSS, native date inputs, local React state, `fetch`, browser EventSource, and Node's built-in crypto/test modules. No ORM, state-management framework or separate database server is required.

## Folder guide and common edits

```text
src/
  App.jsx                    Session, navigation, notifications and feedback
  api.js                     API requests, money and date display helpers
  styles.css                 Design tokens and responsive layout rules
  components/
    Explore.jsx              Discovery and filtering
    VehicleCard.jsx          Card layout
    VehicleDetail.jsx        Gallery, booking and availability calendar
    Calendar.jsx             Monthly date view
    Dashboard.jsx            Customer/owner metrics and rental actions
    VehicleForm.jsx          Listing form and image upload
    Saved.jsx                Favorites
    Auth.jsx                 Login and registration
    UI.jsx                   Small shared UI pieces and data-loading hook
server/
  app.js                     App setup, security middleware and errors
  index.js                   Server startup/shutdown
  db.js                      Schema, indexes and overlap constraints
  domain.js                  Validation, date arithmetic, money and passwords
  auth.js                    Sessions, profiles, roles, CSRF and Google OAuth
  vehicles.js                Listings, filters, images and favorites
  bookings.js                Quotes, bookings, reviews, dashboards, SSE and PDFs
  seed.js                    Sample accounts, vehicles, coupons and rentals
public/images/               Local demo photographs
public/image-credits.html    Photo attribution page
scripts/dev.js               Starts both development processes
tests/                      Runnable domain and HTTP integration checks
docs/                       Design, API documentation, coverage and QA notes
data/                       Auto-created persistent database (ignored by Git)
uploads/                    Auto-created owner uploads (ignored by Git)
```

- **Colors and spacing:** edit the tokens at the beginning of `src/styles.css`; rules are grouped by screen and purpose.
- **Brand name and navigation:** edit `src/App.jsx`; invoice branding is in `server/bookings.js`.
- **Demo vehicles and their photos:** edit the `vehicles` array in `server/seed.js` and files in `public/images`. Seed edits affect a new database, not existing owner edits.
- **Prices and listing details:** use the owner's My vehicles page. Form prices are rupees; database/API prices are integer paise.
- **Features:** enter comma-separated features in the listing form.
- **Coupons:** edit the two seed definitions in `server/seed.js` for a fresh database, or modify the `coupons` table for an existing installation. There is no coupon admin UI because the assignment requests coupon use, not coupon administration.
- **Date and pricing rules:** `server/domain.js` and `quoteBooking` in `server/bookings.js` are the shared backend rules.
- **Formatting:** run `npm run format` after manual code edits. Source is formatted for readability.

## Database setup, persistence and backups

First startup creates the directory, SQLite file, schema, indexes and sample data. `npm run seed` also initializes/seeds safely: it preserves an existing installation rather than overwriting it. Database relationships use foreign keys. Sessions, users, vehicles, bookings, reviews, favorites, coupons and notifications persist across restarts. Uploads are stored separately.

Default database: `data/rental.sqlite`. Set `DATABASE_PATH` to another location if needed. There is no browser-localStorage business database.

To back up this local project, stop the server and copy the **entire `data/` and `uploads/` directories together**. To reset a disposable demo, stop the server, back up anything you need, remove or rename those directories, and start again. Resetting removes your accounts, bookings and uploads; it is not needed for normal usage. Seed data is relative to the reset day.

The schema is initialized idempotently with `CREATE TABLE IF NOT EXISTS`. Small additive migrations in `server/db.js` add profile fields and OAuth return routes to existing databases, preserving their records. There is no migration framework. If you later change an existing table schema, add an explicit migration or reset only disposable demo data.

## Environment

| Variable | Default / purpose |
| --- | --- |
| `PORT` | `3001`, API / built-site port |
| `APP_ORIGIN` | Dev: `http://localhost:5173`; `npm start`: `http://localhost:3001`. Exact origin allowed for writes and Google return navigation. |
| `DATABASE_PATH` | `./data/rental.sqlite` |
| `UPLOAD_DIR` | `./uploads` |
| `SEED_DEMO` | Demo enabled locally unless `false`. Automatically disabled in production. |
| `NODE_ENV` | Set to `production` for HTTPS deployment, secure cookies and CSP. |
| `GOOGLE_CLIENT_ID` | Google web OAuth client ID; leave blank for email login only. |
| `GOOGLE_CLIENT_SECRET` | Google web OAuth secret; never commit it. |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3001/api/auth/google/callback` |

Changing backend environment requires restarting the API. `.env` is ignored by Git. The development proxy expects the API at port 3001; if you change `PORT` in development, also update `vite.config.js`.

## Profile and branding

The Profile page lets customers and owners edit their display/business name, optional phone number, home city and private notes. Contact details and notes are not exposed through public vehicle listings. The sign-in email and account role cannot be changed here. Password accounts can change their password after verifying the current one; other sessions are revoked. Google accounts manage passwords through Google.

Brand artwork lives in `public/brand/mark.svg`; the wordmark is in `src/components/Brand.jsx`. Shared select arrows live in `Select` in `src/components/UI.jsx`. The login/register screens are in `Auth.jsx`, with `/login`, `/register`, `#login` and `#register` entry points. Booking dates are retained when a guest signs in. Existing demo emails/passwords and session-cookie identifiers stay compatible with previously created data.

## Google OAuth

For a different Google client or deployment, configure the server-only credentials:

1. Create a Google Cloud OAuth consent screen and a **Web application** OAuth client.
2. Add `http://localhost:3001/api/auth/google/callback` as an authorized redirect URI for local development. Register the exact production callback separately if deploying.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env`.
4. Add consent-screen test users if your Google app is in testing mode, then restart the API.
5. Click Continue with Google. Select the account role before Google login; it applies only to newly created accounts.

State is random, browser-bound, expiring and single-use; the Google ID token is verified for audience, expiry and nonce. Unverified email identities are rejected. Existing password accounts are **not silently linked** by email. Use password login for those accounts. Existing Google users keep their stored role. When credentials are absent, email login remains available. Live Google sign-in was verified on 7 October 2026 using the configured web client.

## Rental and financial assumptions

- Calendar dates use **Asia/Kolkata**. Pickup is included; return is excluded: 10 Oct to 11 Oct is **one rental day**. A return date must follow pickup, up to 365 days later. Past pickups and impossible dates are rejected.
- Requested, approved and handed-over bookings reserve their ranges. Rejected, cancelled and returned bookings do not. Adjacent bookings are allowed.
- Availability checking and insertion run inside `BEGIN IMMEDIATE`, with SQLite triggers independently preventing overlapping inserts/updates. A conflict returns HTTP 409; refreshing the UI alone is not the protection.
- Quotes and bookings are computed server-side. Daily price, days, discount, total and invoice party/vehicle details are frozen at booking time. If a price changes after a UI quote, the customer must check again before booking.
- Customer cancellation is allowed for requested or approved bookings **before pickup day**. Owners approve/decline requests; handover is allowed within the rental date range, followed by return. Owners can close an approved missed pickup after its return date, releasing the reservation. A returned rental unlocks reviews. There is no automatic handover or return.
- Owners cannot delete listings with requested, approved or handed-over bookings. Deletion archives a listing while preserving historical bookings, reviews and invoices. Pausing a listing blocks new bookings and preserves existing ones.
- Prices and calculations use **integer paise**. Percentage discounts round down to the nearest paisa and never exceed subtotal. No tax, deposit, hidden fee or payment integration is implied.
- Owner revenue reports the agreed totals of **returned rentals**, not money collected. This assignment does not process payments. PDF invoices are cost records, not payment receipts or tax invoices; cancelled/declined records are clearly labeled.
- Reviews require a returned booking, rating 1–5, and 10–2000 characters. There is one review per completed booking, editable by its customer. Repeat rentals may each have a review.
- In-app confirmation is persisted. SSE gives live updates while the app is open; durable notifications are reloaded when reconnecting or refocusing. No email/SMS messages are sent.
- Uploads accept up to 8 images per listing, 5 MB each, in JPEG/PNG/WebP. Actual decoding is checked, images are resized to at most 1600 × 1200 and re-encoded to WebP; metadata is removed. Filenames are generated and associated with the uploading owner. Unattached images from a cancelled form remain on disk; remove unreferenced files periodically if running this beyond a demo. Referenced historical images must be preserved.
- Search results include paused listings with an explicit unavailable status; supplying dates restricts results to available vehicles for the full range.

### Demo coupons

| Code | Discount | Minimum subtotal |
| --- | --- | --- |
| `FIRST10` | 10% | ₹1,000 |
| `ROAD500` | ₹500 | ₹5,000 |

Coupons are case-insensitive and apply once per booking. The sample validity window is 2020–2100. There is no per-user redemption cap in this assignment.

## Security and deployment notes

Passwords use salted Node scrypt with N=32768, r=8, p=1. Login tokens are 32 random bytes; only their SHA-256 hashes are stored. Session cookies are HttpOnly and SameSite=Lax, last seven days, and are invalidated on logout. Production cookies are Secure. Authentication endpoints are rate-limited. Authenticated writes require a session CSRF token and the configured Origin. Owner/customer roles and resource ownership are checked in the API, not merely hidden in the interface. SQL uses bound parameters. Uploads are decoded before being persisted; SVG is rejected.

A public deployment requires HTTPS, `NODE_ENV=production`, the exact HTTPS `APP_ORIGIN`, a fresh database with `SEED_DEMO=false`, persistent storage, and backups. Do not publish demo passwords with a public production database. The server binds to loopback for local use; a reverse proxy on the same host can forward to it. If your hosting platform needs a different bind address, edit `server/index.js`. Configure proxy trust deliberately before changing rate-limit behavior. SSE buffering must be disabled at your reverse proxy.

This is one straightforward local server. SQLite synchronous calls and one process suit the interview/demo workload; move to PostgreSQL and a shared notification service only if you need sustained traffic across multiple servers.

## Verification commands

```sh
npm test
npm run build
npm run format:check
npm audit
```

`npm run check` runs the tests and production build. Tests use temporary/in-memory databases and isolated upload directories; they do not modify your demo database. They cover dates, money/coupons, password hashes, registration/login/logout, roles/CSRF, filters, booking conflicts and adjacent ranges, price snapshots, lifecycle/review eligibility, ownership, favorites, deletion/history, images, PDF responses, live notifications and persistence.

See [API reference](docs/API.md), [assignment coverage](docs/ASSIGNMENT_CHECKLIST.md), [QA results](docs/QA.md), and [photo credits](docs/IMAGE_CREDITS.md).

The local web client’s callback is now registered in Google Cloud as `http://localhost:3001/api/auth/google/callback`, and sign-in has been verified end to end. The supplied calendar client is configured for an n8n callback on port 5678 and was not changed. The shared Google project’s consent-screen name is still **n8n**; changing that project-wide name would affect its other integrations. Only OpenID, email and profile scopes are requested; this app does not access Gmail messages or Calendar events. Credentials remain in ignored `.env`, never frontend code.

Profile API: authenticated GET /api/profile, PATCH /api/profile with name/phone/city/bio, and POST /api/profile/password with current_password/password. Writes require the usual Origin and CSRF headers. Email and role stay fixed.
