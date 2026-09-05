import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { Prisma } from '@prisma/client';

describe('2Be AI 19 Tables & Schema Verification', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should have all 19 models defined in Prisma Client dmmf', () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((m) => m.name);

    const required19Models = [
      'User',
      'StudentProfile',
      'TeacherProfile',
      'Class',
      'ClassEnrolment',
      'Subject',
      'Topic',
      'Subtopic',
      'Question',
      'PracticeSession',
      'QuestionAttempt',
      'LearningEvent',
      'StudentTopicProgress',
      'StudentTopicProgressHistory',
      'StudentSubjectProgress',
      'StudentHealthScore',
      'TeacherIntervention',
      'TeacherNote',
      'AiRecommendation',
    ];

    expect(modelNames).toEqual(expect.arrayContaining(required19Models));
    expect(required19Models.length).toBe(19);
  });

  it('Item 1: should have edited_text in AiRecommendation and edited_notes in TeacherIntervention', () => {
    const aiRecModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'AiRecommendation');
    const teacherInterventionModel = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === 'TeacherIntervention'
    );

    const aiRecFields = aiRecModel?.fields.map((f) => f.name) || [];
    const teacherInterventionFields = teacherInterventionModel?.fields.map((f) => f.name) || [];

    expect(aiRecFields).toContain('edited_text');
    expect(aiRecFields).toContain('reason_ms');
    expect(aiRecFields).toContain('reason_en');

    expect(teacherInterventionFields).toContain('edited_notes');
    expect(teacherInterventionFields).toContain('notes');
  });

  it('Item 2: should have status enum in PracticeSession with all 5 states', () => {
    const sessionStatusEnum = Prisma.dmmf.datamodel.enums.find((e) => e.name === 'SessionStatus');
    expect(sessionStatusEnum).toBeDefined();

    const enumValues = sessionStatusEnum?.values.map((v) => v.name);
    expect(enumValues).toEqual(
      expect.arrayContaining([
        'CREATED',
        'IN_PROGRESS',
        'RECOVERY_MODE',
        'COMPLETED',
        'ABANDONED',
      ])
    );
  });

  it('Item 3: should have gap_type enum in LearningEvent', () => {
    const gapTypeEnum = Prisma.dmmf.datamodel.enums.find((e) => e.name === 'GapType');
    expect(gapTypeEnum).toBeDefined();

    const enumValues = gapTypeEnum?.values.map((v) => v.name);
    expect(enumValues).toEqual(
      expect.arrayContaining([
        'repeated_mistake_gap',
        'mastery_decline_gap',
        'persistent_weak_gap',
      ])
    );
  });

  it('Item 4: should have Question model matching full Section 4 spec fields', () => {
    const questionModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Question');
    expect(questionModel).toBeDefined();

    const fieldNames = questionModel?.fields.map((f) => f.name) || [];
    const expectedFields = [
      'id',
      'subject_id',
      'topic_id',
      'subtopic_id',
      'difficulty_level',
      'question_text',
      'question_type',
      'options',
      'correct_answer',
      'explanation',
      'language',
      'is_diagnostic',
      'grade_level',
      'estimated_time_seconds',
      'is_active',
    ];

    for (const field of expectedFields) {
      expect(fieldNames).toContain(field);
    }
  });

  it('Item 5: should have mastery_source and contributing_factors for explainability and health score append-only', () => {
    const topicProgressModel = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === 'StudentTopicProgress'
    );
    const subjectProgressModel = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === 'StudentSubjectProgress'
    );
    const healthScoreModel = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === 'StudentHealthScore'
    );

    const topicProgressFields = topicProgressModel?.fields.map((f) => f.name) || [];
    const subjectProgressFields = subjectProgressModel?.fields.map((f) => f.name) || [];
    const healthScoreFields = healthScoreModel?.fields.map((f) => f.name) || [];

    expect(topicProgressFields).toContain('mastery_source');
    expect(topicProgressFields).toContain('contributing_factors');

    expect(subjectProgressFields).toContain('mastery_source');
    expect(subjectProgressFields).toContain('contributing_factors');

    expect(healthScoreFields).toContain('contributing_factors');
    expect(healthScoreFields).toContain('gap_indicators');
    // StudentHealthScore is append-only, so it must not have updated_at
    expect(healthScoreFields).not.toContain('updated_at');
  });

  it('should query PostgreSQL database tables directly to confirm physical creation', async () => {
    const tables: Array<{ table_name: string }> = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

    const tableNames = tables.map((t) => t.table_name);
    const expectedTables = [
      'users',
      'student_profiles',
      'teacher_profiles',
      'classes',
      'class_enrolments',
      'subjects',
      'topics',
      'subtopics',
      'questions',
      'practice_sessions',
      'question_attempts',
      'learning_events',
      'student_topic_progress',
      'student_topic_progress_history',
      'student_subject_progress',
      'student_health_scores',
      'teacher_interventions',
      'teacher_notes',
      'ai_recommendations',
    ];

    for (const tbl of expectedTables) {
      expect(tableNames).toContain(tbl);
    }
  });
});
