const express = require("express");
const router = express.Router();
const Case = require("../models/case");
const Ngo = require("../models/ngo");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// Smart AI Analysis Logic
function analyzeCaseWithAI(statement) {
    const text = (statement || "").toLowerCase();
    if (text.includes("kill") || text.includes("emergency") || text.includes("danger") || text.includes("beat") || text.includes("attack")) {
        return { severity: "Critical", summary: "CRITICAL: Immediate physical threat or severe emergency reported requiring urgent intervention." };
    } else if (text.includes("harass") || text.includes("abuse") || text.includes("threat") || text.includes("stalk")) {
        return { severity: "High", summary: "HIGH: Active harassment, abuse, or serious threat reported by victim." };
    }
    return { severity: "Medium", summary: "MEDIUM: General grievance, complaint, or request for support received." };
}

router.post("/submit", upload.single("audio"), async (req, res) => {
    try {
        const { ngoSlug, name, age, gender, email, address, statement, source } = req.body;
        const ngo = await Ngo.findOne({ slug: ngoSlug });
        if (!ngo) {
            return res.status(404).json({ success: false, message: "Associated NGO not found via link." });
        }

        const caseId = "CASE-" + Math.floor(1000 + Math.random() * 9000);
        const aiResult = analyzeCaseWithAI(statement);

        let audioData = undefined;
        if (req.file) {
            audioData = {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size
            };
        }

        const newCase = new Case({
            caseId,
            ngoId: ngo._id,
            victimDetails: { name, age: Number(age), gender, email, address },
            statement: statement || "",
            source: source || "text",
            severity: aiResult.severity,
            aiSummary: aiResult.summary,
            audio: audioData,
            status: "NEW"
        });

        await newCase.save();
        res.status(201).json({ success: true, message: "Case submitted successfully!", caseId: newCase.caseId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get("/ngo/:ngoId", async (req, res) => {
    try {
        const cases = await Case.find({ ngoId: req.params.ngoId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, cases });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;