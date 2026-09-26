const mongoose = require("mongoose");

const ngoSchema = new mongoose.Schema({
    ngoName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ngo", ngoSchema);