const Log = require('../models/Log');

const logService = {
    getAllLogs: async () => {
        return await Log.find({});
    },

    getLogById: async (id) => {
        return await Log.findById(id);
    },

    getLogsByServiceName: async (serviceName) => {
        return await Log.find({ service_name: serviceName });
    },

    getLogsByClientIp: async (clientIp) => {
        return await Log.find({ client_ip: clientIp });
    },

    saveLog: async (logData) => {
        const logEntry = new Log(logData);
        return await logEntry.save();
    }
};

module.exports = logService;