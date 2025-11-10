const mongoose = require("mongoose");

const thresholdSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // e.g. "error_threshold"
    value: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Threshold", thresholdSchema);