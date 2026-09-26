const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
    caseId: { type: String, required: true, unique: true },
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: "Ngo", required: true },
    victimDetails: {
        name: String,
        age: Number,
        gender: String,
        email: String,
        address: String
    },
    statement: String,
    source: { type: String, default: "text" },
    severity: { type: String, enum: ["Critical", "High", "Medium"], default: "Medium" },
    aiSummary: String,
    audio: {
        filename: String,
        originalName: String,
        size: Number
    },
    status: { type: String, default: "NEW" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Case", caseSchema);