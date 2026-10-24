const express = require('express');
const router = express.Router();
const Case = require('../models/case');
const Ngo = require('../models/ngo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for Audio & Video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 }
});

// Helper Function: Call Gemini API for Dynamic AI Assessment
async function analyzeReportWithAI(statement) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    const textLower = (statement || "").toLowerCase();
    const isUrgentKeywords = textLower.includes("threat") || textLower.includes("death") || textLower.includes("follow") || textLower.includes("danger") || textLower.includes("kill") || textLower.includes("abuse") || textLower.includes("stalk") || textLower.includes("rape");

    let fallbackSeverity = isUrgentKeywords ? "High" : "Medium";
    let fallbackPriority = isUrgentKeywords ? "URGENT" : "NORMAL";
    let fallbackFlags = [];
    
    if (textLower.includes("threat") || textLower.includes("death") || textLower.includes("kill")) fallbackFlags.push("Life Threat / Immediate Risk");
    if (textLower.includes("follow") || textLower.includes("stalk")) fallbackFlags.push("Stalking & Harassment");

    if (fallbackFlags.length === 0) fallbackFlags.push("Standard Grievance");

    let fallbackSummary = `Victim reported: "${statement.slice(0, 150)}". Evaluated for priority intervention.`;

    if (!apiKey) {
        return { severity: fallbackSeverity, priority: fallbackPriority, aiSummary: fallbackSummary, aiFlags: fallbackFlags };
    }

    try {
        const prompt = `Analyze this victim grievance report and return a JSON object with:
- severity ("High", "Medium", "Low")
- priority ("URGENT", "HIGH", "NORMAL")
- aiSummary (a brief 2-sentence summary of the victim's situation)
- aiFlags (an array of 2-3 short flag strings highlighting key concerns)

Grievance Statement: "${statement}"

Return ONLY valid JSON format like:
{"severity": "High", "priority": "URGENT", "aiSummary": "...", "aiFlags": ["...", "..."]}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        return {
            severity: parsed.severity || fallbackSeverity,
            priority: parsed.priority || fallbackPriority,
            aiSummary: parsed.aiSummary || fallbackSummary,
            aiFlags: parsed.aiFlags || fallbackFlags
        };
    } catch (err) {
        console.error("Gemini AI API Call Error, using smart keyword fallback:", err);
        return { severity: fallbackSeverity, priority: fallbackPriority, aiSummary: fallbackSummary, aiFlags: fallbackFlags };
    }
}

// Submit Case Route (Supports Text, Audio, and Video with transcription)
router.post('/submit', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { ngoSlug, name, age, gender, phone, address, email, statement, source } = req.body;

        const ngo = await Ngo.findOne({ slug: ngoSlug });
        if (!ngo) {
            return res.status(404).json({ success: false, message: 'Organization not found.' });
        }

        const audioFile = req.files && req.files['audio'] ? req.files['audio'][0] : null;
        const videoFile = req.files && req.files['video'] ? req.files['video'][0] : null;

        const caseCount = await Case.countDocuments();
        const caseId = `NIVARAN-${String(caseCount + 101).padStart(4, '0')}`;

        const cleanStatement = statement ? statement.trim() : "";

        // Dynamic Gemini AI Analysis based on transcript/statement
        const aiAssessment = await analyzeReportWithAI(cleanStatement);

        const newCase = new Case({
            caseId,
            ngoId: ngo._id,
            victimDetails: {
                name: name || 'Anonymous',
                age: age || '',
                gender: gender || '',
                phone: phone || '',
                address: address || '',
                email: email || ''
            },
            statement: cleanStatement || (videoFile ? "Video report submitted." : audioFile ? "Audio recording submitted." : "Report submitted."),
            source: source || (videoFile ? 'video' : audioFile ? 'audio' : 'text'),
            audio: audioFile ? {
                filename: audioFile.filename,
                originalName: audioFile.originalname,
                path: audioFile.path,
                size: audioFile.size
            } : undefined,
            video: videoFile ? {
                filename: videoFile.filename,
                originalName: videoFile.originalname,
                path: videoFile.path,
                size: videoFile.size
            } : undefined,
            aiSummary: aiAssessment.aiSummary,
            severity: aiAssessment.severity,
            priority: aiAssessment.priority,
            aiFlags: aiAssessment.aiFlags,
            status: 'NEW'
        });

        await newCase.save();
        res.status(201).json({ success: true, caseId: newCase.caseId });

    } catch (error) {
        console.error("Case submission error:", error);
        res.status(500).json({ success: false, message: error.message || 'Server error during submission.' });
    }
});

// Get all cases for a specific NGO
router.get('/ngo/:ngoId', async (req, res) => {
    try {
        const cases = await Case.find({ ngoId: req.params.ngoId }).sort({ createdAt: -1 });
        res.json({ success: true, cases });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch cases.' });
    }
});

// Get single case details
router.get('/:caseId', async (req, res) => {
    try {
        const caseItem = await Case.findOne({ caseId: req.params.caseId });
        if (!caseItem) {
            return res.status(404).json({ success: false, message: 'Case not found.' });
        }
        res.json({ success: true, case: caseItem });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Could not fetch case details.' });
    }
});

// Stream Audio Route with HTTP Range Request Support
router.get('/:caseId/audio', async (req, res) => {
    try {
        const caseItem = await Case.findOne({ caseId: req.params.caseId });
        if (!caseItem || !caseItem.audio || !caseItem.audio.path) {
            return res.status(404).json({ success: false, message: 'Audio file not found.' });
        }

        const absolutePath = path.resolve(caseItem.audio.path);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'Audio file missing from server storage.' });
        }

        const stat = fs.statSync(absolutePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(absolutePath, { start, end });
            
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'audio/webm',
            };

            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'audio/webm',
            };
            res.writeHead(200, head);
            fs.createReadStream(absolutePath).pipe(res);
        }
    } catch (error) {
        console.error("Audio streaming error:", error);
        res.status(500).json({ success: false, message: 'Error streaming audio.' });
    }
});

// Stream Video Route with HTTP Range Request Support for HTML5 video player
router.get('/:caseId/video', async (req, res) => {
    try {
        const caseItem = await Case.findOne({ caseId: req.params.caseId });
        if (!caseItem || !caseItem.video || !caseItem.video.path) {
            return res.status(404).json({ success: false, message: 'Video file not found.' });
        }
        
        const absolutePath = path.resolve(caseItem.video.path);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ success: false, message: 'Video file missing from server storage.' });
        }

        const stat = fs.statSync(absolutePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        // Support HTTP Range Requests (Essential for WebM / MP4 video seeking and duration decoding)
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(absolutePath, { start, end });
            
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/webm',
            };

            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/webm',
            };
            res.writeHead(200, head);
            fs.createReadStream(absolutePath).pipe(res);
        }
    } catch (error) {
        console.error("Video streaming error:", error);
        res.status(500).json({ success: false, message: 'Error streaming video.' });
    }
});

// Update Case Status / Counsellor
router.patch('/:caseId', async (req, res) => {
    try {
        const { status, counsellor } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (counsellor !== undefined) updateData.counsellor = counsellor;

        const updatedCase = await Case.findOneAndUpdate(
            { caseId: req.params.caseId },
            { $set: updateData },
            { new: true }
        );

        if (!updatedCase) {
            return res.status(404).json({ success: false, message: 'Case not found.' });
        }

        res.json({ success: true, case: updatedCase });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update case.' });
    }
});

// Groq Speech-to-Text Transcription Route (Supports both Audio and Video files)
router.post('/transcribe', upload.single('file'), async (req, res) => {
    try {
        const uploadedFile = req.file || (req.files && req.files['audio'] ? req.files['audio'][0] : null) || (req.files && req.files['video'] ? req.files['video'][0] : null);
        
        if (!uploadedFile) {
            return res.status(400).json({ success: false, message: 'No audio or video file provided for transcription.' });
        }

        const fileBuffer = fs.readFileSync(uploadedFile.path);
        const blob = new Blob([fileBuffer], { type: uploadedFile.mimetype || 'audio/webm' });
        
        const formData = new FormData();
        formData.append('file', blob, uploadedFile.originalname);
        formData.append('model', 'whisper-large-v3');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Groq transcription failed');
        }

        res.json({ success: true, transcript: data.text });
    } catch (error) {
        console.error("Transcription error:", error);
        res.status(500).json({ success: false, message: error.message || 'Transcription failed.' });
    }
});

module.exports = router;