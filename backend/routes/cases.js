const express = require("express");
const multer = require("multer");
const router = express.Router();
const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

// Temporary storage
// Later, this will be replaced by the database.
const cases = [];


// ============================================================
// CREATE A NEW CASE
// POST /api/cases
// ============================================================

router.post("/", (req, res) => {

    const { reportText } = req.body;

    if (!reportText || reportText.trim() === "") {

        return res.status(400).json({
            success: false,
            message: "Report text is required"
        });

    }


    const caseId =
        `CASE-${Math.floor(1000 + Math.random() * 9000)}`;


    const newCase = {

        caseId: caseId,

        reportText: reportText.trim(),

        status: "NEW",

        assignedCounsellor: null,

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString()

    };


    cases.push(newCase);


    res.status(201).json({

        success: true,

        message: "Case created successfully",

        case: newCase

    });

});


// ============================================================
// GET ALL CASES
// GET /api/cases
// ============================================================

router.get("/", (req, res) => {

    res.json({

        success: true,

        cases: cases

    });

});


// ============================================================
// GET ONE CASE
// GET /api/cases/:caseId
// ============================================================

router.get("/:caseId", (req, res) => {

    const { caseId } = req.params;


    const foundCase = cases.find(
        (caseItem) =>
            caseItem.caseId === caseId
    );


    if (!foundCase) {

        return res.status(404).json({

            success: false,

            message: "Case not found"

        });

    }


    res.json({

        success: true,

        case: foundCase

    });

});


// ============================================================
// UPDATE A CASE
// PATCH /api/cases/:caseId
// ============================================================

router.patch("/:caseId", (req, res) => {

    const { caseId } = req.params;


    const foundCase = cases.find(
        (caseItem) =>
            caseItem.caseId === caseId
    );


    if (!foundCase) {

        return res.status(404).json({

            success: false,

            message: "Case not found"

        });

    }


    const {
        status,
        assignedCounsellor
    } = req.body;


    // Update status if provided
    if (status !== undefined) {

        const allowedStatuses = [
            "NEW",
            "IN_REVIEW",
            "RESOLVED"
        ];


        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid status. Allowed values: NEW, IN_REVIEW, RESOLVED"

            });

        }


        foundCase.status = status;

    }


    // Update counsellor if provided
    if (assignedCounsellor !== undefined) {

        foundCase.assignedCounsellor =
            assignedCounsellor;

    }


    // Update timestamp
    foundCase.updatedAt =
        new Date().toISOString();


    res.json({

        success: true,

        message: "Case updated successfully",

        case: foundCase

    });

});

// ============================================================
// AI ASSESSMENT PLACEHOLDER
// POST /api/cases/:caseId/assessment
// ============================================================

router.post("/:caseId/assessment", (req, res) => {

    const { caseId } = req.params;

    const foundCase = cases.find(
        (caseItem) =>
            caseItem.caseId === caseId
    );

    if (!foundCase) {

        return res.status(404).json({
            success: false,
            message: "Case not found"
        });

    }

    // Temporary placeholder.
    // Real AI processing will be connected later.

    const assessment = {
        status: "PENDING",
        message: "AI assessment has not been processed yet"
    };

    res.json({
        success: true,
        caseId: caseId,
        assessment: assessment
    });

});
// AUDIO UPLOAD
router.post("/:caseId/audio", upload.single("audio"), (req, res) => {
    const { caseId } = req.params;

    const foundCase = cases.find(
        (caseItem) => caseItem.caseId === caseId
    );

    if (!foundCase) {
        return res.status(404).json({
            success: false,
            message: "Case not found"
        });
    }

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "Audio file is required"
        });
    }

    res.status(201).json({
        success: true,
        message: "Audio received successfully",
        caseId: caseId,
        audio: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size
        }
    });
});

module.exports = router;