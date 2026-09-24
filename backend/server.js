const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const casesRoutes = require("./routes/cases");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve uploaded audio files
app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

// Case API
app.use("/api/cases", casesRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "NIVARAN backend is running"
    });
});

app.listen(PORT, () => {
    console.log(
        `NIVARAN backend running on http://localhost:${PORT}`
    );
});