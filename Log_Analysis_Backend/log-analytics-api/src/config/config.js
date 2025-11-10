require('dotenv').config();

const config = {
  PORT: process.env.PORT || 3000,
  MONGO_URI:
    process.env.MONGO_URI ||
    'mongodb+srv://anujgosavi2005_db_user:b71pYQinILpd0cl1@logs.plv6xj7.mongodb.net/flexible_logs?retryWrites=true&w=majority',
  APP_NAME: 'Log Analytics API',
  ENVIRONMENT: process.env.NODE_ENV || 'development',
};

module.exports = config;