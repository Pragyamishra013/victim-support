const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const os = require("os");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const Case = require("../models/case");
const Ngo = require("../models/ngo");
const authenticateNgo = require("../middleware/auth");

const router = express.Router();
const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const diskUpload = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "") || ".webm";
        const safeExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, "") || ".webm";
        cb(null, `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${safeExt}`);
    }
});

const upload = multer({
    storage: diskUpload,
    limits: { fileSize: 25 * 1024 * 1024 }
});

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});

function fallbackAssessment(statement) {
    const text = String(statement || "").toLowerCase();
    const flags = [];

    const critical = [
        "kill", "killed", "murder", "suicide", "self harm", "self-harm",
        "emergency", "life threat", "life-threatening", "attack", "beaten",
        "being beaten", "going to die", "danger"
    ];
    const high = [
        "threat", "threatened", "abuse", "abused", "harass", "harassment",
        "stalk", "stalking", "violence", "violent", "blackmail", "coercion"
    ];

    if (critical.some(word => text.includes(word))) {
        flags.push("Possible immediate safety risk");
        return {
            severity: "Critical",
            priority: "URGENT",
            flags,
            summary: "The report contains language that may indicate an immediate safety risk. Human review is recommended."
        };
    }

    if (high.some(word => text.includes(word))) {
        flags.push("Possible ongoing harm or threat");
        return {
            severity: "High",
            priority: "HIGH",
            flags,
            summary: "The report contains language about possible harassment, abuse, threat, violence, or related harm. Human review is recommended."
        };
    }

    return {
        severity: "Medium",
        priority: "NORMAL",
        flags: [],
        summary: "A support request or grievance was received. Human review is recommended."
    };
}

function normalizeAssessment(value, statement) {
    const fallback = fallbackAssessment(statement);
    const severity = ["Critical", "High", "Medium", "Low"].includes(String(value?.severity))
        ? String(value.severity)
        : fallback.severity;
    const priorityMap = {
        Critical: "URGENT",
        High: "HIGH",
        Medium: "NORMAL",
        Low: "LOW"
    };
    const priority = ["URGENT", "HIGH", "NORMAL", "LOW"].includes(String(value?.priority))
        ? String(value.priority)
        : priorityMap[severity] || fallback.priority;
    const flags = Array.isArray(value?.flags)
        ? value.flags.map(item => String(item).trim()).filter(Boolean).slice(0, 8)
        : fallback.flags;
    const summary = String(value?.summary || "").trim() || fallback.summary;

    return { severity, priority, flags, summary };
}

async function assessWithGemini(statement) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
        return null;
    }

    const prompt = `You are an AI assessment assistant for a victim-support reporting portal.
Assess ONLY the submitted report below. Do not diagnose a medical or psychiatric condition.
Do not invent events, injuries, perpetrators, motives, or legal conclusions.
Return a workflow aid for a human NGO reviewer.

Severity definitions:
- Critical: immediate danger, severe violence, suicide/self-harm, or clearly urgent safety concern.
- High: serious ongoing harm, threats, abuse, violence, coercion, stalking, blackmail, or serious safety concern.
- Medium: meaningful support/grievance request without a clear immediate/high-risk indicator.
- Low: routine/low-urgency support request without a clear safety concern.

Priority must correspond to severity: Critical=URGENT, High=HIGH, Medium=NORMAL, Low=LOW.
Flags should be concise indicators grounded in the report. Use an empty array when no clear flag is present.

REPORT:\n${String(statement || "").slice(0, 12000)}`;

    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            severity: { type: "STRING", enum: ["Critical", "High", "Medium", "Low"] },
                            priority: { type: "STRING", enum: ["URGENT", "HIGH", "NORMAL", "LOW"] },
                            flags: { type: "ARRAY", items: { type: "STRING" } },
                            summary: { type: "STRING" }
                        },
                        required: ["severity", "priority", "flags", "summary"]
                    }
                }
            })
        }
    );

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }

    if (!response.ok) {
        throw new Error(data?.error?.message || "Gemini assessment request failed.");
    }

    const text = data?.candidates?.[0]?.content?.parts
        ?.map(part => part?.text || "")
        .join("")
        .trim();

    if (!text) throw new Error("Gemini returned an empty assessment.");

    return normalizeAssessment(JSON.parse(text), statement);
}

