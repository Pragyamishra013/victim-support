const express = require("express");
const router = express.Router();
const Ngo = require("../models/ngo");
const crypto = require("crypto");

router.post("/register", async (req, res) => {
    try {
        const { ngoName, email, password } = req.body;
        const existingNgo = await Ngo.findOne({ email });
        if (existingNgo) {
            return res.status(400).json({ success: false, message: "NGO already exists with this email" });
        }

        const slug = ngoName.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + crypto.randomBytes(3).toString("hex");
        const newNgo = new Ngo({ ngoName, email, password, slug });
        await newNgo.save();

        res.status(201).json({
            success: true,
            message: "NGO registered successfully!",
            ngoId: newNgo._id,
            ngoName: newNgo.ngoName,
            uniqueLink: `http://localhost:5004/victim.html?ngo=${slug}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const ngo = await Ngo.findOne({ email, password });
        if (!ngo) {
            return res.status(400).json({ success: false, message: "Invalid email or password" });
        }

        res.status(200).json({
            success: true,
            message: "Login successful",
            ngoId: ngo._id,
            ngoName: ngo.ngoName,
            uniqueLink: `http://localhost:5004/victim.html?ngo=${ngo.slug}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;