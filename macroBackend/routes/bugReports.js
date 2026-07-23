/**
 * Bug reports — same pattern as requests.js: public, no auth required,
 * since a bug can happen to a guest just as easily as a logged-in user.
 */
const express = require("express");
const pool = require("../db");

const router = express.Router();

// POST /api/bug-reports
router.post("/", async (req, res) => {
  const { description, contact_info } = req.body;

  if (!description || !description.trim()) {
    return res.status(400).json({ error: "A description of the bug is required" });
  }

  try {
    await pool.query(
      `INSERT INTO bug_reports (description, contact_info) VALUES ($1, $2)`,
      [description, contact_info || null]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong submitting your bug report" });
  }
});

module.exports = router;