async function assessCase(statement) {
    try {
        const ai = await assessWithGemini(statement);
        if (ai) return { ...ai, provider: "Gemini" };
    } catch (error) {
        console.error("Gemini assessment unavailable; using safe fallback:", error.message);
    }

    return { ...fallbackAssessment(statement), provider: "Fallback" };
}

function makeCaseId() {
    return `CASE-${Date.now().toString().slice(-8)}-${Math.floor(10 + Math.random() * 90)}`;
}

function safeExtension(originalName, mimeType) {
    const ext = path.extname(originalName || "").toLowerCase().replace(/[^a-z0-9.]/g, "");
    if (ext) return ext;
    const map = {
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/aac": ".aac"
    };
    return map[mimeType] || ".audio";
}

async function groqTranscribe(buffer, mimeType, originalName) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "PASTE_YOUR_GROQ_API_KEY_HERE") {
        const error = new Error("Speech-to-text is not configured. Add GROQ_API_KEY to backend/.env and restart the server.");
        error.code = "GROQ_NOT_CONFIGURED";
        throw error;
    }

    if (!buffer?.length) {
        const error = new Error("The audio file is empty.");
        error.code = "EMPTY_AUDIO";
        throw error;
    }

    const form = new FormData();
    form.append(
        "file",
        new Blob([buffer], { type: mimeType || "audio/webm" }),
        originalName || `voice-report-${Date.now()}${safeExtension(originalName, mimeType)}`
    );
    form.append("model", "whisper-large-v3");
    form.append("response_format", "json");
    form.append("language", "en");
    form.append("temperature", "0");

    let response;
    try {
        response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form
        });
    } catch (networkError) {
        const error = new Error(`Could not connect to Groq speech-to-text service: ${networkError.message}`);
        error.code = "GROQ_NETWORK_ERROR";
        throw error;
    }

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }

    if (!response.ok) {
        const error = new Error(data?.error?.message || data?.message || "Groq speech-to-text request failed.");
        error.code = "GROQ_API_ERROR";
        error.status = response.status;
        throw error;
    }

    const transcript = String(data?.text || "").trim();
    if (!transcript) {
        const error = new Error("No speech could be detected in this audio recording.");
        error.code = "EMPTY_TRANSCRIPT";
        throw error;
    }

    return transcript;
}

