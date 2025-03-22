import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import assetRoutes from './routes/assetRoutes';
import { setupSwagger } from './swagger';
import { checkDbConnection } from './lib/db';  // Ensure this import is correct
import os from 'os';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 9090;

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue; // Skip if iface is undefined
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost'; // Default to localhost if IP cannot be found
};

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' })); // Menambah limit payload
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup Swagger
setupSwagger(app);

// Define routes
app.use('/api/qrasset', express.static(path.join(__dirname, 'storage')));
app.use('/api', assetRoutes);

// Start the server
app.listen(port, async () => {
  try {
    await checkDbConnection();  // Check DB connection before starting the server
    const host = getLocalIP();
    console.log(`Server is running on http://${host}:${port}`);
  } catch (error) {
    console.error('Failed to start server due to DB connection error:', error);
    process.exit(1); // Exit process if DB connection fails
  }
});
