import { UserRole } from '@prisma/client';

export interface AuthUserPayload {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
