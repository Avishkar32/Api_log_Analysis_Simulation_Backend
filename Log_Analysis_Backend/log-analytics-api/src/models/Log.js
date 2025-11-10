const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  endpoint: { type: String, required: true },
  http_method: { type: String, required: true },
  status_code: { type: Number, required: true },
  response_time_ms: { type: Number, required: true },
  request_size_bytes: { type: Number },
  response_size_bytes: { type: Number },
  service_name: { type: String },
  client_ip: { type: String },
  geo_location: { type: String },
  region: { type: String },
  user_agent: { type: String },
  host_platform: { type: String },
});

module.exports = mongoose.model("Log", logSchema);

// Add this after connectDB();
mongoose.connection.on("connected", () => {
  console.log("Connected to database:", mongoose.connection.db.databaseName);
});
