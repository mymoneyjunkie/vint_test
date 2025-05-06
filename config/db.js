// db.js

import mysql from 'mysql2';

import { 
  HOST,
  USER,
  PASSWORD,
  DATABASE 
} from './env.js';

const pool = mysql.createPool({
  host: HOST, // The public IP or domain of your MySQL server
  user: USER,
  password: PASSWORD, // Your database password
  database: DATABASE,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

// Handle pool errors
pool.on('error', (err) => {
  console.log('Database pool error:', err);
});

// Test the connection
function testConnection() {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err);
      // Implement reconnection logic here
      setTimeout(testConnection, 5000); // Retry after 5 seconds
      return;
    }
    console.log('Connected to database successfully');
    connection.release(); // Important: release the connection when done
  });
}

testConnection();

// Export the promise pool
export default promisePool;