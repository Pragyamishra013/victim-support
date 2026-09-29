const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./db");
const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.resolve(__dirname, "../frontend")));

app.use("/api/cases", require("./routes/cases"));
app.use("/api/ngo", require("./routes/ngo"));

app.get("/api/health", (_req, res) => res.json({ success: true, message: "NIVARAN backend is running" }));
app.get("/", (_req, res) => res.sendFile(path.resolve(__dirname, "../frontend/index.html")));

app.listen(PORT, () => console.log(`NIVARAN backend running on http://localhost:${PORT}`));
