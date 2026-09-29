const express = require("express");
const crypto = require("crypto");
const Ngo = require("../models/ngo");

const router = express.Router();

function makeSlug(name) {
    const base = String(name || "ngo")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "ngo";
    return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

function publicNgo(ngo) {
    return {
        id: String(ngo._id),
        name: ngo.ngoName,
        uniqueLink: `http://localhost:5004/victim.html?ngo=${ngo.slug}`
    };
}

router.post("/register", async (req, res) => {
    try {
        const name = String(req.body.ngoName || req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "NGO name, email and password are required." });
        }

        const exists = await Ngo.findOne({ email });
        if (exists) {
            return res.status(409).json({ success: false, message: "An NGO already exists with this email." });
        }

        const ngo = await Ngo.create({ ngoName: name, email, password, slug: makeSlug(name) });
        const info = publicNgo(ngo);

        res.status(201).json({
            success: true,
            message: "NGO registered successfully.",
            ngoId: info.id,
            ngoName: info.name,
            uniqueLink: info.uniqueLink,
            ngo: info
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Registration failed.", error: error.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const ngo = await Ngo.findOne({ email, password });

        if (!ngo) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        const info = publicNgo(ngo);
        res.json({
            success: true,
            message: "Login successful.",
            ngoId: info.id,
            ngoName: info.name,
            uniqueLink: info.uniqueLink,
            ngo: info
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Login failed.", error: error.message });
    }
});

router.get("/by-slug/:slug", async (req, res) => {
    try {
        const ngo = await Ngo.findOne({ slug: req.params.slug }).select("ngoName slug");
        if (!ngo) return res.status(404).json({ success: false, message: "This reporting link is not valid." });
        res.json({ success: true, ngo: { name: ngo.ngoName, slug: ngo.slug } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not validate reporting link." });
    }
});

module.exports = router;
