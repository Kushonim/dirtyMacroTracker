/**
 * Auth routes: registration, login, and reading/updating the logged-in
 * user's profile (the stats used to calculate their daily macro targets).
 *
 * Passwords are never stored or compared in plain text — bcryptjs hashes
 * them one-way on register, and login re-hashes the attempt and compares
 * hashes rather than "decrypting" anything (hashing isn't reversible by
 * design). bcryptjs (a pure-JS implementation) is used instead of the
 * native `bcrypt` package specifically to avoid a real bug hit during
 * deployment: `bcrypt` compiles a platform-specific binary, so a version
 * built on Windows during local development wouldn't run on Render's
 * Linux containers. bcryptjs has an identical API with no compiled binary,
 * so the exact same code runs correctly in both environments.
 *
 * Sessions are stateless JWTs rather than server-side session storage —
 * the token itself carries the user's id (signed, not encrypted) and gets
 * verified on every request that needs auth, so there's no session table
 * to manage or expire manually beyond the token's own expiry.
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware for any route that requires a logged-in user.
 * Expects `Authorization: Bearer <token>`, verifies the JWT, and attaches
 * the decoded user id to req.userId for the route handler to use.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// POST /api/auth/register — create an account, return a ready-to-use token
// so the frontend doesn't need a separate login call right after signing up.
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  try {
    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong creating the account" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid username or password" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong logging in" });
  }
});

// GET /api/auth/profile — the onboarding/macro-calculation stats for the
// logged-in user. A null `age` (etc.) tells the frontend this account
// hasn't completed onboarding yet, and should be routed there instead of
// straight into the main app.
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, sex, age, height_cm, weight_kg, activity_level, goal_type FROM users WHERE id = $1",
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong fetching the profile" });
  }
});

// PUT /api/auth/profile — the onboarding form (and "edit profile" later)
// both submit here. Height/weight arrive already converted to cm/kg by the
// frontend, so the stored units are consistent regardless of which unit
// the user was shown (ft/in vs cm).
router.put("/profile", requireAuth, async (req, res) => {
  const { sex, age, height_cm, weight_kg, activity_level, goal_type } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users
       SET sex = $1, age = $2, height_cm = $3, weight_kg = $4, activity_level = $5, goal_type = $6
       WHERE id = $7
       RETURNING id, username, sex, age, height_cm, weight_kg, activity_level, goal_type`,
      [sex, age, height_cm, weight_kg, activity_level, goal_type, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong updating the profile" });
  }
});

module.exports = { router, requireAuth };
