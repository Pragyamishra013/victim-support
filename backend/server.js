const express = require("express");
const cors = require("cors");
require("dotenv").config();
const casesRoutes = require("./routes/cases");
const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/cases", casesRoutes);
// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "NIVARAN backend is running"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`NIVARAN backend running on http://localhost:${PORT}`);
});