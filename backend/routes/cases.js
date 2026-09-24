const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

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
// TEMPORARY CASE STORAGE
// ============================================================

const cases = [];

// ============================================================
// CASE ID
// ============================================================

function generateCaseId() {
    let id;

    do {
        id = `CASE-${Math.floor(
            1000 + Math.random() * 9000
        )}`;
    } while (
        cases.some(caseItem => caseItem.caseId === id)
    );

    return id;
}

// ============================================================
// CREATE CASE
// ============================================================

router.post("/", (req, res) => {
    const {
        statement = "",
        source = "text",
        language = "English"
    } = req.body || {};

    const cleanStatement =
        String(statement).trim();

    // A voice-only report is allowed.
    if (
        !cleanStatement &&
        source !== "voice"
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Report statement is required."
        });
    }

    const newCase = {
        caseId: generateCaseId(),

        statement: cleanStatement,

        source,

        language,

        status: "NEW",

        counsellor: null,

        assessment: null,

        audio: null,

        createdAt:
            new Date().toISOString()
    };

    cases.push(newCase);

    console.log(
        `Case created: ${newCase.caseId}`
    );

    res.status(201).json({
        success: true,

        message:
            "Case created successfully.",

        case: newCase
    });
});

// ============================================================
// GET ALL CASES
// ============================================================

router.get("/", (req, res) => {
    res.json({
        success: true,
        cases
    });
});

// ============================================================
// GET ONE CASE
// ============================================================

router.get("/:caseId", (req, res) => {
    const foundCase =
        cases.find(
            caseItem =>
                caseItem.caseId ===
                req.params.caseId
        );

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
});

// ============================================================
// UPDATE CASE
// ============================================================

router.patch("/:caseId", (req, res) => {
    const foundCase =
        cases.find(
            caseItem =>
                caseItem.caseId ===
                req.params.caseId
        );

    if (!foundCase) {
        return res.status(404).json({
            success: false,
            message: "Case not found."
        });
    }

    if (
        req.body.status !== undefined
    ) {
        foundCase.status =
            req.body.status;
    }

    if (
        req.body.counsellor !== undefined
    ) {
        foundCase.counsellor =
            req.body.counsellor;
    }

    res.json({
        success: true,

        message:
            "Case updated successfully.",

        case: foundCase
    });
});

// ============================================================
// AI ASSESSMENT PLACEHOLDER
// ============================================================

router.post(
    "/:caseId/assessment",
    (req, res) => {

        const foundCase =
            cases.find(
                caseItem =>
                    caseItem.caseId ===
                    req.params.caseId
            );

        if (!foundCase) {
            return res.status(404).json({
                success: false,
                message:
                    "Case not found."
            });
        }

        foundCase.assessment = {
            status:
                "PENDING_AI_INTEGRATION",

            message:
                "AI assessment endpoint is ready for model integration.",

            updatedAt:
                new Date().toISOString()
        };

        res.json({
            success: true,

            assessment:
                foundCase.assessment
        });
    }
);

// ============================================================
// UPLOAD AUDIO
// ============================================================

router.post(
    "/:caseId/audio",
    upload.single("audio"),
    (req, res) => {

        const foundCase =
            cases.find(
                caseItem =>
                    caseItem.caseId ===
                    req.params.caseId
            );

        if (!foundCase) {

            if (req.file) {
                fs.unlink(
                    req.file.path,
                    () => {}
                );
            }

            return res.status(404).json({
                success: false,
                message:
                    "Case not found."
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message:
                    "Audio file is required."
            });
        }

        foundCase.audio = {
            filename:
                req.file.filename,

            originalName:
                req.file.originalname,

            mimeType:
                req.file.mimetype,

            size:
                req.file.size,

            uploadedAt:
                new Date().toISOString()
        };

        console.log(
            `Audio uploaded for ${foundCase.caseId}: ${req.file.filename}`
        );

        res.status(201).json({
            success: true,

            message:
                "Audio uploaded successfully.",

            audio:
                foundCase.audio
        });
    }
);

// ============================================================
// PLAY / STREAM AUDIO
// ============================================================

router.get(
    "/:caseId/audio",
    (req, res) => {

        const foundCase =
            cases.find(
                caseItem =>
                    caseItem.caseId ===
                    req.params.caseId
            );

        if (!foundCase) {
            return res.status(404).json({
                success: false,
                message:
                    "Case not found."
            });
        }

        if (
            !foundCase.audio ||
            !foundCase.audio.filename
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "No audio recording found for this case."
            });
        }

        const audioPath =
            path.join(
                uploadDirectory,
                foundCase.audio.filename
            );

        if (!fs.existsSync(audioPath)) {
            return res.status(404).json({
                success: false,
                message:
                    "Audio file is missing from server."
            });
        }

        res.sendFile(audioPath);
    }
);

module.exports = router;