// Extract audio from an uploaded video using FFmpeg.
async function extractAudioFromVideo(videoBuffer, mimeType) {
    if (!videoBuffer?.length) {
        throw Object.assign(new Error("The uploaded video is empty."), { code: "EMPTY_VIDEO" });
    }

    if (!ffmpegPath) {
        throw Object.assign(new Error("FFmpeg binary is unavailable."), { code: "FFMPEG_NOT_AVAILABLE" });
    }

    const cleanMimeType = String(mimeType || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

    const videoExtensions = {
        "video/webm": ".webm",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/x-matroska": ".mkv",
        "video/ogg": ".ogv"
    };

    if (!cleanMimeType.startsWith("video/")) {
        throw Object.assign(new Error("Please upload a valid video file."), { code: "INVALID_VIDEO_TYPE" });
    }

    const extension = videoExtensions[cleanMimeType] || ".video";
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "nivaran-video-"));
    const inputPath = path.join(tempDir, `input${extension}`);
    const outputPath = path.join(tempDir, "extracted-audio.mp3");

    try {
        await fs.promises.writeFile(inputPath, videoBuffer);

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn(ffmpegPath, [
                "-nostdin", "-hide_banner", "-loglevel", "error",
                "-i", inputPath,
                "-vn", "-ac", "1", "-ar", "16000",
                "-c:a", "libmp3lame", "-b:a", "64k",
                "-y", outputPath
            ], { windowsHide: true });

            let stderr = "";
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                ffmpeg.kill();
                reject(new Error("Video audio extraction timed out. Please try a shorter video."));
            }, 120000);

            ffmpeg.stderr.on("data", chunk => {
                stderr = (stderr + chunk.toString()).slice(-10000);
            });

            ffmpeg.on("error", error => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                reject(error);
            });

            ffmpeg.on("close", code => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (code === 0) resolve();
                else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}.`));
            });
        });

        const audioStats = await fs.promises.stat(outputPath);
        if (!audioStats.size) throw new Error("No audio track was found in this video.");
        if (audioStats.size > 25 * 1024 * 1024) {
            throw Object.assign(
                new Error("The extracted audio is too large. Please upload a shorter video."),
                { code: "AUDIO_TOO_LARGE" }
            );
        }

        return await fs.promises.readFile(outputPath);
    } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}

router.post("/transcribe", memoryUpload.single("audio"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Please provide an audio recording to transcribe." });
        const transcript = await groqTranscribe(req.file.buffer, req.file.mimetype, req.file.originalname);
        res.json({ success: true, transcript, message: "Audio transcribed successfully." });
    } catch (error) {
        console.error("Speech-to-text error:", error);
        if (error.code === "GROQ_NOT_CONFIGURED") return res.status(503).json({ success: false, message: error.message });
        if (error.code === "EMPTY_TRANSCRIPT") return res.status(422).json({ success: false, message: error.message });
        res.status(500).json({ success: false, message: "Could not transcribe the audio. Please try again or use the written report option.", error: error.message });
    }
});

// Transcribe speech contained in an uploaded or recorded video.
router.post("/transcribe-video", memoryUpload.single("video"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please provide a video recording to transcribe."
            });
        }

        const audioBuffer = await extractAudioFromVideo(req.file.buffer, req.file.mimetype);
        const transcript = await groqTranscribe(audioBuffer, "audio/mpeg", "video-audio.mp3");

        return res.json({
            success: true,
            transcript,
            message: "Video audio transcribed successfully."
        });
    } catch (error) {
        console.error("Video transcription error:", error);

        if (error.code === "GROQ_NOT_CONFIGURED") {
            return res.status(503).json({ success: false, message: error.message });
        }
        if (["EMPTY_TRANSCRIPT", "EMPTY_VIDEO"].includes(error.code)) {
            return res.status(422).json({ success: false, message: error.message });
        }
        if (error.code === "AUDIO_TOO_LARGE") {
            return res.status(413).json({ success: false, message: error.message });
        }
        if (["INVALID_VIDEO_TYPE", "FFMPEG_NOT_AVAILABLE"].includes(error.code)) {
            return res.status(400).json({ success: false, message: error.message });
        }

        return res.status(500).json({
            success: false,
            message: "Could not transcribe the video. Please try another video or use the written report option.",
            error: error.message
        });
    }
});

async function createCaseFromSubmission(req) {
    const { ngoSlug, name, age, gender, phone, email, address, statement, source } = req.body || {};
    if (!ngoSlug) throw Object.assign(new Error("NGO reporting link is missing."), { status: 400 });

    const ngo = await Ngo.findOne({ slug: ngoSlug });
    if (!ngo) throw Object.assign(new Error("Associated NGO was not found."), { status: 404 });

    const audioFile = req.files?.audio?.[0] || null;
    const videoFile = req.files?.video?.[0] || null;
    const cleanStatement = String(statement || "").trim();
    if (!cleanStatement && !audioFile && !videoFile) throw Object.assign(new Error("Please provide a written report, audio recording, or video recording."), { status: 400 });

    const assessment = await assessCase(cleanStatement);
    const audio = audioFile ? { filename: audioFile.filename, originalName: audioFile.originalname, mimeType: audioFile.mimetype, size: audioFile.size, uploadedAt: new Date() } : undefined;
    const video = videoFile ? { filename: videoFile.filename, originalName: videoFile.originalname, mimeType: videoFile.mimetype, size: videoFile.size, uploadedAt: new Date() } : undefined;

    return Case.create({
        caseId: makeCaseId(),
        ngoId: ngo._id,
        victimDetails: {
            name: String(name || "").trim(),
            age: age ? Number(age) : null,
            gender: String(gender || "").trim(),
            phone: String(phone || "").trim(),
            email: String(email || "").trim(),
            address: String(address || "").trim()
        },
        statement: cleanStatement,
        source: source || (audioFile ? "voice" : videoFile ? "video" : "text"),
        severity: assessment.severity,
        priority: assessment.priority,
        aiSummary: assessment.summary,
        aiFlags: assessment.flags,
        audio,
        video,
        status: "NEW"
    });
}

router.post("/submit", upload.fields([{ name: "audio", maxCount: 1 }, { name: "video", maxCount: 1 }]), async (req, res) => {
    try {
        const created = await createCaseFromSubmission(req);
        res.status(201).json({ success: true, message: "Case submitted successfully.", caseId: created.caseId, case: created });
    } catch (error) {
        console.error("Case submission error:", error);
        res.status(error.status || 500).json({ success: false, message: error.message || "Could not submit the case.", error: error.message });
    }
});

// Backward-compatible JSON create endpoint used by the older victim script.
router.post("/", async (req, res) => {
    try {
        const statement = String(req.body?.statement || "").trim();
        const hasVoice = req.body?.source === "voice" || req.body?.source === "text_and_voice";
        if (!statement && !hasVoice) return res.status(400).json({ success: false, message: "Report statement is required." });

        const assessment = await assessCase(statement);
        const created = await Case.create({
            caseId: makeCaseId(),
            ngoId: req.body?.ngoId || undefined,
            statement,
            source: req.body?.source || "text",
            severity: assessment.severity,
            priority: assessment.priority,
            aiSummary: assessment.summary,
            aiFlags: assessment.flags,
            status: "NEW"
        });
        res.status(201).json({ success: true, message: "Case created successfully.", case: created });
    } catch (error) {
        console.error("Legacy case creation error:", error);
        res.status(500).json({ success: false, message: error.message || "Could not create case." });
    }
});

router.get("/ngo/:ngoId", authenticateNgo, async (req, res) => {
    try {
        if (String(req.ngoId) !== String(req.params.ngoId)) return res.status(403).json({ success: false, message: "Access denied." });
        const cases = await Case.find({ ngoId: req.ngoId }).sort({ createdAt: -1 });
        res.json({ success: true, cases });
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not load cases.", error: error.message });
    }
});

router.get("/", async (_req, res) => {
    try {
        const cases = await Case.find().sort({ createdAt: -1 });
        res.json({ success: true, cases });
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not load cases.", error: error.message });
    }
});

router.get("/:caseId/audio", authenticateNgo, async (req, res) => {
    try {
        const item = await Case.findOne({ caseId: req.params.caseId, ngoId: req.ngoId });
        if (!item?.audio?.filename) return res.status(404).json({ success: false, message: "Audio not found." });
        const filePath = path.join(uploadsDir, item.audio.filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: "Audio file is missing." });
        res.type(item.audio.mimeType || "audio/webm");
        res.setHeader("Content-Disposition", `inline; filename="${String(item.audio.originalName || item.audio.filename).replace(/"/g, "")}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not play audio." });
    }
});

