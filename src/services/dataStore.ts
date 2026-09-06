import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: string;
}

export interface StudentProfile {
  userId: string;
  name: string;
  initials: string;
  grade: string;
  school: string;
  district: string;
  dateOfBirth: string;
  learningLanguages: string[];
  favouriteSubject: string;
  preferredStudyTime: string;
}

export interface TeacherProfile {
  userId: string;
  name: string;
  initials: string;
  teacherId: string;
  school: string;
  district: string;
  primarySubject: string;
  teachingLevel: string;
}

export interface ClassInfo {
  id: string;
  teacherId: string;
  name: string;
  yearLevel: string;
  subject: string;
  studentCount: number;
}

export interface SubjectData {
  id: string;
  name: string;
  shortName?: string;
  score: number;
  mastery: number;
  learningMinutes: number;
  status: string;
  strength: string;
  topics: Array<{
    id: string;
    name: string;
    score: number;
    status: string;
    correctAnswers?: number;
    totalAnswers?: number;
    timeSpentMinutes?: number;
  }>;
  learningGaps: string[];
}

export interface StudentListItem {
  id: string;
  name: string;
  initials: string;
  primarySubject: string;
  learningMinutes: number;
  healthScore: number | null;
  status: 'thriving' | 'on track' | 'watch' | 'support' | 'Assessment pending' | 'Assessment completed';
  trend: 'up' | 'steady' | 'down';
  classId?: string;
  className?: string;
}

export interface InterventionItem {
  id: string;
  studentId: string;
  studentName?: string;
  status: 'problem' | 'review' | 'complete';
  classification: string;
  subject: string;
  topic: string;
  healthScore: number;
  topicScore: number | string;
  learningMinutes: number | string;
  recommendation: string;
  plan?: string;
  reviewDueDate?: string;
  createdAt: string;
}

export interface PracticeAttempt {
  id: string;
  studentId: string;
  topic: string;
  level: number;
  question: string;
  studentAnswer?: number | string;
  submittedAnswer?: string;
  correctAnswer: number | string;
  isCorrect: boolean;
  timeSpentSeconds: number;
  attemptedAt: string;
}

class DataStore {
  private dataFilePath = path.resolve(process.cwd(), 'data', 'app-data.json');
  public data: {
    users: User[];
    studentProfiles: Record<string, StudentProfile>;
    teacherProfiles: Record<string, TeacherProfile>;
    classes: ClassInfo[];
    subjects: SubjectData[];
    students: StudentListItem[];
    interventions: InterventionItem[];
    practiceAttempts: PracticeAttempt[];
    dashboard: any;
    classDashboard: any;
    recommendations: any[];
    recentActivity: any[];
    assignedInterventionStudents: string[];
  } = {
    users: [],
    studentProfiles: {},
    teacherProfiles: {},
    classes: [],
    subjects: [],
    students: [],
    interventions: [],
    practiceAttempts: [],
    dashboard: {},
    classDashboard: {},
    recommendations: [],
    recentActivity: [],
    assignedInterventionStudents: []
  };

  constructor() {
    this.init();
  }

  private init() {
    // Ensure data directory exists
    const dir = path.dirname(this.dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.load();
  }

  public load() {
    if (fs.existsSync(this.dataFilePath)) {
      try {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        this.data = JSON.parse(raw);
        return;
      } catch (err) {
        console.warn('Failed to parse app-data.json, starting with clean zero-data state.');
      }
    }
    this.resetToZero();
  }

  public resetToZero() {
    this.data = {
      users: [],
      studentProfiles: {},
      teacherProfiles: {},
      classes: [],
      subjects: [],
      students: [],
      interventions: [],
      practiceAttempts: [],
      dashboard: {},
      classDashboard: {},
      recommendations: [],
      recentActivity: [],
      assignedInterventionStudents: []
    };
  }

  public save() {
    try {
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving data store:', e);
    }
  }

  public seedFromDemoData() {
    // Disabled: starting localhost with zero student and teacher data
  }
}

export const dataStore = new DataStore();
export default dataStore;
