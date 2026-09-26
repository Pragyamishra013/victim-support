const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
    caseId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    statement: { 
        type: String, 
        default: "" 
    },
    source: { 
        type: String, 
        default: "text" 
    },
    language: { 
        type: String, 
        default: "English" 
    },
    status: { 
        type: String, 
        default: "NEW" 
    },
    counsellor: { 
        type: String, 
        default: null 
    },
    assessment: { 
        type: Object, 
        default: null 
    },
    audio: {
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        uploadedAt: String
    },
    createdAt: { 
        type: String 
    }
});

module.exports = mongoose.model("Case", caseSchema);