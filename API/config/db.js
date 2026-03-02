const sql = require('mssql');
require('dotenv').config();

const buildServer = () => {
  if (process.env.DB_SERVER) return process.env.DB_SERVER;
  if (process.env.DB_HOST && process.env.DB_INSTANCE) {
    return `${process.env.DB_HOST}\\${process.env.DB_INSTANCE}`;
  }
  if (process.env.DB_HOST) return process.env.DB_HOST;
  return 'localhost';
};

const config = {
  server: buildServer(),
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'school',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || process.env.DB_ENCRYPT === '1',
    trustServerCertificate:
      process.env.DB_TRUST_CERT === undefined
        ? true
        : process.env.DB_TRUST_CERT === 'true' || process.env.DB_TRUST_CERT === '1',
  },
  pool: {
    max: Number(process.env.DB_POOL_MAX || 10),
    min: Number(process.env.DB_POOL_MIN || 0),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE || 30000),
  },
  connectionTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT || 15000),
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectWithRetry = async (attempt = 1) => {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    console.log(`Connected to SQL Server (attempt ${attempt})`);
    return pool;
  } catch (err) {
    console.error(`Database connection attempt ${attempt} failed:`, err.message);
    const maxAttempts = Number(process.env.DB_MAX_RETRIES || 5);
    const delay = Number(process.env.DB_RETRY_DELAY_MS || 2000);
    if (attempt >= maxAttempts) {
      throw err;
    }
    await wait(delay);
    return connectWithRetry(attempt + 1);
  }
};

const poolPromise = connectWithRetry();
poolPromise.catch((err) => {
  console.error('Database connection failed after retries:', err.message);
});

module.exports = { sql, poolPromise };
