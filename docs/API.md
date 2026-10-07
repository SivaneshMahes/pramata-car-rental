# API reference

All routes are prefixed with `/api`. JSON request/response bodies are used except image upload, SSE and invoice download. API monetary values are **integer paise**; listing create/edit accepts `daily_price` as a decimal rupee string or number. Dates are `YYYY-MM-DD`. Errors are `{ "error": "Actionable message" }` with HTTP 400 validation, 401 sign-in required, 403 forbidden, 404 missing, 409 conflict or 500 unexpected failure.

## Session protocol

Send cookies with requests. Sign-in/registration sets `siva_session` and returns `{ user, csrf }`. `GET /auth/me` also returns the active session's CSRF token. Send `X-CSRF-Token: <csrf>` on authenticated writes and an `Origin` matching `APP_ORIGIN`. Signed-out registration/login requires the allowed Origin. The app's `src/api.js` implements this once for all UI requests.

```json
{
  "user": { "id": 1, "name": "Arjun Kumar", "email": "customer@siva.test", "role": "customer" },
  "csrf": "opaque-token"
}
```

## Authentication

| Method | Route | Access | Request / response |
| --- | --- | --- | --- |
| GET | `/auth/me` | Public | `{ user: object or null, csrf: string or null, google: boolean, demo: boolean }` |
| POST | `/auth/register` | Public | `{ name, email, password, role: "customer" or "owner" }` → session, HTTP 201 |
| POST | `/auth/login` | Public | `{ email, password }` → session |
| POST | `/auth/logout` | Signed in | Invalidates session, clears cookie → `{ ok: true }` |
| GET | `/auth/google?role=customer` | Public | Starts OAuth redirect; 503 without credentials |
| GET | `/auth/google/callback` | OAuth callback | Verifies state and Google identity, sets session, redirects to app |
| GET | `/health` | Public | `{ ok: true }` |

Password registration requires 10–128 characters. Names require 2–80 characters. Role is stored at registration and cannot be changed through the API. OAuth errors return to the app as a displayed `authError` query parameter.

## Discovery and vehicle management

| Method | Route | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/vehicles` | Public | Listing array, excluding archived listings |
| GET | `/filters` | Public | Distinct `locations` and `owners` for controls |
| GET | `/vehicles/:id` | Public | Vehicle, reviews and reserved date ranges, without customer booking details |
| GET | `/vehicles/:id/availability?start=...&end=...` | Public | `{ days, available }` for a valid future range |
| GET | `/owner/vehicles` | Owner | Own active listings, including paused ones |
| POST | `/vehicles` | Owner | Create listing, HTTP 201 |
| PATCH | `/vehicles/:id` | Owning owner | Full listing edit, or `{ "available": false }` to pause |
| DELETE | `/vehicles/:id` | Owning owner | Archive only if no requested/approved/handed-over booking exists |
| POST | `/uploads` | Owner | Multipart `images` files → `{ images: ["/uploads/..."] }`, HTTP 201 |

Filters: `q` (model search), `type` (Car, SUV, Bike, Van), `location`, `owner` (ID), `min` and `max` (rupees), `start` and `end` (both required together), and `sort` (`recommended`, `price_asc`, `price_desc`, `newest`). Recommended sorts by average rating then ID. Filters combine with AND. Public dates include requested/approved/handed-over reservations as `{ start_date, end_date }` only. A reserved return boundary may be used for an adjacent rental.

Create/edit body:

```json
{
  "name": "Hyundai Creta",
  "summary": "A comfortable SUV for weekend getaways.",
  "description": "A well-maintained SUV with air conditioning and space for the whole family.",
  "type": "SUV",
  "registration": "TN09AB1234",
  "daily_price": "3200.00",
  "location": "Chennai",
  "available": true,
  "features": ["Automatic transmission", "Air conditioning", "GPS", "5 seats"],
  "images": ["/uploads/2-generatedfilename.webp"]
}
```

The image example is illustrative; use actual paths returned by upload. New references must belong to the uploading owner and exist on disk. Existing photos may be retained only on their existing listing. Features: at most 20 nonempty strings, 60 characters each. Images: 1–8, maximum 5 MB per upload, JPEG/PNG/WebP; re-encoded as WebP. Upload limit also caps decoded pixels at 24 million. Registration is unique across archived and live vehicles to preserve historical identity.

## Favorites

| Method | Route | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/favorites` | Customer | Saved listing array, excluding archived vehicles |
| GET | `/favorite-ids` | Customer | Array of saved vehicle IDs |
| PUT | `/favorites/:id` | Customer | Idempotently save a live listing |
| DELETE | `/favorites/:id` | Customer | Idempotently remove favorite |

