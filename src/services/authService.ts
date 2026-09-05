import { UserRole } from '@prisma/client';
import { prisma } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
  grade_level?: number;
  school_name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new AppError('USER_ALREADY_EXISTS', 409);
    }

    const passwordHash = await hashPassword(input.password);
    const role = input.role || UserRole.STUDENT;

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        password_hash: passwordHash,
        full_name: input.full_name,
        role,
        ...(role === UserRole.STUDENT
          ? {
              student_profile: {
                create: {
                  grade_level: input.grade_level || 1,
                  school_name: input.school_name,
                },
              },
            }
          : {}),
        ...(role === UserRole.TEACHER
          ? {
              teacher_profile: {
                create: {
                  school_name: input.school_name,
                },
              },
            }
          : {}),
      },
    });

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user || !user.is_active) {
      throw new AppError('INVALID_CREDENTIALS', 401);
    }

    const isMatch = await comparePassword(input.password, user.password_hash);
    if (!isMatch) {
      throw new AppError('INVALID_CREDENTIALS', 401);
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    };
  }
}

export const authService = new AuthService();
