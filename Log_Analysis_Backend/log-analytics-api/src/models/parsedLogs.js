const mongoose = require("mongoose");

const parsedLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    status_code: { type: Number, required: true },
    hour_sin: { type: Number, required: true },
    hour_cos: { type: Number, required: true },
    dow_sin: { type: Number, required: true },
    dow_cos: { type: Number, required: true },
    endpoint_enc: { type: Number, required: true },
    http_method_enc: { type: Number, required: true },
    geo_location_enc: { type: Number, required: true },
    req_resp_ratio: { type: Number, required: true },
    normalized_latency: { type: Number, required: true },
    log_request_size: { type: Number, required: true },
    log_response_size: { type: Number, required: true },
    log_response_time: { type: Number, required: true },
});

module.exports = mongoose.model("ParsedLog", parsedLogSchema);