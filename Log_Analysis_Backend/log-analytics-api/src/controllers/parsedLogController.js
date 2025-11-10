const ParsedLog = require("../models/parsedLogs");
const Threshold = require("../models/Threshold"); // added
const { isSqlInjection } = require("../utils/sqlInjection");

// Create new parsed log
exports.createParsedLog = async (req, res) => {
    try {
        const parsedLog = await ParsedLog.create(req.body);
        res.status(201).json({ success: true, data: parsedLog });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get all parsed logs
exports.getParsedLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;

        const parsedLogs = await ParsedLog.find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await ParsedLog.countDocuments();

        res.status(200).json({
            success: true,
            count: parsedLogs.length,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page,
            data: parsedLogs,
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get parsed logs statistics
exports.getParsedLogStats = async (req, res) => {
    try {
        const stats = await ParsedLog.aggregate([
            {
                $group: {
                    _id: null,
                    avgLatency: { $avg: "$normalized_latency" },
                    avgReqRespRatio: { $avg: "$req_resp_ratio" },
                    avgResponseTime: { $avg: "$log_response_time" },
                    totalRequests: { $sum: 1 },
                    successRate: {
                        $avg: { $cond: [{ $lt: ["$status_code", 400] }, 1, 0] },
                    },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: stats[0] || {
                avgLatency: 0,
                avgReqRespRatio: 0,
                avgResponseTime: 0,
                totalRequests: 0,
                successRate: 0,
            },
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get parsed logs by time range
exports.getParsedLogsByTimeRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const parsedLogs = await ParsedLog.find({
            timestamp: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
        }).sort({ timestamp: -1 });

        res.status(200).json({
            success: true,
            count: parsedLogs.length,
            data: parsedLogs,
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// New: fetch parsed logs for last N minutes based on clock time (ignore date)
exports.getParsedLogsLastHour = async (req, res) => {
    try {
        const now = new Date();
        const currentMinutesUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
        const windowMinutes = parseInt(req.query.window, 10) || 60; // default 60

        const agg = await ParsedLog.aggregate([
            {
                $addFields: {
                    parsedTimestamp: {
                        $cond: [
                            { $eq: [{ $type: "$timestamp" }, "string"] },
                            {
                                $dateFromString: {
                                    dateString: "$timestamp",
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            "$timestamp",
                        ],
                    },
                },
            },
            { $match: { parsedTimestamp: { $type: "date" } } },
            {
                $addFields: {
                    logMinutesUTC: {
                        $add: [
                            {
                                $multiply: [
                                    { $hour: { date: "$parsedTimestamp", timezone: "UTC" } },
                                    60,
                                ],
                            },
                            { $minute: { date: "$parsedTimestamp", timezone: "UTC" } },
                        ],
                    },
                },
            },
            {
                $addFields: {
                    diffMinutes: {
                        $mod: [
                            {
                                $add: [
                                    { $subtract: [currentMinutesUTC, "$logMinutesUTC"] },
                                    1440,
                                ],
                            },
                            1440,
                        ],
                    },
                },
            },
            { $match: { $expr: { $lte: ["$diffMinutes", windowMinutes] } } },
            { $sort: { parsedTimestamp: -1 } },
            {
                $project: {
                    parsedTimestamp: 1,
                    timestamp: 1,
                    status_code: 1,
                    hour_sin: 1,
                    hour_cos: 1,
                    dow_sin: 1,
                    dow_cos: 1,
                    endpoint_enc: 1,
                    http_method_enc: 1,
                    geo_location_enc: 1,
                    req_resp_ratio: 1,
                    normalized_latency: 1,
                    log_request_size: 1,
                    log_response_size: 1,
                    log_response_time: 1,
                },
            },
        ]).allowDiskUse(true);

        const formatted = agg.map((doc) => {
            const dt = doc.parsedTimestamp ? new Date(doc.parsedTimestamp) : null;
            return {
                ...doc,
                timestampUTC: dt
                    ? dt.toISOString().replace("T", " ").replace("Z", " UTC")
                    : null,
                timestampLocal: dt
                    ? dt.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                    })
                    : doc.timestamp,
            };
        });

        res.status(200).json({
            success: true,
            count: formatted.length,
            nowUTC: new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate(),
                    now.getUTCHours(),
                    now.getUTCMinutes()
                )
            )
                .toISOString()
                .replace("T", " ")
                .replace("Z", " UTC"),
            nowLocal: now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            }),
            data: formatted,
        });
    } catch (error) {
        console.error("Error in getParsedLogsLastHour:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// New: set or update threshold (body: { name: "error_threshold", value: 100 })
exports.setThreshold = async (req, res) => {
    try {
        const { name = "error_threshold", value } = req.body;
        if (typeof value !== "number") {
            return res
                .status(400)
                .json({ success: false, error: "value must be a number" });
        }
        const doc = await Threshold.findOneAndUpdate(
            { name },
            { value, updatedAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(200).json({ success: true, data: doc });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// New: get saved threshold by name (default name=error_threshold)
exports.getThreshold = async (req, res) => {
    try {
        const name = req.query.name || "error_threshold";
        const doc = await Threshold.findOne({ name });
        if (!doc) {
            return res
                .status(200)
                .json({ success: true, data: { name, value: null } });
        }
        res.status(200).json({ success: true, data: doc });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// modify getParsedErrorThreshold to use stored threshold when not provided
exports.getParsedErrorThreshold = async (req, res) => {
    try {
        const now = new Date();
        const currentMinutesUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
        const windowMinutes = parseInt(req.query.window, 10) || 60;

        // read threshold from query; if absent, fetch from DB; fallback default 100
        let threshold = undefined;
        if (req.query.threshold) {
            threshold = parseInt(req.query.threshold, 10);
        } else {
            const doc = await Threshold.findOne({ name: "error_threshold" });
            threshold = doc && typeof doc.value === "number" ? doc.value : 100;
        }

        const agg = await ParsedLog.aggregate([
            {
                $addFields: {
                    parsedTimestamp: {
                        $cond: [
                            { $eq: [{ $type: "$timestamp" }, "string"] },
                            {
                                $dateFromString: {
                                    dateString: "$timestamp",
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            "$timestamp",
                        ],
                    },
                },
            },
            { $match: { parsedTimestamp: { $type: "date" } } },
            {
                $addFields: {
                    logMinutesUTC: {
                        $add: [
                            {
                                $multiply: [
                                    { $hour: { date: "$parsedTimestamp", timezone: "UTC" } },
                                    60,
                                ],
                            },
                            { $minute: { date: "$parsedTimestamp", timezone: "UTC" } },
                        ],
                    },
                },
            },
            {
                $addFields: {
                    diffMinutes: {
                        $mod: [
                            {
                                $add: [
                                    { $subtract: [currentMinutesUTC, "$logMinutesUTC"] },
                                    1440,
                                ],
                            },
                            1440,
                        ],
                    },
                },
            },
            { $match: { $expr: { $lte: ["$diffMinutes", windowMinutes] } } },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    errorCount: {
                        $sum: { $cond: [{ $gte: ["$status_code", 400] }, 1, 0] },
                    },
                },
            },
        ]).allowDiskUse(true);

        const result = agg[0] || { totalCount: 0, errorCount: 0 };
        const reportedErrorCount =
            result.errorCount > threshold ? result.errorCount : 0;

        res.status(200).json({
            success: true,
            windowMinutes,
            threshold,
            totalCount: result.totalCount,
            errorCount: result.errorCount,
            reportedErrorCount,
        });
    } catch (error) {
        console.error("Error in getParsedErrorThreshold:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// New: check for SQL injection in query parameter
exports.checkSqlInjection = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: "Query parameter is required",
            });
        }

        const hasSqlInjection = isSqlInjection(query);

        res.status(200).json({
            success: true,
            input: query,
            hasSqlInjection,
            message: hasSqlInjection
                ? "⚠️ SQL injection attempt detected"
                : "✅ No SQL injection detected",
        });
    } catch (error) {
        console.error("Error in checkSqlInjection:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};