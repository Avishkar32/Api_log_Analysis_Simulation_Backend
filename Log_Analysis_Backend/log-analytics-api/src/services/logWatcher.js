const { MongoClient } = require('mongodb');
const ParsedLog = require('../models/parsedLogs'); // add: use your Mongoose model
const axios = require('axios'); // added: HTTP client
const config = require('../config/config');

function maskUri(uri) {
    try {
        const u = new URL(uri);
        if (u.password) u.password = '*****';
        return u.toString();
    } catch (e) {
        return uri.replace(/:(\/\/[^@]+)@/, '://*****@');
    }
}

const uri = config.MONGO_URI;

class LogWatcher {
    constructor() {
        // add serverSelectionTimeoutMS to fail fast on bad URI / network
        this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
        this.changeStream = null;
        this._connected = false; // private flag
    }

    // Public method to check connection status
    isConnected() {
        return this._connected && this.client.topology?.isConnected();
    }

    async watch() {
        try {
            console.log('LogWatcher will connect to:', maskUri(uri));
            await this.client.connect();
            this._connected = true;
            console.log("✅ Connected to MongoDB (watcher)");

            // Update to match the database where winston-mongodb is writing logs
            const db = this.client.db("flexible_logs");
            const sourceCollection = db.collection("logs"); // Match the collection name from logger.js

            console.log("📁 Watching collection:", sourceCollection.collectionName);
            console.log("🗄️ In database:", db.databaseName);

            this.changeStream = sourceCollection.watch([], {
                fullDocument: 'updateLookup'
            });

            console.log("👀 Watching for new log entries...");

            this.changeStream.on("change", async (change) => {
                if (change.operationType === "insert") {
                    console.log("🆕 New log detected!");
                    const newLog = change.fullDocument;
                    const parsedLog = this.parseLog(newLog);
                    console.log("✨ Parsed log:", JSON.stringify(parsedLog, null, 2));

                    // Map parsedLog -> only fields required by parsedLogs schema
                    const docToSave = {
                        timestamp: parsedLog.timestamp,
                        status_code: parsedLog.status_code,
                        hour_sin: parsedLog.hour_sin,
                        hour_cos: parsedLog.hour_cos,
                        dow_sin: parsedLog.dow_sin,
                        dow_cos: parsedLog.dow_cos,
                        endpoint_enc: parsedLog.endpoint_enc,
                        http_method_enc: parsedLog.http_method_enc,
                        geo_location_enc: parsedLog.geolocation_enc ?? parsedLog.geo_location_enc ?? -1,
                        req_resp_ratio: parsedLog.req_resp_ratio,
                        normalized_latency: parsedLog.normalized_latency,
                        log_request_size: parsedLog.log_request_size,
                        log_response_size: parsedLog.log_response_size,
                        log_response_time: parsedLog.log_response_time,
                    };

                    try {
                        const saved = await ParsedLog.create(docToSave);
                        console.log("✅ Parsed log saved to parsedlogs (test DB) with id:", saved._id);

                        // --- send to prediction API ---
                        try {
                            const payload = { data: {
                                hour_sin: docToSave.hour_sin,
                                hour_cos: docToSave.hour_cos,
                                dow_sin: docToSave.dow_sin,
                                dow_cos: docToSave.dow_cos,
                                endpoint_enc: docToSave.endpoint_enc,
                                http_method_enc: docToSave.http_method_enc,
                                geo_location_enc: docToSave.geo_location_enc,
                                req_resp_ratio: docToSave.req_resp_ratio,
                                normalized_latency: docToSave.normalized_latency,
                                log_request_size: docToSave.log_request_size,
                                log_response_size: docToSave.log_response_size,
                                log_response_time: docToSave.log_response_time
                            }};

                            const resp = await axios.post(
                                'https://distributable-unofficious-daine.ngrok-free.dev/predict',
                                payload,
                                { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
                            );

                            const body = resp.data || {};
                            console.log('🔮 Prediction API response - reconstruction_error:', body.reconstruction_error, ', is_anomaly:', body.is_anomaly);
                        } catch (apiErr) {
                            console.error('❌ Error sending parsed log to prediction API:', apiErr.message || apiErr);
                        }
                        // --- end send ---
                    } catch (saveErr) {
                        console.error("❌ Error saving parsed log to parsedlogs:", saveErr);
                    }
                }
            });

            // Add error handling for the change stream
            this.changeStream.on("error", (error) => {
                console.error("❌ Change stream error:", error);
                this._connected = false;
                this.reconnect();
            });

        } catch (err) {
            this._connected = false;
            console.error("❌ Error connecting MongoClient (watcher):", err.message);
            console.error(err.stack);
            throw err;
        }
    }

    async reconnect() {
        console.log("🔄 Attempting to reconnect...");
        if (this.changeStream) {
            this.changeStream.close();
        }
        if (this.client) {
            await this.client.close();
        }
        setTimeout(() => this.watch(), 5000); // Retry after 5 seconds
    }

    parseLog(log) {
        const metadata = log.metadata || {};

        const timestamp = new Date(metadata.timestamp || log.timestamp || new Date());
        const hour = timestamp.getHours();
        const dayOfWeek = timestamp.getDay(); // 0 (Sunday) → 6 (Saturday)

        // Compute sin/cos time encodings
        const hour_sin = Math.sin((2 * Math.PI * hour) / 24);
        const hour_cos = Math.cos((2 * Math.PI * hour) / 24);
        const dow_sin = Math.sin((2 * Math.PI * dayOfWeek) / 7);
        const dow_cos = Math.cos((2 * Math.PI * dayOfWeek) / 7);

        // Extract values
        const response_time_ms = metadata.response_time_ms || 0;
        const request_size_bytes = metadata.request_size_bytes || 0;
        const response_size_bytes = metadata.response_size_bytes || 0;

        // Derived metrics
        const req_resp_ratio = response_size_bytes / (request_size_bytes + 1);
        const normalized_latency = response_time_ms / (response_size_bytes + 1);

        // Log transforms
        const log_request_size = Math.log1p(request_size_bytes);
        const log_response_size = Math.log1p(response_size_bytes);
        const log_response_time = Math.log1p(response_time_ms);

        // Random geolocation
        const geolocation = metadata.geolocation || 'nan';

        // --- Encoding mappings ---
        const endpointMapping = {
            '/cart': 0,
            '/checkout': 1,
            '/order': 2,
            '/products': 3,
            '/search': 4
        };

        const methodMapping = {
            'GET': 0,
            'POST': 1
        };

        const geoMapping = {
            'DE': 0,
            'IN': 1,
            'US': 2,
            'nan': 3
        };

        // --- Encoded values ---
        const endpointEncoded = endpointMapping[metadata.endpoint] ?? -1;
        const methodEncoded = methodMapping[metadata.http_method] ?? -1;
        const geoEncoded = geoMapping[geolocation] ?? -1;


        return {
            timestamp,
            hour_sin,
            hour_cos,
            dow_sin,
            dow_cos,
            service: metadata.service || "unknown",
            endpoint: metadata.endpoint || "N/A",
            endpoint_enc: endpointEncoded,
            response_time_ms,
            status_code: metadata.status_code || 0,
            http_method: metadata.http_method || "N/A",
            http_method_enc: methodEncoded,
            request_size_bytes,
            response_size_bytes,
            req_resp_ratio,
            normalized_latency,
            log_request_size,
            log_response_size,
            log_response_time,
            geolocation,
            geolocation_enc: geoEncoded,
            message: log.message || "N/A",
        };
    }


    close() {
        if (this.changeStream) {
            this.changeStream.close();
        }
        if (this.client) {
            this.client.close();
            this._connected = false;
        }
    }
}

// Export a new instance
const logWatcher = new LogWatcher();
module.exports = logWatcher;
