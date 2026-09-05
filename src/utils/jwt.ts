import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthUserPayload } from '../types/express.js';
import { UnauthorizedError } from './errors.js';

export function signToken(payload: AuthUserPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthUserPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;
    return decoded;
  } catch (_error) {
    throw new UnauthorizedError();
  }
}
