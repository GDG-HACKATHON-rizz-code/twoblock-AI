import { prisma } from '../../src/config/db.js';
import { hashPassword } from '../../src/utils/password.js';
import { signToken } from '../../src/utils/jwt.js';
import { UserRole } from '@prisma/client';

export interface TestContext {
  student: { id: string; email: string; token: string };
  teacherA: { id: string; email: string; token: string };
  teacherB: { id: string; email: string; token: string };
  admin: { id: string; email: string; token: string };
  subjectMat: { id: string; code: string };
  subjectEng: { id: string; code: string };
  topicMat1: { id: string; code: string; subject_id: string };
  subtopicMat1_1: { id: string; code: string; topic_id: string };
  topicMat2: { id: string; code: string; subject_id: string };
  subtopicMat2_1: { id: string; code: string; topic_id: string };
  topicEng1: { id: string; code: string; subject_id: string };
  subtopicEng1_1: { id: string; code: string; topic_id: string };
}

export async function setupTestContext(prefix: string = ''): Promise<TestContext> {
  const p = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  const defaultPass = await hashPassword('Password123!');

  // Create Users with unique emails
  const student = await prisma.user.create({
    data: {
      email: `student_${p}@twoblock.ai`,
      password_hash: defaultPass,
      full_name: 'Ahmad Pelajar',
      role: UserRole.STUDENT,
      student_profile: { create: { grade_level: 4 } },
    },
  });

  const teacherA = await prisma.user.create({
    data: {
      email: `teacher_a_${p}@twoblock.ai`,
      password_hash: defaultPass,
      full_name: 'Cikgu Ali',
      role: UserRole.TEACHER,
      teacher_profile: { create: { school_name: 'SK Taman Tun' } },
    },
  });

  const teacherB = await prisma.user.create({
    data: {
      email: `teacher_b_${p}@twoblock.ai`,
      password_hash: defaultPass,
      full_name: 'Cikgu Siti',
      role: UserRole.TEACHER,
      teacher_profile: { create: { school_name: 'SK Bangsar' } },
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: `admin_${p}@twoblock.ai`,
      password_hash: defaultPass,
      full_name: 'Admin Utama',
      role: UserRole.ADMIN,
    },
  });

  // Create Subjects with unique codes
  const subjectMat = await prisma.subject.create({
    data: {
      code: `MAT_${p}`,
      name_ms: 'Matematik',
      name_en: 'Mathematics',
      grade_level: 4,
    },
  });

  const subjectEng = await prisma.subject.create({
    data: {
      code: `ENG_${p}`,
      name_ms: 'Bahasa Inggeris',
      name_en: 'English',
      grade_level: 4,
    },
  });

  // Create Topics & Subtopics
  const topicMat1 = await prisma.topic.create({
    data: {
      subject_id: subjectMat.id,
      code: `T01_${p}`,
      title_ms: 'Nombor Bulat dan Operasi Asas',
      title_en: 'Whole Numbers and Basic Operations',
      order_seq: 1,
    },
  });

  const subtopicMat1_1 = await prisma.subtopic.create({
    data: {
      topic_id: topicMat1.id,
      code: `ST01_1_${p}`,
      title_ms: 'Nilai Nombor hingga 100,000',
      title_en: 'Number Values up to 100,000',
      order_seq: 1,
      difficulty_tier: 1,
    },
  });

  const topicMat2 = await prisma.topic.create({
    data: {
      subject_id: subjectMat.id,
      code: `T02_${p}`,
      title_ms: 'Pecahan, Perpuluhan dan Peratus',
      title_en: 'Fractions, Decimals and Percentages',
      order_seq: 2,
    },
  });

  const subtopicMat2_1 = await prisma.subtopic.create({
    data: {
      topic_id: topicMat2.id,
      code: `ST02_1_${p}`,
      title_ms: 'Pecahan Wajar',
      title_en: 'Proper Fractions',
      order_seq: 1,
      difficulty_tier: 1,
    },
  });

  const topicEng1 = await prisma.topic.create({
    data: {
      subject_id: subjectEng.id,
      code: `ENG_T01_${p}`,
      title_ms: 'Tatabahasa',
      title_en: 'Grammar',
      order_seq: 1,
    },
  });

  const subtopicEng1_1 = await prisma.subtopic.create({
    data: {
      topic_id: topicEng1.id,
      code: `ENG_ST01_1_${p}`,
      title_ms: 'Kata Nama',
      title_en: 'Nouns',
      order_seq: 1,
      difficulty_tier: 1,
    },
  });

  return {
    student: {
      id: student.id,
      email: student.email,
      token: signToken({ id: student.id, email: student.email, role: student.role, full_name: student.full_name }),
    },
    teacherA: {
      id: teacherA.id,
      email: teacherA.email,
      token: signToken({ id: teacherA.id, email: teacherA.email, role: teacherA.role, full_name: teacherA.full_name }),
    },
    teacherB: {
      id: teacherB.id,
      email: teacherB.email,
      token: signToken({ id: teacherB.id, email: teacherB.email, role: teacherB.role, full_name: teacherB.full_name }),
    },
    admin: {
      id: admin.id,
      email: admin.email,
      token: signToken({ id: admin.id, email: admin.email, role: admin.role, full_name: admin.full_name }),
    },
    subjectMat: { id: subjectMat.id, code: subjectMat.code },
    subjectEng: { id: subjectEng.id, code: subjectEng.code },
    topicMat1: { id: topicMat1.id, code: topicMat1.code, subject_id: topicMat1.subject_id },
    subtopicMat1_1: { id: subtopicMat1_1.id, code: subtopicMat1_1.code, topic_id: subtopicMat1_1.topic_id },
    topicMat2: { id: topicMat2.id, code: topicMat2.code, subject_id: topicMat2.subject_id },
    subtopicMat2_1: { id: subtopicMat2_1.id, code: subtopicMat2_1.code, topic_id: subtopicMat2_1.topic_id },
    topicEng1: { id: topicEng1.id, code: topicEng1.code, subject_id: topicEng1.subject_id },
    subtopicEng1_1: { id: subtopicEng1_1.id, code: subtopicEng1_1.code, topic_id: subtopicEng1_1.topic_id },
  };
}
