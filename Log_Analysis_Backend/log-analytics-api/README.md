# Log Analytics API

## Overview
The Log Analytics API is a Node.js application built using the MVC architecture. It provides endpoints for logging and retrieving log data from a MongoDB database. The API captures various attributes related to HTTP requests and responses, allowing for detailed analysis and monitoring.

## Features
- Connects to a MongoDB database to store log entries.
- Implements CRUD operations for log data.
- Supports filtering logs by service name and client IP.
- Error handling middleware for robust API responses.

## Project Structure
```
log-analytics-api
├── src
│   ├── config
│   │   ├── database.js
│   │   └── config.js
│   ├── controllers
│   │   └── logController.js
│   ├── models
│   │   └── Log.js
│   ├── routes
│   │   └── logRoutes.js
│   ├── services
│   │   └── logService.js
│   ├── middleware
│   │   └── errorHandler.js
│   └── utils
│       └── helpers.js
├── .env
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd log-analytics-api
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Create a `.env` file in the root directory and add your MongoDB connection string:
   ```
   MONGO_URI=<your-mongodb-connection-string>
   ```

## Usage
To start the server, run:
```
npm start
```
or for development with hot reloading:
```
npm run dev
```

## API Endpoints
- `GET /api/logs` - Retrieve all logs.
- `GET /api/logs/:id` - Retrieve a log by ID.
- `GET /api/logs/service/:serviceName` - Retrieve logs by service name.
- `GET /api/logs/client/:clientIp` - Retrieve logs by client IP.

## License
This project is licensed under the ISC License.