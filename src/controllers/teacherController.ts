import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { healthScoreService } from '../services/healthScoreService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

export async function getTeacherClasses(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const teacherId = req.user!.id;

    const classes = await prisma.class.findMany({
      where: { teacher_id: teacherId },
      include: {
        _count: {
          select: { enrolments: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const data = classes.map((c) => ({
      id: c.id,
      name: c.name,
      grade_level: c.grade_level,
      academic_year: c.academic_year,
      join_code: c.join_code,
      total_students: c._count.enrolments,
      created_at: c.created_at,
    }));

    sendSuccess(res, data, 200);
  } catch (err) {
    next(err);
  }
}

export async function getClassSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const classId = req.params.id;

    const classData = await healthScoreService.getClassHealthScores(teacherId, classId);

    if (!classData) {
      throw new AppError('CLASS_NOT_FOUND', 404);
    }

    const students = classData.students;
    const scoredStudents = students.filter((s) => s.health_score !== null);
    const avgHealthScore =
      scoredStudents.length > 0
        ? Math.round(
            (scoredStudents.reduce((sum, s) => sum + (s.health_score || 0), 0) /
              scoredStudents.length) *
              100
          ) / 100
        : null;

    const labelCounts = {
      Thriving: students.filter((s) => s.health_label === 'Thriving').length,
      'On track': students.filter((s) => s.health_label === 'On track').length,
      Watch: students.filter((s) => s.health_label === 'Watch').length,
      'Needs support': students.filter((s) => s.health_label === 'Needs support').length,
      Unscored: students.filter((s) => s.health_score === null).length,
    };

    sendSuccess(
      res,
      {
        class_id: classData.class_id,
        class_name: classData.class_name,
        total_students: classData.total_students,
        average_health_score: avgHealthScore,
        health_distribution: labelCounts,
      },
      200
    );
  } catch (err) {
    next(err);
  }
}

export async function getClassStudents(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const teacherId = req.user!.id;
    const classId = req.params.id;

    const result = await healthScoreService.getClassHealthScores(teacherId, classId);

    if (!result) {
      throw new AppError('CLASS_NOT_FOUND', 404);
    }

    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
}
