const sql = require('mssql');

const config = {
  user: 'root',
  password: '1234',
  server: 'localhost',               // ← REMOVE /SQLEXPRESS if using default instance
  database: 'school',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: 'SQLEXPRESS'        // ← ADD THIS LINE if you're using named instance
  }
};
const poolPromise = sql.connect(config)
  .then(pool => {
    console.log('Connected to SQL Server baby ♡');
    return pool;
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise    // ← THIS IS WHAT YOU NEED TO EXPORT
};