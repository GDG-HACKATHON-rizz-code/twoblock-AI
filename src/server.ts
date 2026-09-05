import app from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/db.js';

async function startServer() {
  const port = parseInt(env.PORT, 10) || 5000;

  console.log('🔍 Checking database connection...');
  const isConnected = await checkDatabaseConnection();
  if (isConnected) {
    console.log('✅ PostgreSQL Database connected successfully.');
  } else {
    console.warn('⚠️ Warning: Database connection failed. Please check DATABASE_URL.');
  }

  app.listen(port, () => {
    console.log(`🚀 2Be AI Backend server running on port ${port} [${env.NODE_ENV}]`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
