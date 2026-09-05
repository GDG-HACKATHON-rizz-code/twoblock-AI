-- ==============================================================================
-- 2Block Ai — Supabase Database Schema & Row Level Security (RLS)
-- Target Platform: Supabase PostgreSQL
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES (Base user profile linked directly to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. STUDENT PROFILES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  grade TEXT DEFAULT 'Grade 1',
  school TEXT DEFAULT 'Sekolah Kebangsaan Maju Jaya',
  district TEXT DEFAULT 'Kuala Lumpur',
  date_of_birth DATE,
  learning_languages TEXT[] DEFAULT ARRAY['Bahasa Melayu', 'English'],
  favourite_subject TEXT DEFAULT 'Mathematics',
  preferred_study_time TEXT DEFAULT '19:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. TEACHER PROFILES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id TEXT,
  school TEXT DEFAULT 'Sekolah Menengah Maju Jaya',
  district TEXT DEFAULT 'Kuala Lumpur',
  primary_subject TEXT DEFAULT 'Mathematics',
  teaching_level TEXT DEFAULT 'Year 10',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. CLASSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year_level TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. CLASS STUDENTS (Mapping classes to enrolled students)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_students (
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, student_id)
);

-- ------------------------------------------------------------------------------
-- 6. SUBJECTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT
);

-- ------------------------------------------------------------------------------
-- 7. TOPICS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topics (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- ------------------------------------------------------------------------------
-- 8. STUDENT SUBJECT PROGRESS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_subject_progress (
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  mastery INTEGER NOT NULL DEFAULT 0,
  learning_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Building skills',
  strength TEXT,
  PRIMARY KEY (student_id, subject_id)
);

-- ------------------------------------------------------------------------------
-- 9. STUDENT TOPIC PROGRESS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_topic_progress (
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_answers INTEGER NOT NULL DEFAULT 0,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Developing',
  PRIMARY KEY (student_id, topic_id)
);

-- ------------------------------------------------------------------------------
-- 10. LEARNING SESSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id TEXT REFERENCES public.topics(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  focused_minutes INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------------------------
-- 11. PRACTICE ATTEMPTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES public.topics(id) ON DELETE SET NULL,
  level INTEGER NOT NULL DEFAULT 1,
  question TEXT NOT NULL,
  submitted_answer TEXT,
  correct_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. RECOMMENDATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendations (
  id TEXT PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id TEXT REFERENCES public.topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  current_score INTEGER NOT NULL DEFAULT 0,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  recommended_duration_minutes INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'active'
);

-- ------------------------------------------------------------------------------
-- 13. INTERVENTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interventions (
  id TEXT PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  classification TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'problem',
  review_due_date DATE,
  completed_at TIMESTAMPTZ
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subject_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
CREATE POLICY "Public read for authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Student Profiles RLS
CREATE POLICY "Students and Teachers can view student profiles" ON public.student_profiles
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );
CREATE POLICY "Students can update own student profile" ON public.student_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 3. Teacher Profiles RLS
CREATE POLICY "All authenticated can view teacher profiles" ON public.teacher_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can update own teacher profile" ON public.teacher_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4. Classes & Enrolments RLS
CREATE POLICY "Teachers can manage own classes" ON public.classes
  FOR ALL TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "Students and teachers can view classes" ON public.classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage class students" ON public.class_students
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.classes WHERE id = class_id AND teacher_id = auth.uid())
  );
CREATE POLICY "Read class students" ON public.class_students
  FOR SELECT TO authenticated USING (true);

-- 5. Subjects & Topics (Curriculum catalog is readable by all authenticated users)
CREATE POLICY "Catalog subjects readable by authenticated" ON public.subjects
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catalog topics readable by authenticated" ON public.topics
  FOR SELECT TO authenticated USING (true);

-- 6. Student Progress RLS
CREATE POLICY "View own subject progress or if teacher" ON public.student_subject_progress
  FOR SELECT TO authenticated USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );
CREATE POLICY "Manage own subject progress" ON public.student_subject_progress
  FOR ALL TO authenticated USING (student_id = auth.uid());

CREATE POLICY "View own topic progress or if teacher" ON public.student_topic_progress
  FOR SELECT TO authenticated USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );
CREATE POLICY "Manage own topic progress" ON public.student_topic_progress
  FOR ALL TO authenticated USING (student_id = auth.uid());

-- 7. Practice Attempts & Learning Sessions
CREATE POLICY "Students can manage own practice attempts" ON public.practice_attempts
  FOR ALL TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers can view student practice attempts" ON public.practice_attempts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Students can manage own learning sessions" ON public.learning_sessions
  FOR ALL TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers can view learning sessions" ON public.learning_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- 8. Recommendations
CREATE POLICY "Students can view own recommendations" ON public.recommendations
  FOR SELECT TO authenticated USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- 9. Interventions
CREATE POLICY "Teachers can manage interventions" ON public.interventions
  FOR ALL TO authenticated USING (
    teacher_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );
CREATE POLICY "Students can view assigned interventions" ON public.interventions
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- ==============================================================================
-- TRIGGER: Automatically synchronize auth.users -> public.profiles
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_app_meta_data->>'role', NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 14. DIAGNOSTIC ASSESSMENT TABLES
-- ==============================================================================

-- Ensure student_profiles has required fields
ALTER TABLE public.student_profiles 
  ADD COLUMN IF NOT EXISTS diagnostic_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT;

-- 14a. Diagnostic Questions Bank
CREATE TABLE IF NOT EXISTS public.diagnostic_questions (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 6),
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14b. Diagnostic Sessions
CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  initial_grade INTEGER NOT NULL DEFAULT 1,
  current_grade INTEGER NOT NULL DEFAULT 1,
  total_questions INTEGER NOT NULL DEFAULT 10,
  questions_answered INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 14c. Student Initial Assessment
CREATE TABLE IF NOT EXISTS public.student_initial_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
  estimated_grade_level NUMERIC(3,1) NOT NULL,
  overall_score INTEGER NOT NULL,
  subject_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  topic_strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  learning_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_first_practice_topic JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_dashboard_insight JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for diagnostic tables
ALTER TABLE public.diagnostic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_initial_assessment ENABLE ROW LEVEL SECURITY;

-- Policies for diagnostic_questions
CREATE POLICY "Diagnostic questions readable by authenticated users" ON public.diagnostic_questions
  FOR SELECT TO authenticated USING (true);

-- Policies for diagnostic_sessions
CREATE POLICY "Students can manage own diagnostic sessions" ON public.diagnostic_sessions
  FOR ALL TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers can view diagnostic sessions" ON public.diagnostic_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- Policies for student_initial_assessment
CREATE POLICY "Students can view and manage own initial assessment" ON public.student_initial_assessment
  FOR ALL TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers can view student initial assessments" ON public.student_initial_assessment
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- ==============================================================================
-- 15. LIVE PRACTICE COLUMNS ENHANCEMENT
-- ==============================================================================
ALTER TABLE public.student_topic_progress 
  ADD COLUMN IF NOT EXISTS accuracy_percent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_activity_date TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.student_subject_progress 
  ADD COLUMN IF NOT EXISTS trend TEXT DEFAULT 'steady',
  ADD COLUMN IF NOT EXISTS latest_activity_date TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.practice_attempts 
  ADD COLUMN IF NOT EXISTS subject_id TEXT,
  ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 5;

-- ==============================================================================
-- 16. SUPABASE REALTIME CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_attempts;
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_topic_progress;
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_subject_progress;
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recommendations;
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interventions;
  EXCEPTION WHEN others THEN NULL; END;
END $$;


