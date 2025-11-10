const Log = require("../models/Log");
const logger = require("../middleware/logger");

exports.createLog = async (req, res) => {
  try {
    const log = await Log.create(req.body);
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 });
    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getLogsByEndpoint = async (req, res) => {
  try {
    const logs = await Log.find({ endpoint: req.params.endpoint });
    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getLogsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const logs = await Log.find({
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });
    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getLogStats = async (req, res) => {
  try {
    const stats = await Log.aggregate([
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: "$response_time_ms" },
          totalRequests: { $sum: 1 },
          successRate: {
            $avg: { $cond: [{ $lt: ["$status_code", 400] }, 1, 0] },
          },
        },
      },
    ]);
    res.status(200).json({ success: true, data: stats[0] });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getLogsLastHour = async (req, res) => {
  try {
    const now = new Date();
    // use UTC consistently for comparison
    const currentMinutesUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
    const windowMinutes = parseInt(req.query.window, 10) || 60;

    const agg = await Log.aggregate([
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
          endpoint: 1,
          http_method: 1,
          status_code: 1,
          response_time_ms: 1,
          request_size_bytes: 1,
          response_size_bytes: 1,
          service_name: 1,
          client_ip: 1,
          geo_location: 1,
          region: 1,
          user_agent: 1,
          host_platform: 1,
        },
      },
    ]).allowDiskUse(true);

    const formatted = agg.map((doc) => {
      const dt = doc.parsedTimestamp ? new Date(doc.parsedTimestamp) : null;
      return {
        ...doc,
        // show both UTC and server-local time so you can verify
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
    console.error("Error in getLogsLastHour:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.normalCartService = async (req, res) => {
  try {
    const responseTime = Math.floor(Math.random() * (300 - 200 + 1)) + 200;
    await new Promise((resolve) => setTimeout(resolve, responseTime));

    const logData = {
      response_time_ms: responseTime,
      status_code: 200,
      endpoint: "/cart",
      response_size_bytes: 25541,
      request_size_bytes: 10172,
      client_ip: req.ip,
      http_method: "POST",
      service: "normal",
      geolocation: ['US', 'IN', 'DE'][Math.floor(Math.random() * 3)]
    };

    const savedLog = await Log.create(logData);
    logger.info("Cart Service Request", logData);

    res.status(200).json({
      success: true,
      message: "Cart service processed successfully",
      responseTime,
      logId: savedLog._id,
    });
  } catch (error) {
    logger.error("Error in normalCartService", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.slowCartService = async (req, res) => {
  try {
    const responseTime = Math.floor(Math.random() * (1000 - 800 + 1)) + 800;
    await new Promise((resolve) => setTimeout(resolve, responseTime));

    const logData = {
      response_time_ms: responseTime,
      status_code: 200,
      endpoint: "/cart",
      response_size_bytes: 100,
      request_size_bytes: 700,
      client_ip: req.ip,
      http_method: "POST",
      service: "slow",
      geolocation: ['US', 'IN', 'DE'][Math.floor(Math.random() * 3)]
    };

    const savedLog = await Log.create(logData);
    logger.info("Cart Service Request", logData);

    res.status(200).json({
      success: true,
      message: "Cart service processed (slow)",
      responseTime,
      logId: savedLog._id,
    });
  } catch (error) {
    logger.error("Error in slowCartService", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.fastCartService = async (req, res) => {
  try {
    const responseTime = Math.floor(Math.random() * 100);
    await new Promise((resolve) => setTimeout(resolve, responseTime));

    const logData = {
      response_time_ms: responseTime,
      status_code: 200,
      endpoint: "/cart",
      response_size_bytes: 512,
      request_size_bytes: 256000,
      client_ip: req.ip,
      http_method: "POST",
      service: "fast",
      geolocation: ['US', 'IN', 'DE'][Math.floor(Math.random() * 3)]

    };

    const savedLog = await Log.create(logData);
    logger.info("Cart Service Request", logData);

    res.status(200).json({
      success: true,
      message: "Cart service processed (fast)",
      responseTime,
      logId: savedLog._id,
    });
  } catch (error) {
    logger.error("Error in fastCartService", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};


