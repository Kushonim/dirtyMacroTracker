/**
 * Entry point for the Macro Loadout API.
 *
 * Responsibilities kept deliberately thin here — this file just wires
 * middleware and routers together. Actual logic (auth, requests, etc.)
 * lives in ./routes so this file stays readable as more routes get added.
 */
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { router: authRouter } = require("./routes/auth");
const requestsRouter = require("./routes/requests");

const app = express();

// Locked to the deployed frontend's origin rather than left wide open —
// a browser sitting on any other domain can't call this API directly.
app.use(cors({ origin: "https://dirty-macro-tracker-git-main-kushonim1.vercel.app" }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/requests", requestsRouter);

// Simple uptime check — useful for confirming the deploy is alive without
// needing valid credentials, and for free-tier hosts that spin down when
// idle (hitting this wakes the instance back up).
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Macro Loadout API running on port ${PORT}`));
