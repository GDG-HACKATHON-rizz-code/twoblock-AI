import { UserRole } from '@prisma/client';
import { prisma } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { dataStore } from './dataStore.js';

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
    const role = input.role || UserRole.STUDENT;
    const passwordHash = await hashPassword(input.password);

    // Try Prisma if available
    try {
      const existing = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (existing) {
        throw new AppError('USER_ALREADY_EXISTS', 409);
      }

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
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      // Fallback to DataStore
      const existingInStore = dataStore.data.users.find(u => u.email.toLowerCase() === input.email.toLowerCase());
      if (existingInStore) {
        throw new AppError('USER_ALREADY_EXISTS', 409);
      }

      const newUser = {
        id: `user-${Date.now()}`,
        name: input.full_name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: (role.toLowerCase()) as 'student' | 'teacher',
        createdAt: new Date().toISOString()
      };
      dataStore.data.users.push(newUser);
      dataStore.save();

      const token = signToken({
        id: newUser.id,
        email: newUser.email,
        role: role,
        full_name: newUser.name,
      });

      return {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          full_name: newUser.name,
          role: role,
        },
      };
    }
  }

  async login(input: LoginInput) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (user && user.is_active) {
        const isMatch = await comparePassword(input.password, user.password_hash);
        if (isMatch) {
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
    } catch (e) {
      // Fall through to DataStore check
    }

    // Fallback to DataStore
    const userInStore = dataStore.data.users.find(u => u.email.toLowerCase() === input.email.toLowerCase());
    if (!userInStore) {
      throw new AppError('INVALID_CREDENTIALS', 401);
    }

    const isMatch = await comparePassword(input.password, userInStore.passwordHash);
    if (!isMatch) {
      throw new AppError('INVALID_CREDENTIALS', 401);
    }

    const role = userInStore.role.toUpperCase() as UserRole;
    const token = signToken({
      id: userInStore.id,
      email: userInStore.email,
      role,
      full_name: userInStore.name,
    });

    return {
      token,
      user: {
        id: userInStore.id,
        email: userInStore.email,
        full_name: userInStore.name,
        role,
      },
    };
  }

  async demoLogin(role: 'student' | 'teacher' | 'demo-student' | 'demo-teacher') {
    const isDemoStudent = role === 'demo-student';
    const isDemoTeacher = role === 'demo-teacher';
    const isDemo = isDemoStudent || isDemoTeacher;
    const isStudent = isDemoStudent || role === 'student';

    let targetUser: any;
    if (isDemoStudent) {
      targetUser = {
        id: 'demo-student-adam',
        name: 'Adam Haziq',
        email: 'adam.haziq@twoblock.ai',
        role: 'student',
        is_demo_account: true
      };
    } else if (isDemoTeacher) {
      targetUser = {
        id: 'demo-teacher-liyana',
        name: 'Ms. Liyana Karim',
        email: 'demo.teacher@twoblock.ai',
        role: 'teacher',
        is_demo_account: true
      };
    } else if (isStudent) {
      // Real student account (starts empty)
      targetUser = {
        id: 'student-real-' + Date.now(),
        name: 'Student',
        email: 'student@twoblock.ai',
        role: 'student',
        is_demo_account: false
      };
    } else {
      // Real teacher account (starts empty)
      targetUser = {
        id: 'teacher-real-default',
        name: 'Teacher',
        email: 'teacher@twoblock.ai',
        role: 'teacher',
        is_demo_account: false
      };
    }

    const userRole = isStudent ? UserRole.STUDENT : UserRole.TEACHER;
    const token = signToken({
      id: targetUser.id,
      email: targetUser.email,
      role: userRole,
      full_name: targetUser.name,
      is_demo_account: isDemo
    });

    return {
      token,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        full_name: targetUser.name,
        role: userRole,
        is_demo_account: isDemo
      },
    };
  }
}

export const authService = new AuthService();
