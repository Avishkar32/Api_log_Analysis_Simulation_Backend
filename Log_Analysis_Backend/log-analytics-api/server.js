const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/database");
const logRoutes = require("./src/routes/logRoutes");
const parsedLogRoutes = require("./src/routes/parsedLogRoutes");
const logWatcher = require('./src/services/logWatcher');

const logger = require('./src/middleware/logger');  

const app = express();

// Connect to MongoDB
connectDB().then(async () => {
  try {
    await logWatcher.watch();
    console.log('LogWatcher status:', logWatcher.isConnected() ? 'Connected' : 'Not Connected');
  } catch (error) {
    console.error('Failed to initialize LogWatcher:', error);
  }
});

// Middleware
app.use(cors());
app.use(express.json());


// Log every request
// app.use((req, res, next) => {
//   logger.info({
//     message: 'Incoming Request',
//     method: req.method,
//     url: req.url,
//     ip: req.ip
//   });
//   next();
// });

// Routes
app.use("/api", logRoutes);

app.use("/api", parsedLogRoutes);

const PORT = process.env.PORT || 3000;

// Update server shutdown handling
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logWatcher.close();
  server.close();
});
