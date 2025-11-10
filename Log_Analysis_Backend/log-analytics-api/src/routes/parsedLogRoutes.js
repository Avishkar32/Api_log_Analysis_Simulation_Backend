const express = require("express");
const router = express.Router();
const {
    createParsedLog,
    getParsedLogs,
    getParsedLogStats,
    getParsedLogsByTimeRange,
    getParsedLogsLastHour,
    getParsedErrorThreshold,
    setThreshold,
    getThreshold,
    checkSqlInjection, // Add this line
} = require("../controllers/parsedLogController");

router.post("/parsed-logs", createParsedLog);
router.get("/parsed-logs", getParsedLogs);
router.get("/parsed-logs/stats", getParsedLogStats);
router.get("/parsed-logs/timerange", getParsedLogsByTimeRange);

// last-hour + error-threshold
router.get("/parsed-logs/lasthour", getParsedLogsLastHour);
router.get("/parsed-logs/error-threshold", getParsedErrorThreshold);

// threshold management
router.post("/parsed-logs/threshold", setThreshold); // body: { name?:string, value:number }
router.get("/parsed-logs/threshold", getThreshold); // ?name=error_threshold

// SQL injection check
router.get("/parsed-logs/check-sql-injection", checkSqlInjection);

module.exports = router;