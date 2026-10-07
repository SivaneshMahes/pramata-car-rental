import { createApp } from './app.js';
const { app, db, config, closeStreams } = await createApp();
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`Wheels 2 Go API: http://localhost:${port} | Web origin: ${config.origin}`),
);
function shutdown() {
  closeStreams();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
