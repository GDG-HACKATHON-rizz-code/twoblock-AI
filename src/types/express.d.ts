import { UserRole } from '@prisma/client';

export interface AuthUserPayload {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  is_demo_account?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
