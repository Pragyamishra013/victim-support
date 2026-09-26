const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Case = require("../models/Case");

const router = express.Router();

// ============================================================
// UPLOAD DIRECTORY
// ============================================================

const uploadDirectory = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {
        const extension =
            path.extname(file.originalname) || ".webm";

        const safeExtension = extension
            .toLowerCase()
            .replace(/[^a-z0-9.]/g, "");

        const filename =
            `voice-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 10)}${safeExtension}`;

        cb(null, filename);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 25 * 1024 * 1024
    }
});

// ============================================================
// UNIQUE CASE ID GENERATOR (MongoDB checking)
// ============================================================

async function generateCaseId() {
    let id;
    let exists = true;

    while (exists) {
        id = `CASE-${Math.floor(
            1000 + Math.random() * 9000
        )}`;
        const found = await Case.findOne({ caseId: id });
        if (!found) {
            exists = false;
        }
    }
    return id;
}

// ============================================================
// CREATE CASE
// ============================================================

router.post("/", async (req, res) => {
    try {
        const {
            statement = "",
            source = "text",
            language = "English"
        } = req.body || {};

        const cleanStatement = String(statement).trim();

        if (
            !cleanStatement &&
            source !== "voice"
        ) {
            return res.status(400).json({
                success: false,
                message: "Report statement is required."
            });
        }

        const newCaseId = await generateCaseId();

        const newCase = new Case({
            caseId: newCaseId,
            statement: cleanStatement,
            source,
            language,
            status: "NEW",
            counsellor: null,
            assessment: null,
            audio: null,
            createdAt: new Date().toISOString()
        });

        await newCase.save();

        console.log(`Case created in DB: ${newCase.caseId}`);

        res.status(201).json({
            success: true,
            message: "Case created successfully.",
            case: newCase
        });
    } catch (error) {
        console.error("Error creating case:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ============================================================
// GET ALL CASES
// ============================================================

router.get("/", async (req, res) => {
    try {
        const cases = await Case.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            cases
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ============================================================
// GET ONE CASE
// ============================================================

router.get("/:caseId", async (req, res) => {
    try {
        const foundCase = await Case.findOne({ caseId: req.params.caseId });

        if (!foundCase) {
            return res.status(404).json({
                success: false,
                message: "Case not found."
            });
        }

        res.json({
            success: true,
            case: foundCase
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ============================================================
// UPDATE CASE
// ============================================================

router.patch("/:caseId", async (req, res) => {
    try {
        const foundCase = await Case.findOne({ caseId: req.params.caseId });

        if (!foundCase) {
            return res.status(404).json({
                success: false,
                message: "Case not found."
            });
        }

        if (req.body.status !== undefined) {
            foundCase.status = req.body.status;
        }

        if (req.body.counsellor !== undefined) {
            foundCase.counsellor = req.body.counsellor;
        }

        await foundCase.save();

        res.json({
            success: true,
            message: "Case updated successfully.",
            case: foundCase
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ============================================================
// AI ASSESSMENT PLACEHOLDER
// ============================================================

router.post("/:caseId/assessment", async (req, res) => {
    try {
        const foundCase = await Case.findOne({ caseId: req.params.caseId });

        if (!foundCase) {
            return res.status(404).json({
                success: false,
                message: "Case not found."
            });
        }

        foundCase.assessment = {
            status: "PENDING_AI_INTEGRATION",
            message: "AI assessment endpoint is ready for model integration.",
            updatedAt: new Date().toISOString()
        };

        await foundCase.save();

        res.json({
            success: true,
            assessment: foundCase.assessment
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// ============================================================
// UPLOAD AUDIO
// ============================================================

router.post(
    "/:caseId/audio",
    upload.single("audio"),
    async (req, res) => {
        try {
            const foundCase = await Case.findOne({ caseId: req.params.caseId });

            if (!foundCase) {
                if (req.file) {
                    fs.unlink(req.file.path, () => {});
                }

                return res.status(404).json({
                    success: false,
                    message: "Case not found."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Audio file is required."
                });
            }

            foundCase.audio = {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                uploadedAt: new Date().toISOString()
            };

            await foundCase.save();

            console.log(
                `Audio uploaded for ${foundCase.caseId}: ${req.file.filename}`
            );

            res.status(201).json({
                success: true,
                message: "Audio uploaded successfully.",
                audio: foundCase.audio
            });
        } catch (error) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
);

// ============================================================
// PLAY / STREAM AUDIO
// ============================================================

router.get("/:caseId/audio", async (req, res) => {
    try {
        const foundCase = await Case.findOne({ caseId: req.params.caseId });

        if (!foundCase) {
            return res.status(404).json({
                success: false,
                message: "Case not found."
            });
        }

        if (
            !foundCase.audio ||
            !foundCase.audio.filename
        ) {
            return res.status(404).json({
                success: false,
                message: "No audio recording found for this case."
            });
        }

        const audioPath = path.join(
            uploadDirectory,
            foundCase.audio.filename
        );

        if (!fs.existsSync(audioPath)) {
            return res.status(404).json({
                success: false,
                message: "Audio file is missing from server."
            });
        }

        res.sendFile(audioPath);
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = router;