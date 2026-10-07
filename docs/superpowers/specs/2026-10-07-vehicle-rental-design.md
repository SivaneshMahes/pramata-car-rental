# Wheels 2 Go: project design

## Goal and scope
Build an interview-ready vehicle rental web application covering every core, good-to-have, and optional bonus item in the supplied assignment. Keep source files understandable and the application easy to run and manually edit. The assignment is a requirements reference; its deadline and submission notes do not authorize submitting or contacting anyone.

## Architecture decision
Recommended: React with Vite, a Node.js/Express API, and SQLite. One repository, one database file, no separate database service, no microservices, no complex global state library. Use plain CSS with named design tokens and small, purpose-specific React components. Keep the backend organized around authentication, vehicles, bookings, and reviews.

Alternatives considered: Next.js combines frontend and backend but introduces framework conventions that make beginner edits less obvious. Django provides strong built-in authentication but introduces a second language alongside frontend JavaScript. The recommended stack keeps application code in JavaScript and setup local.

## Visual design and navigation
Use Wheels 2 Go as the working brand. Light neutral surfaces, charcoal text, one restrained blue accent, system sans-serif typography, generous spacing, and consistent rounded controls. Real vehicle photography, readable cards, and modest interaction feedback. Use brief entrance and interaction animations with reduced-motion support; avoid distracting continuous animation or gradient-heavy templates.

Primary navigation: Explore, My rentals, Saved vehicles, and account controls for customers; Explore, My vehicles, and Bookings for owners. Show the authenticated user's name and notification inbox. Responsive layouts, keyboard focus, explicit form labels, and reduced-motion support.

Explore provides vehicle cards and filters without requiring login. Detail pages provide a gallery, specifications, owner, reviews, an availability calendar, and a booking form with a clear cost breakdown. Authentication is requested when taking a protected action.

## Data model
- Users: name, unique normalized email, password hash, customer or owner role, optional Google identity.
- Sessions: opaque session token stored as a hash, user reference, expiry.
- Vehicles: owner reference, model, short and detailed descriptions, type (Car/SUV/Bike/Van), unique registration number, daily price in integer paise, location, availability flag, features, image references.
- Bookings: vehicle/customer references, start and end dates, state, frozen daily price, discount, total, coupon, creation time.
- Reviews: vehicle/customer/booking references, 1–5 rating and written review. One review per completed booking, editable only by its author.
- Favorites: unique customer/vehicle pair.
- Notifications: recipient, message, booking reference, read state, timestamp.
- Coupons: code, percentage or fixed discount, validity dates and minimum rental subtotal.
Use foreign keys, indexes, and transactions. Seed realistic demo vehicles and users with clearly documented credentials. Do not misrepresent demo reviews as live customers.

## Authentication and authorization
Hash passwords using a maintained password hashing implementation. Use server-managed sessions in HttpOnly cookies, expiry, logout invalidation, login rate limiting, same-origin/CSRF protection, and server-side role and ownership checks. Registration chooses customer or owner. Never expose password hashes or session secrets.

Include Google OAuth with verified state and server-side identity validation. It requires a real Google client ID, secret, and configured callback URL supplied through environment variables. Local password login works without those credentials. Document configuration; show a truthful unavailable state when OAuth is not configured. Never fake Google login.

## Booking correctness and lifecycle
Treat rentals as half-open date ranges [start, end): pickup date included, return date excluded. End must follow start; a one-day rental returns the next day. Dates are calendar dates interpreted consistently in Asia/Kolkata. Block past pickups and invalid dates. Price is the integer number of rental days multiplied by the frozen integer daily price, less a validated discount; no hidden fees.

States: requested → approved → handed_over → returned. Owners may reject requested bookings. Customers may cancel requested or approved bookings before the pickup date. Returned, rejected, and cancelled bookings do not reserve future availability. Requested, approved, and handed_over bookings block overlapping ranges. Perform overlap checks and insertion in one SQLite transaction so simultaneous requests cannot double-book. Adjacent date ranges are allowed. Status transitions and ownership are validated on the server.

Unavailable vehicles cannot accept new bookings. Existing bookings remain visible and manageable. Owners may delete a vehicle only when it has no requested, approved, or handed-over booking; preserve historical rentals and invoices using archival deletion. Reviews require a returned rental and cannot be written by owners on their own vehicles.

## Required features
- Discovery cards: image, model, short description, type, price, location, owner, availability, average rating and review count.
- Search by model; filters for type, location, price range, date range, and owner, with reset and empty states.
- Vehicle detail, dates, availability check, cost calculation, rental request and confirmation.
- Owner create/edit vehicles, multiple images, features, toggle availability, permitted deletion, and booking management.
- Customer upcoming/current/history lists and eligible cancellation.
- Owner customer details, approve/reject, handover/return actions.
- Completed-rental reviews, author editing, average/count and detail display.
- Registration, login, logout, name display, customer/owner RBAC, and configurable Google OAuth.

## All eight bonus features
1. Real-time booking notifications through authenticated server-sent events, with durable notification storage and unread/read state. Reconnecting clients retrieve missed notifications.
2. Persistent customer favorites, with save/remove actions and a dedicated view.
3. Vehicle availability calendar showing blocked dates and the selected rental range. Public responses expose reserved dates without customer details.
4. Customer dashboard with upcoming, active, and previous rentals.
5. Owner dashboard with listed vehicle count, active rentals, revenue, and average review rating. Revenue includes returned rentals; report confirmed revenue separately if shown.
6. Multiple image uploads with file-size/count limits, validated image types, generated filenames, and static image serving. Support gallery previews and image removal on editing.
7. Downloadable rental invoice with booking reference, parties, vehicle, dates, day count, daily price, discount and total. Restrict access to the booking's customer and owner. Clearly label cancelled/rejected booking documents and avoid claiming payment collection.
8. Coupon validation and discount calculation on the server, reflected consistently in quotes, bookings, dashboards and invoices. Seed and document demo coupons.

## Error handling and persistence
Persist all business data in SQLite and uploaded images on disk. Validate all inputs on the server, return meaningful HTTP errors, and show inline errors and retry actions in the UI. Provide pending/loading, empty, success, and error states. Preserve entered form values on recoverable failures. Never use browser localStorage as the business database.

## Verification
Use runnable automated checks for date arithmetic, price/coupon calculations, overlapping and adjacent requests, simultaneous booking conflicts, role and ownership enforcement, session behavior, lifecycle transitions, review eligibility, uploads and invoice access. Run a production build. Exercise customer and owner journeys in a browser, including responsive layouts and keyboard navigation. Document actual results and limitations instead of promising zero defects.

## Documentation and editability
README includes exact installed language/framework/database/dependency versions, prerequisites, environment variables, step-by-step setup, database initialization/reset, demo credentials, coupon codes, API routes, date/price/lifecycle assumptions, Google OAuth setup, and test commands. Provide .env.example without secrets and an assignment checklist mapping each requirement to its implementation.

Keep branding, colors, seed vehicles and coupon definitions easy to locate. Explain the small directory structure and common edits. Use clear names and standard platform features rather than speculative abstractions.

## External dependencies and boundaries
No payment processing, email/SMS delivery, deployment, or assignment submission is requested. Booking confirmation is in-app and persisted. Google OAuth requires external credentials to test live. Invoice generation records a rental agreement/cost breakdown and does not assert that payment occurred. Photo provenance and demo content will be documented.