## Quotes, bookings and lifecycle

| Method | Route | Access | Behavior |
| --- | --- | --- | --- |
| POST | `/bookings/quote` | Customer | Check dates, availability and coupon; return authoritative cost |
| POST | `/bookings` | Customer | Recheck and create transactionally, HTTP 201 |
| GET | `/bookings` | Signed in | Own rentals for customers; own fleet's rentals for owners |
| PATCH | `/bookings/:id/status` | Relevant customer/owner | Validated `{ status }` transition |
| GET | `/bookings/:id/invoice` | Booking customer or vehicle owner | Download PDF; forbidden to unrelated users |
| GET | `/dashboard` | Signed in | Role-specific metrics |

Quote body:

```json
{
  "vehicle_id": 1,
  "start_date": "2027-01-10",
  "end_date": "2027-01-12",
  "coupon": "FIRST10"
}
```

Quote response example at ₹1,800/day:

```json
{
  "days": 2,
  "daily_price": 180000,
  "subtotal": 360000,
  "discount": 36000,
  "total": 324000,
  "coupon": "FIRST10",
  "available": true
}
```

Create uses the same body. The UI also sends `expected_total` and `expected_daily_price` from its quote; if these no longer match the current server quote, the API returns 409 and asks the customer to check again. The booking captures immutable vehicle/customer/owner details in `snapshot`, along with the agreed monetary amounts.

Allowed status progression:

```text
requested → approved → handed_over → returned
requested → rejected
requested / approved → cancelled (customer, before pickup day)
approved → rejected (owner, missed pickup after return date)
```

Owners cannot hand over before pickup or after the rental return date. A return requires a previous handover. Requests that have passed their return date cannot be approved. Reject expired requests to resolve them. A missed pickup on an approved rental can be closed by the owner after the return date; see the status rules in `server/bookings.js`.

Dates reserve a half-open range `[start_date, end_date)`. Booking insertion uses a transaction plus overlap triggers. All conflicts are HTTP 409, including two competing requests that initially saw the same availability. User-supplied daily prices/discount totals are never used to calculate a booking.

Customer dashboard: `role`, `upcoming`, `active`, `completed`. Owner dashboard: `role`, `vehicles`, `active`, `pending`, `revenue`, `rating`, `review_count`. Revenue is completed rental totals, not collected payment.

## Reviews

`POST /reviews` (customer) accepts `{ booking_id, rating, body }`. The caller must be that booking's customer and its status must be `returned`. Rating is an integer from 1 to 5; body is 10–2000 characters. Repeating the request for the same completed booking edits the customer's existing review. Reviews are never overwritten through another customer's booking. Vehicle detail includes public reviews with author name and dates; it does not expose author email.

## Notifications

| Method | Route | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/notifications` | Signed in | Latest 100 notifications belonging to the user |
| PATCH | `/notifications/read` | Signed in | Mark own current notifications read |
| GET | `/notifications/stream` | Signed in | Session-authenticated server-sent events |

The SSE stream emits `connected` on connection and `notification` when a relevant booking changes. The UI reloads durable notifications and affected screens in response; event payloads contain no private booking data. Streams recheck session validity every 15 seconds and are capped at five per user. The client reconnects using native EventSource and reloads missed records. No polling interval is required.
