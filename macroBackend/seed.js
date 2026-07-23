/**
 * Seeds a single local test/dev account for manually exercising the API
 * (e.g. with Thunder Client or Postman) before wiring up the frontend.
 *
 * DEV/TEST USE ONLY. The username/password here are intentionally simple
 * and predictable, which is fine for a throwaway local account but would
 * be a real vulnerability on any deployed, publicly reachable database —
 * never run this against a production instance.
 *
 * Run with: npm run seed
 */
const bcrypt = require("bcryptjs");
const pool = require("./db");

async function seed() {
  const username = "user";
  const plainPassword = "ADMIN";
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
  if (existing.rows.length > 0) {
    console.log(`Test user "${username}" already exists — skipping.`);
    process.exit(0);
  }

  await pool.query(
    `INSERT INTO users (username, password_hash, sex, age, height_cm, weight_kg, activity_level, goal_type)
     VALUES ($1, $2, 'male', 25, 173, 77, 'moderate', 'bulk')`,
    [username, passwordHash]
  );

  console.log(`Test user created — username: ${username}, password: ${plainPassword}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
