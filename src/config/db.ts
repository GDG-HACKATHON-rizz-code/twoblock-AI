import { PrismaClient } from '@prisma/client';
import { supabase } from './supabase.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Checks the Supabase connection by performing a lightweight query.
 * Returns true if the connection succeeds, otherwise false.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  if (!supabase) {
    console.warn('⚠️ Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    return false;
  }
  try {
    // Check Supabase connectivity
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Supabase connection check failed:', err);
    return false;
  }
}