router.get("/:caseId/video", authenticateNgo, async (req, res) => {
    try {
        const item = await Case.findOne({ caseId: req.params.caseId, ngoId: req.ngoId });
        if (!item?.video?.filename) return res.status(404).json({ success: false, message: "Video not found." });
        const filePath = path.join(uploadsDir, item.video.filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: "Video file is missing." });
        res.type(item.video.mimeType || "video/webm");
        res.setHeader("Content-Disposition", `inline; filename="${String(item.video.originalName || item.video.filename).replace(/\"/g, "")}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not play video." });
    }
});

// Backward-compatible separate audio upload endpoint.
router.post("/:caseId/audio", upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Please provide an audio file." });
        const item = await Case.findOne({ caseId: req.params.caseId, ngoId: req.ngoId });
        if (!item) return res.status(404).json({ success: false, message: "Case not found." });
        item.audio = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date()
        };
        await item.save();
        res.json({ success: true, message: "Audio uploaded successfully.", case: item });
    } catch (error) {
        res.status(500).json({ success: false, message: "Audio upload failed.", error: error.message });
    }
});

router.get("/:caseId", authenticateNgo, async (req, res) => {
    try {
        const item = await Case.findOne({ caseId: req.params.caseId, ngoId: req.ngoId });
        if (!item) return res.status(404).json({ success: false, message: "Case not found." });
        res.json({ success: true, case: item });
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not load case." });
    }
});

router.patch("/:caseId", authenticateNgo, async (req, res) => {
    try {
        const updates = {};
        if (req.body.status !== undefined) updates.status = req.body.status;
        if (req.body.counsellor !== undefined) updates.counsellor = req.body.counsellor;
        const item = await Case.findOneAndUpdate({ caseId: req.params.caseId, ngoId: req.ngoId }, { $set: updates }, { new: true });
        if (!item) return res.status(404).json({ success: false, message: "Case not found." });
        res.json({ success: true, message: "Case updated successfully.", case: item });
    } catch (error) {
        res.status(500).json({ success: false, message: "Could not update case.", error: error.message });
    }
});

module.exports = router;
