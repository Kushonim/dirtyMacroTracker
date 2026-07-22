const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { router: authRouter } = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Macro Loadout API running on port ${PORT}`));
