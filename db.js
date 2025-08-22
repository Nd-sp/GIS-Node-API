const knex = require('knex');
require("dotenv").config();
const db = knex({
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "apiuser",
    password: process.env.DB_PASSWORD || "password123",
    database: process.env.DB_NAME || "api_db",
    port: process.env.DB_PORT || 3306,
  },
});

module.exports = db;