const { createLogger, format, transports } = require('winston');
require('winston-mongodb');
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

console.log('logger transport using MONGO_URI:', maskUri(config.MONGO_URI));

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.printf((info) => {
            const { timestamp, level, message, ...rest } = info;
            const flatLog = {
                timestamp,
                level,
                message,
                ...rest
            };
            return JSON.stringify(flatLog);
        })
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            )
        }),
        new transports.MongoDB({
            db: config.MONGO_URI,
            collection: 'logs',
            level: 'info',
            capped: false
        })
    ]
});

module.exports = logger;
