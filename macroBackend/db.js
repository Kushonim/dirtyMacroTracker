/**
 * Postgres connection pool, shared across every route file.
 *
 * Using a pool (rather than a single client) lets Express handle multiple
 * concurrent requests without each one opening its own database connection —
 * the pool hands out and reuses a small set of open connections as queries
 * come in.
 *
 * DATABASE_URL is read from the environment (.env locally, or the host's
 * env var settings in production) and is never hardcoded, so the same code
 * runs against a local dev database or the deployed one without changes.
 */
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
