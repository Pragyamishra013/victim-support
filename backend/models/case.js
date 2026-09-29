const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
    caseId: { type: String, required: true, unique: true, index: true },
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: "Ngo", required: true, index: true },
    victimDetails: {
        name: { type: String, default: "" },
        age: { type: Number, default: null },
        gender: { type: String, default: "" },
        phone: { type: String, default: "" },
        email: { type: String, default: "" },
        address: { type: String, default: "" }
    },
    statement: { type: String, default: "" },
    source: { type: String, default: "text" },
    severity: { type: String, enum: ["Critical", "High", "Medium", "Low"], default: "Medium" },
    priority: { type: String, enum: ["URGENT", "HIGH", "NORMAL", "LOW"], default: "NORMAL" },
    aiSummary: { type: String, default: "" },
    aiFlags: { type: [String], default: [] },
    audio: {
        filename: { type: String, default: "" },
        originalName: { type: String, default: "" },
        mimeType: { type: String, default: "" },
        size: { type: Number, default: 0 },
        uploadedAt: { type: Date }
    },
    status: { type: String, enum: ["NEW", "IN_REVIEW", "RESOLVED"], default: "NEW" },
    counsellor: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Case", caseSchema);
