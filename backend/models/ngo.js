const mongoose = require("mongoose");

const ngoSchema = new mongoose.Schema({
    ngoName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true }
}, { timestamps: true });

module.exports = mongoose.model("Ngo", ngoSchema);