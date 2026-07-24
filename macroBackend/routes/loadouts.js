/**
 * Loadout history — one saved snapshot per user per calendar date.
 * Every route here requires auth (guests never persist; their loadout
 * only ever lives in frontend state and disappears on refresh, by design).
 *
 * Dates are always the string form "YYYY-MM-DD" as sent by the frontend,
 * which builds that string from the user's *local* time — not UTC — so
 * a loadout logged late at night lands on the day the user actually
 * experienced it, not whatever day UTC happens to be at that moment.
 */
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("./auth");

const router = express.Router();

// GET /api/loadouts — a lightweight list of every saved date + that day's
// total calories, just enough to render dots on a calendar without
// fetching every item for every day up front.
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT loadout_date, items FROM daily_loadouts WHERE user_id = $1 ORDER BY loadout_date DESC`,
      [req.userId]
    );
    const summary = result.rows.map((row) => {
      const items = row.items || [];
      const totalCal = items.reduce((sum, i) => sum + i.cal * i.qty, 0);
      return { date: row.loadout_date, totalCal };
    });
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong fetching loadout history" });
  }
});

// GET /api/loadouts/:date — full item list for one specific day.
router.get("/:date", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT loadout_date, goal_type, items FROM daily_loadouts WHERE user_id = $1 AND loadout_date = $2`,
      [req.userId, req.params.date]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "No loadout saved for this date" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong fetching that day's loadout" });
  }
});

// PUT /api/loadouts/:date — create or overwrite the day's saved items.
// Upserts on (user_id, loadout_date) so re-saving the same day just updates it.
router.put("/:date", requireAuth, async (req, res) => {
  const { items, goal_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO daily_loadouts (user_id, loadout_date, goal_type, items, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, loadout_date)
       DO UPDATE SET items = $4, goal_type = $3, updated_at = NOW()
       RETURNING loadout_date, goal_type, items`,
      [req.userId, req.params.date, goal_type, JSON.stringify(items)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong saving that day's loadout" });
  }
});

// DELETE /api/loadouts/:date — remove a saved day entirely (used when
// editing history and clearing a day rather than leaving an empty entry).
router.delete("/:date", requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM daily_loadouts WHERE user_id = $1 AND loadout_date = $2`, [req.userId, req.params.date]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong deleting that day's loadout" });
  }
});

module.exports = router;
