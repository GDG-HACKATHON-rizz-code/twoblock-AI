-- ==============================================================================
-- 2Block Ai — Curriculum Resources & Approved Syllabus Schema
-- Migration: 20260906_curriculum_resources.sql
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. CURRICULUM DOCUMENTS
-- Tracks source curriculum files uploaded to Supabase Storage
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  grade_level INTEGER NOT NULL,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. CURRICULUM TOPICS
-- Standardized syllabus topics, subtopics, and learning objectives
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.curriculum_documents(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  grade_level INTEGER NOT NULL,
  topic_name TEXT NOT NULL,
  subtopic_name TEXT NOT NULL,
  learning_objective TEXT NOT NULL,
  difficulty_min INTEGER NOT NULL DEFAULT 1,
  difficulty_max INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. CURRICULUM CONTENT
-- Granular syllabus content chunks and concepts for AI prompt reference
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
  content_text TEXT NOT NULL,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  source_page INTEGER,
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. CURRICULUM QUESTIONS
-- Approved question bank from datasets, teachers, and Gemini
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.curriculum_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL CHECK (source_type IN ('dataset', 'teacher_created', 'gemini_generated')),
  source_reference TEXT,
  review_status TEXT NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_curr_topics_lookup ON public.curriculum_topics(subject, grade_level, is_active);
CREATE INDEX IF NOT EXISTS idx_curr_questions_topic ON public.curriculum_questions(topic_id, difficulty, is_active);
CREATE INDEX IF NOT EXISTS idx_curr_content_topic ON public.curriculum_content(topic_id);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.curriculum_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_questions ENABLE ROW LEVEL SECURITY;

-- Curriculum Documents: All authenticated can view; only teachers/admins can insert/update/delete
CREATE POLICY "Curriculum documents viewable by authenticated" ON public.curriculum_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Curriculum documents manageable by teachers and admins" ON public.curriculum_documents
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Curriculum Topics: All authenticated can view; teachers/admins manage
CREATE POLICY "Curriculum topics viewable by authenticated" ON public.curriculum_topics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Curriculum topics manageable by teachers and admins" ON public.curriculum_topics
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Curriculum Content: All authenticated can view; teachers/admins manage
CREATE POLICY "Curriculum content viewable by authenticated" ON public.curriculum_content
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Curriculum content manageable by teachers and admins" ON public.curriculum_content
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Curriculum Questions: Approved active questions viewable by authenticated; teachers/admins manage
CREATE POLICY "Approved curriculum questions viewable by authenticated" ON public.curriculum_questions
  FOR SELECT TO authenticated USING (is_active = true AND review_status = 'approved');

CREATE POLICY "Curriculum questions manageable by teachers and admins" ON public.curriculum_questions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );
