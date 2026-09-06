import app from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/db.js';

async function startServer() {
  const port = parseInt(env.PORT, 10) || 5000;

  console.log('🔍 Checking Supabase connection...');
  const isConnected = await checkDatabaseConnection();
  if (isConnected) {
    console.log('✅ Supabase connected successfully.');
  } else {
    console.warn('⚠️ Warning: Supabase connection failed. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  app.listen(port, () => {
    console.log(`🚀 2Be AI Backend server running on port ${port} [${env.NODE_ENV}]`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
