/**
 * "Don't see what you're looking for?" feature requests.
 *
 * Deliberately has no auth requirement — guests (people who skipped account
 * creation) should still be able to suggest a restaurant or menu item, so
 * this is one of the only writes in the app that doesn't require a JWT.
 */
const express = require("express");
const pool = require("../db");

const router = express.Router();

// POST /api/requests
router.post("/", async (req, res) => {
  const { request_type, restaurant_name, item_name, note } = req.body;

  if (!request_type || (request_type !== "restaurant" && request_type !== "menu_item")) {
    return res.status(400).json({ error: "request_type must be 'restaurant' or 'menu_item'" });
  }

  try {
    await pool.query(
      `INSERT INTO requests (request_type, restaurant_name, item_name, note)
       VALUES ($1, $2, $3, $4)`,
      [request_type, restaurant_name || null, item_name || null, note || null]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong submitting your request" });
  }
});

module.exports = router;
