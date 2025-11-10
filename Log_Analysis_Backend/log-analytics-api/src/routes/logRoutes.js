const express = require("express");
const router = express.Router();
const {
  createLog,
  getLogs,
  getLogsByEndpoint,
  getLogsByDateRange,
  getLogStats,
  getLogsLastHour,
  normalCartService,
  slowCartService,
  fastCartService,
} = require("../controllers/logController");

router.post("/logs", createLog);
router.get("/logs", getLogs);
router.get("/logs/endpoint/:endpoint", getLogsByEndpoint);
router.get("/logs/daterange", getLogsByDateRange);
router.get("/logs/stats", getLogStats);
router.get("/logs/lasthour", getLogsLastHour);

router.post("/cart/normal", normalCartService);
router.post("/cart/slow", slowCartService);
router.post("/cart/fast", fastCartService);

module.exports = router;
