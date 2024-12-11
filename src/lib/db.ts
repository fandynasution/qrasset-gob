import * as sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

// Create a poolPromise with the connection configuration
const poolPromise = new sql.ConnectionPool({
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST as string,
  port: parseInt(process.env.DB_PORT || '1119', 10),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    enableArithAbort: true,
    requestTimeout: 300000,
    trustServerCertificate: false, // Change to true for self-signed certificates or local dev
  },
}).connect();

// Function to check database connection
export const checkDbConnection = async () => {
  const pool = await poolPromise;  // Get the connection pool
  try {
    await pool.request().query('SELECT 1'); // Simple query to check if the connection is active
    console.log('Database connection is successful');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw new Error('Database connection failed');
  }
};

// Export the poolPromise for use in other parts of the application
export { poolPromise };