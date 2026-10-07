# Assignment coverage

The source assignment is `/Users/arjun/Downloads/Assignment - 7th Oct 2026.md`. Its product requirements were adopted at the user's request; its time/submission notes do not authorize external submission. All implementation remains in this workspace.

| Requirement | Implementation |
| --- | --- |
| Home cards: image, model, description, type, price, location, owner, availability | Explore and VehicleCard |
| Search by name/model | Explore and GET /vehicles?q= |
| Type, location, price, dates and owner filters | Explore controls and API filters |
| Vehicle detail with features and reviews | VehicleDetail |
| Pickup/return selection, availability and total cost | Calendar, booking form and authoritative quote API |
| Rental and persisted confirmation | Transactional booking API, confirmation dialog, notifications and dashboard |
| Overlapping-booking prevention | BEGIN IMMEDIATE transaction, INSERT/UPDATE overlap triggers and concurrency test |
| Owner add/edit/list/availability/delete | VehicleForm, owner dashboard and ownership checks |
| Multiple images, registration, price, location and features | Validated listing form and real image decoding |
| Upcoming bookings and customer details | Owner Bookings view |
| Owner approval, rejection, handover and return | Status actions and lifecycle validation |
| Customer current/previous/upcoming rentals and eligible cancellation | My rentals dashboard and filters |
| Completed-rental rating/written review and edits | Review form and guarded upsert API |
| Average rating and review count on cards | Aggregate SQLite queries and Rating component |
| Detailed reviews on vehicle page | VehicleDetail review section |
| Registration, login, username and logout | Auth dialog, persistent HttpOnly sessions and header |
| Distinct customer/owner roles and RBAC | UI navigation plus server role/ownership checks |
| Secure password handling | Salted scrypt password hashes |
| Google OAuth | Server OAuth flow, state/nonce verification, role selection and UI; external credentials required for live use |
| Data persistence and relationships | SQLite, foreign keys, indexes and local uploads |
| Validation and loading/empty/success/error states | Server validators, UI form errors, skeletons, retry and confirmation states |
| README setup, versions, database, API, requirements, credentials and assumptions | README and docs/API.md |
| Bonus: real-time status notifications | SSE plus persistent notification inbox |
| Bonus: wishlist/favorites | Saved vehicles view and unique favorite relationships |
| Bonus: availability calendar | Monthly calendar with reserved/selected dates |
| Bonus: customer dashboard | Upcoming/on-road/completed metrics and rental history |
| Bonus: owner dashboard | Vehicles, on-road rentals, completed revenue and average rating |
| Bonus: multi-image uploads | Up to eight validated photos, cover selection via first photo, gallery thumbnails |
| Bonus: invoice generation | Authorized PDF download with frozen booking details and discount |
| Bonus: coupons | Server-validated FIRST10 and ROAD500 with minimum subtotal and validity |

No paid payment service, email/SMS delivery or external deployment is implied by the assignment. Google OAuth is implemented and configurable; it cannot be live-verified without an actual OAuth client.
