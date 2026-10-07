import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db.js';
import { seedDemo } from './seed.js';
import { setupAuth } from './auth.js';
import { setupVehicles } from './vehicles.js';
import { setupBookings } from './bookings.js';
export async function createApp(options = {}) {
  const production = process.env.NODE_ENV === 'production';
  const config = {
    production,
    origin:
      process.env.APP_ORIGIN ||
      (production || process.argv.includes('--serve')
        ? `http://localhost:${process.env.PORT || 3001}`
        : 'http://localhost:5173'),
    uploadDir: resolve(process.env.UPLOAD_DIR || './uploads'),
    demo: process.env.SEED_DEMO !== 'false' && !production,
    googleId: process.env.GOOGLE_CLIENT_ID,
    googleSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirect:
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
    ...options,
  };
  const db = options.db || openDatabase();
  mkdirSync(config.uploadDir, { recursive: true });
  if (config.demo) await seedDemo(db);
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              'img-src': ["'self'", 'blob:'],
              'script-src': ["'self'"],
              'connect-src': ["'self'"],
              'upgrade-insecure-requests': null,
            },
          }
        : false,
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', (req, res, next) => {
    if (Array.isArray(req.body))
      return res.status(400).json({ error: 'Use a JSON object for this request.' });
    req.body ??= {};
    next();
  });
  setupAuth(app, db, config);
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: config.test ? 2000 : 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many requests. Please wait a minute.' },
    }),
  );
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  setupVehicles(app, db, config);
  const closeStreams = setupBookings(app, db, config);
  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  app.use(
    '/uploads',
    express.static(config.uploadDir, { dotfiles: 'deny', maxAge: '1d', index: false }),
  );
  app.use('/images', express.static(resolve('public/images'), { maxAge: '1d' }));
  const dist = resolve('dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get('/{*path}', (req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 500,
      message = error.message;
    if (error.code === 'LIMIT_FILE_SIZE') {
      status = 400;
      message = 'Each image must be 5 MB or smaller.';
    } else if (error.name === 'MulterError') {
      status = 400;
      message = 'Upload up to 8 images, using the images field.';
    } else if (message?.includes('booking_overlap')) {
      status = 409;
      message = 'Another booking reserved these dates. Choose a different date range.';
    } else if (message?.includes('UNIQUE constraint')) {
      status = 409;
      message = 'That email or registration number is already in use.';
    } else if (status === 500) {
      console.error(error);
      message = 'Something went wrong. Please try again.';
    }
    res.status(status).json({ error: message });
  });
  return { app, db, config, closeStreams };
}
