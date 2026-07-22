const express = require("express");
const cors = require("cors");
const requestsRouter = require("./routes/requests");
require("dotenv").config();

const { router: authRouter } = require("./routes/auth");

const app = express();
app.use(cors({ origin: "https://dirty-macro-tracker-git-main-kushonim1.vercel.app" }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/requests", requestsRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Macro Loadout API running on port ${PORT}`));
