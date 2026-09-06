export interface DemoStudentProfile {
  id: string;
  userId: string;
  name: string;
  initials: string;
  grade: string;
  school: string;
  district: string;
  dateOfBirth: string;
  learningLanguages: string[];
  preferredLanguage: string;
  favouriteSubject: string;
  preferredStudyTime: string;
  activities: string[];
  is_demo: boolean;
  is_demo_account: boolean;
  profile_completed: boolean;
  diagnostic_completed: boolean;
  onboarding_completed: boolean;
  quick_test_completed: boolean;
  classId: string;
  className: string;
  overallPerformance: number;
  healthScore: number;
  learningStreakDays: number;
  studyActivityMinutes: number;
  studyActivityFormatted: string;
  practiceRoundsCompleted: number;
  primarySubject: string;
  status: 'thriving' | 'on track' | 'watch' | 'support';
  trend: 'up' | 'steady' | 'down';
  trendSymbol: string;
}

export interface DemoTopic {
  id: string;
  name: string;
  score: number;
  status: 'Strong' | 'Developing' | 'Needs focus';
  attempts?: number;
  timeSpentMinutes?: number;
  teacherNote?: string;
}

export interface DemoSubject {
  id: string;
  name: string;
  score: number;
  learningTimeFormatted: string;
  learningMinutes: number;
  trend: string;
  strongestSubtopic: string;
  nextFocus: string;
  priorityNote?: string;
  topics: DemoTopic[];
  learningGaps: string[];
}

export interface DemoIntervention {
  studentName: string;
  classification: string;
  focus: string;
  health: number;
  topic: string;
  time: string;
  description: string;
  plan: string;
}

export interface DemoTeacherProfile {
  id: string;
  userId: string;
  name: string;
  initials: string;
  teacherId: string;
  school: string;
  district: string;
  className: string;
  primarySubject: string;
  teachingLevel: string;
  interventionStyle: string;
  reportFrequency: string;
  is_demo: boolean;
}

export interface DemoClass {
  id: string;
  name: string;
  teacher_id: string;
  yearLevel: string;
  subject: string;
  studentCount: number;
  is_demo: boolean;
}

// ----------------------------------------------------
// INITIAL STATIC BASELINES (COPIED FROM index.html)
// ----------------------------------------------------

export const INITIAL_DEMO_TEACHER: DemoTeacherProfile = {
  id: 'demo-teacher-liyana',
  userId: 'demo-teacher-liyana',
  name: 'Ms. Liyana Karim',
  initials: 'LK',
  teacherId: 'TCH-2026-015',
  school: 'Sekolah Kebangsaan Maju Jaya',
  district: 'Kuala Lumpur',
  className: '5 Cemerlang',
  primarySubject: 'Mathematics',
  teachingLevel: 'Primary Level / Grade 5',
  interventionStyle: 'Small-group guided practice',
  reportFrequency: 'Weekly',
  is_demo: true
};

export const INITIAL_DEMO_CLASS: DemoClass = {
  id: 'demo-class-5-cemerlang',
  name: '5 Cemerlang',
  teacher_id: 'demo-teacher-liyana',
  yearLevel: 'Grade 5',
  subject: 'Mathematics',
  studentCount: 10,
  is_demo: true
};

export const INITIAL_ADAM_PROFILE: DemoStudentProfile = {
  id: 'demo-student-adam',
  userId: 'demo-student-adam',
  name: 'Adam Haziq',
  initials: 'AH',
  grade: 'Grade 5',
  school: 'Sekolah Kebangsaan Maju Jaya',
  district: 'Kuala Lumpur',
  dateOfBirth: '2014-03-18',
  learningLanguages: ['Bahasa Melayu', 'English'],
  preferredLanguage: 'English',
  favouriteSubject: 'Science',
  preferredStudyTime: '7:00 PM',
  activities: ['Science experiments', 'Problem solving', 'Reading', 'Creative work', 'Sports', 'Music'],
  is_demo: true,
  is_demo_account: true,
  profile_completed: true,
  diagnostic_completed: true,
  onboarding_completed: true,
  quick_test_completed: true,
  classId: 'demo-class-5-cemerlang',
  className: '5 Cemerlang',
  overallPerformance: 84,
  healthScore: 84,
  learningStreakDays: 12,
  studyActivityMinutes: 385,
  studyActivityFormatted: '6h 25m',
  practiceRoundsCompleted: 24,
  primarySubject: 'Mathematics',
  status: 'thriving',
  trend: 'up',
  trendSymbol: '↗'
};

export const INITIAL_CLASSMATES: DemoStudentProfile[] = [
  {
    "id": "demo-student-omar",
    "userId": "demo-student-omar",
    "name": "Omar P.",
    "initials": "OP",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-05-12",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "5:00 PM",
    "activities": [
      "Sports",
      "Problem solving"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 52,
    "healthScore": 47,
    "learningStreakDays": 3,
    "studyActivityMinutes": 38,
    "studyActivityFormatted": "38m",
    "practiceRoundsCompleted": 6,
    "primarySubject": "Mathematics",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-chong",
    "userId": "demo-student-chong",
    "name": "Chong L.",
    "initials": "CL",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-08-20",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "4:00 PM",
    "activities": [
      "Music",
      "Problem solving"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 54,
    "healthScore": 48,
    "learningStreakDays": 4,
    "studyActivityMinutes": 41,
    "studyActivityFormatted": "41m",
    "practiceRoundsCompleted": 7,
    "primarySubject": "Mathematics",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-oliver",
    "userId": "demo-student-oliver",
    "name": "Oliver B.",
    "initials": "OB",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-02-14",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "English",
    "preferredStudyTime": "6:00 PM",
    "activities": [
      "Reading"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 56,
    "healthScore": 49,
    "learningStreakDays": 2,
    "studyActivityMinutes": 35,
    "studyActivityFormatted": "35m",
    "practiceRoundsCompleted": 5,
    "primarySubject": "English",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-aziz",
    "userId": "demo-student-aziz",
    "name": "Aziz M.",
    "initials": "AM",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-06-15",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "6:00 PM",
    "activities": [
      "Sports",
      "Problem solving"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 58,
    "healthScore": 50,
    "learningStreakDays": 2,
    "studyActivityMinutes": 45,
    "studyActivityFormatted": "45m",
    "practiceRoundsCompleted": 5,
    "primarySubject": "Mathematics",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-dewi",
    "userId": "demo-student-dewi",
    "name": "Dewi R.",
    "initials": "DR",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-03-20",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "4:30 PM",
    "activities": [
      "Sports",
      "Problem solving"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 55,
    "healthScore": 48,
    "learningStreakDays": 3,
    "studyActivityMinutes": 50,
    "studyActivityFormatted": "50m",
    "practiceRoundsCompleted": 6,
    "primarySubject": "Mathematics",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-haris",
    "userId": "demo-student-haris",
    "name": "Haris F.",
    "initials": "HF",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-07-09",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Bahasa Melayu",
    "preferredStudyTime": "5:30 PM",
    "activities": [
      "Reading",
      "Sports"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 50,
    "healthScore": 46,
    "learningStreakDays": 1,
    "studyActivityMinutes": 32,
    "studyActivityFormatted": "32m",
    "practiceRoundsCompleted": 4,
    "primarySubject": "Bahasa Melayu",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-priya",
    "userId": "demo-student-priya",
    "name": "Priya K.",
    "initials": "PK",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-10-18",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "6:00 PM",
    "activities": [
      "Music",
      "Problem solving"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 57,
    "healthScore": 51,
    "learningStreakDays": 3,
    "studyActivityMinutes": 44,
    "studyActivityFormatted": "44m",
    "practiceRoundsCompleted": 5,
    "primarySubject": "Mathematics",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-meiling",
    "userId": "demo-student-meiling",
    "name": "Mei Ling",
    "initials": "ML",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-01-29",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "English",
    "preferredStudyTime": "4:00 PM",
    "activities": [
      "Reading",
      "Creative work"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 53,
    "healthScore": 49,
    "learningStreakDays": 2,
    "studyActivityMinutes": 36,
    "studyActivityFormatted": "36m",
    "practiceRoundsCompleted": 6,
    "primarySubject": "English",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-danish",
    "userId": "demo-student-danish",
    "name": "Danish A.",
    "initials": "DA",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-04-03",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Science",
    "preferredStudyTime": "5:00 PM",
    "activities": [
      "Science experiments"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 59,
    "healthScore": 52,
    "learningStreakDays": 3,
    "studyActivityMinutes": 40,
    "studyActivityFormatted": "40m",
    "practiceRoundsCompleted": 7,
    "primarySubject": "Science",
    "status": "support",
    "trend": "down",
    "trendSymbol": "↘"
  },
  {
    "id": "demo-student-sofia",
    "userId": "demo-student-sofia",
    "name": "Sofia R.",
    "initials": "SR",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-04-25",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "English",
    "preferredStudyTime": "7:00 PM",
    "activities": [
      "Reading",
      "Creative work"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 85,
    "healthScore": 86,
    "learningStreakDays": 14,
    "studyActivityMinutes": 161,
    "studyActivityFormatted": "2h 41m",
    "practiceRoundsCompleted": 20,
    "primarySubject": "English",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-jin",
    "userId": "demo-student-jin",
    "name": "Jin L.",
    "initials": "JL",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-11-05",
    "learningLanguages": [
      "Bahasa Melayu",
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Science",
    "preferredStudyTime": "7:00 PM",
    "activities": [
      "Science experiments"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 70,
    "healthScore": 68,
    "learningStreakDays": 7,
    "studyActivityMinutes": 68,
    "studyActivityFormatted": "1h 08m",
    "practiceRoundsCompleted": 12,
    "primarySubject": "Science",
    "status": "watch",
    "trend": "steady",
    "trendSymbol": "→"
  },
  {
    "id": "demo-student-bala",
    "userId": "demo-student-bala",
    "name": "Bala Q.",
    "initials": "BQ",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-09-10",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Science",
    "preferredStudyTime": "5:30 PM",
    "activities": [
      "Science experiments",
      "Reading"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 62,
    "healthScore": 55,
    "learningStreakDays": 4,
    "studyActivityMinutes": 70,
    "studyActivityFormatted": "1h 10m",
    "practiceRoundsCompleted": 8,
    "primarySubject": "Science",
    "status": "watch",
    "trend": "steady",
    "trendSymbol": "→"
  },
  {
    "id": "demo-student-cara",
    "userId": "demo-student-cara",
    "name": "Cara L.",
    "initials": "CL",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-12-01",
    "learningLanguages": [
      "Bahasa Melayu",
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "English",
    "preferredStudyTime": "7:30 PM",
    "activities": [
      "Reading",
      "Creative work"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 70,
    "healthScore": 68,
    "learningStreakDays": 6,
    "studyActivityMinutes": 120,
    "studyActivityFormatted": "2h 0m",
    "practiceRoundsCompleted": 12,
    "primarySubject": "English",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-siti",
    "userId": "demo-student-siti",
    "name": "Siti N.",
    "initials": "SN",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-06-11",
    "learningLanguages": [
      "Bahasa Melayu",
      "English"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Bahasa Melayu",
    "preferredStudyTime": "8:00 PM",
    "activities": [
      "Reading",
      "Creative work"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 91,
    "healthScore": 92,
    "learningStreakDays": 16,
    "studyActivityMinutes": 210,
    "studyActivityFormatted": "3h 30m",
    "practiceRoundsCompleted": 26,
    "primarySubject": "Bahasa Melayu",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-farhan",
    "userId": "demo-student-farhan",
    "name": "Farhan M.",
    "initials": "FM",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-03-14",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "6:30 PM",
    "activities": [
      "Problem solving",
      "Sports"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 79,
    "healthScore": 78,
    "learningStreakDays": 9,
    "studyActivityMinutes": 145,
    "studyActivityFormatted": "2h 25m",
    "practiceRoundsCompleted": 18,
    "primarySubject": "Mathematics",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-aisyah",
    "userId": "demo-student-aisyah",
    "name": "Aisyah Z.",
    "initials": "AZ",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-08-30",
    "learningLanguages": [
      "English",
      "Bahasa Melayu"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Science",
    "preferredStudyTime": "7:00 PM",
    "activities": [
      "Science experiments",
      "Reading"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 87,
    "healthScore": 88,
    "learningStreakDays": 15,
    "studyActivityMinutes": 180,
    "studyActivityFormatted": "3h 0m",
    "practiceRoundsCompleted": 22,
    "primarySubject": "Science",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-ryan",
    "userId": "demo-student-ryan",
    "name": "Ryan T.",
    "initials": "RT",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-10-04",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "English",
    "preferredStudyTime": "5:00 PM",
    "activities": [
      "Reading",
      "Sports"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 82,
    "healthScore": 81,
    "learningStreakDays": 11,
    "studyActivityMinutes": 155,
    "studyActivityFormatted": "2h 35m",
    "practiceRoundsCompleted": 19,
    "primarySubject": "English",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-zachary",
    "userId": "demo-student-zachary",
    "name": "Zachary W.",
    "initials": "ZW",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-05-19",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "7:00 PM",
    "activities": [
      "Problem solving",
      "Creative work"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 83,
    "healthScore": 84,
    "learningStreakDays": 13,
    "studyActivityMinutes": 170,
    "studyActivityFormatted": "2h 50m",
    "practiceRoundsCompleted": 21,
    "primarySubject": "Mathematics",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-nurul",
    "userId": "demo-student-nurul",
    "name": "Nurul H.",
    "initials": "NH",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-09-02",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Bahasa Melayu",
    "preferredStudyTime": "6:00 PM",
    "activities": [
      "Reading"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 76,
    "healthScore": 75,
    "learningStreakDays": 8,
    "studyActivityMinutes": 130,
    "studyActivityFormatted": "2h 10m",
    "practiceRoundsCompleted": 16,
    "primarySubject": "Bahasa Melayu",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-haziqb",
    "userId": "demo-student-haziqb",
    "name": "Haziq B.",
    "initials": "HB",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-02-28",
    "learningLanguages": [
      "Bahasa Melayu",
      "English"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Science",
    "preferredStudyTime": "7:30 PM",
    "activities": [
      "Science experiments",
      "Sports"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 78,
    "healthScore": 79,
    "learningStreakDays": 10,
    "studyActivityMinutes": 140,
    "studyActivityFormatted": "2h 20m",
    "practiceRoundsCompleted": 17,
    "primarySubject": "Science",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-kavitha",
    "userId": "demo-student-kavitha",
    "name": "Kavitha S.",
    "initials": "KS",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-11-14",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "English",
    "preferredStudyTime": "6:30 PM",
    "activities": [
      "Reading",
      "Music"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 81,
    "healthScore": 82,
    "learningStreakDays": 12,
    "studyActivityMinutes": 165,
    "studyActivityFormatted": "2h 45m",
    "practiceRoundsCompleted": 20,
    "primarySubject": "English",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-luqman",
    "userId": "demo-student-luqman",
    "name": "Luqman H.",
    "initials": "LH",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-07-22",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "5:30 PM",
    "activities": [
      "Problem solving"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 75,
    "healthScore": 76,
    "learningStreakDays": 8,
    "studyActivityMinutes": 135,
    "studyActivityFormatted": "2h 15m",
    "practiceRoundsCompleted": 15,
    "primarySubject": "Mathematics",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-sarah",
    "userId": "demo-student-sarah",
    "name": "Sarah J.",
    "initials": "SJ",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-04-16",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Science",
    "preferredStudyTime": "7:00 PM",
    "activities": [
      "Science experiments",
      "Creative work"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 90,
    "healthScore": 89,
    "learningStreakDays": 15,
    "studyActivityMinutes": 195,
    "studyActivityFormatted": "3h 15m",
    "practiceRoundsCompleted": 25,
    "primarySubject": "Science",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-chloe",
    "userId": "demo-student-chloe",
    "name": "Chloe T.",
    "initials": "CT",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-08-08",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "English",
    "preferredStudyTime": "6:00 PM",
    "activities": [
      "Reading"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 84,
    "healthScore": 85,
    "learningStreakDays": 13,
    "studyActivityMinutes": 175,
    "studyActivityFormatted": "2h 55m",
    "practiceRoundsCompleted": 22,
    "primarySubject": "English",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-imran",
    "userId": "demo-student-imran",
    "name": "Imran K.",
    "initials": "IK",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-01-15",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Bahasa Melayu",
    "preferredStudyTime": "5:00 PM",
    "activities": [
      "Sports",
      "Creative work"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 73,
    "healthScore": 72,
    "learningStreakDays": 7,
    "studyActivityMinutes": 115,
    "studyActivityFormatted": "1h 55m",
    "practiceRoundsCompleted": 14,
    "primarySubject": "Bahasa Melayu",
    "status": "watch",
    "trend": "steady",
    "trendSymbol": "→"
  },
  {
    "id": "demo-student-amirul",
    "userId": "demo-student-amirul",
    "name": "Amirul R.",
    "initials": "AR",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-06-27",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "6:00 PM",
    "activities": [
      "Problem solving",
      "Sports"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 74,
    "healthScore": 74,
    "learningStreakDays": 8,
    "studyActivityMinutes": 125,
    "studyActivityFormatted": "2h 05m",
    "practiceRoundsCompleted": 15,
    "primarySubject": "Mathematics",
    "status": "watch",
    "trend": "steady",
    "trendSymbol": "→"
  },
  {
    "id": "demo-student-natasha",
    "userId": "demo-student-natasha",
    "name": "Natasha E.",
    "initials": "NE",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-03-05",
    "learningLanguages": [
      "English",
      "Bahasa Melayu"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Science",
    "preferredStudyTime": "7:00 PM",
    "activities": [
      "Science experiments"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 83,
    "healthScore": 83,
    "learningStreakDays": 11,
    "studyActivityMinutes": 160,
    "studyActivityFormatted": "2h 40m",
    "practiceRoundsCompleted": 19,
    "primarySubject": "Science",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-weikang",
    "userId": "demo-student-weikang",
    "name": "Wei Kang",
    "initials": "WK",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-12-10",
    "learningLanguages": [
      "English"
    ],
    "preferredLanguage": "English",
    "favouriteSubject": "Mathematics",
    "preferredStudyTime": "6:30 PM",
    "activities": [
      "Problem solving",
      "Music"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 81,
    "healthScore": 80,
    "learningStreakDays": 10,
    "studyActivityMinutes": 150,
    "studyActivityFormatted": "2h 30m",
    "practiceRoundsCompleted": 18,
    "primarySubject": "Mathematics",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  },
  {
    "id": "demo-student-fatimah",
    "userId": "demo-student-fatimah",
    "name": "Fatimah Y.",
    "initials": "FY",
    "grade": "Grade 5",
    "school": "Sekolah Kebangsaan Maju Jaya",
    "district": "Kuala Lumpur",
    "dateOfBirth": "2014-05-01",
    "learningLanguages": [
      "Bahasa Melayu"
    ],
    "preferredLanguage": "Bahasa Melayu",
    "favouriteSubject": "Bahasa Melayu",
    "preferredStudyTime": "7:30 PM",
    "activities": [
      "Reading",
      "Creative work"
    ],
    "is_demo": true,
    "is_demo_account": true,
    "profile_completed": true,
    "diagnostic_completed": true,
    "onboarding_completed": true,
    "quick_test_completed": true,
    "classId": "demo-class-5-cemerlang",
    "className": "5 Cemerlang",
    "overallPerformance": 88,
    "healthScore": 87,
    "learningStreakDays": 14,
    "studyActivityMinutes": 185,
    "studyActivityFormatted": "3h 05m",
    "practiceRoundsCompleted": 23,
    "primarySubject": "Bahasa Melayu",
    "status": "thriving",
    "trend": "up",
    "trendSymbol": "↗"
  }
];

export const INITIAL_ADAM_SUBJECTS: DemoSubject[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    score: 70,
    learningTimeFormatted: '11h 23m',
    learningMinutes: 683,
    trend: '↑ 8%',
    strongestSubtopic: 'Addition',
    nextFocus: 'Subtraction',
    priorityNote: 'You are quick and accurate when combining numbers. Try subtraction next to build confidence.',
    topics: [
      { id: 'addition', name: 'Addition', score: 88, status: 'Strong', attempts: 10, timeSpentMinutes: 105, teacherNote: 'Strong foundation' },
      { id: 'subtraction', name: 'Subtraction', score: 54, status: 'Needs focus', attempts: 6, timeSpentMinutes: 48, teacherNote: 'Recommended guided practice' },
      { id: 'multiplication', name: 'Multiplication', score: 62, status: 'Developing', attempts: 4, timeSpentMinutes: 45, teacherNote: 'Developing' },
      { id: 'division', name: 'Division', score: 58, status: 'Needs focus', attempts: 4, timeSpentMinutes: 38, teacherNote: 'Needs more repetition' }
    ],
    learningGaps: ['Subtraction', 'Multiplication', 'Division']
  },
  {
    id: 'bahasa-melayu',
    name: 'Bahasa Melayu',
    score: 67,
    learningTimeFormatted: '1h 12m',
    learningMinutes: 72,
    trend: '↑ 3%',
    strongestSubtopic: 'Kata nama',
    nextFocus: 'Penanda wacana',
    priorityNote: 'You recognise nouns very well. Short practice sessions can help strengthen sentence connections.',
    topics: [
      { id: 'kata-nama', name: 'Kata nama', score: 81, status: 'Strong', attempts: 3, timeSpentMinutes: 25, teacherNote: 'Good noun identification' },
      { id: 'kata-kerja', name: 'Kata kerja', score: 70, status: 'Strong', attempts: 2, timeSpentMinutes: 18, teacherNote: 'Adequate verbs usage' },
      { id: 'ayat-majmuk', name: 'Ayat majmuk', score: 59, status: 'Needs focus', attempts: 2, timeSpentMinutes: 15, teacherNote: 'Work on conjunctions' },
      { id: 'penanda-wacana', name: 'Penanda wacana', score: 55, status: 'Needs focus', attempts: 2, timeSpentMinutes: 14, teacherNote: 'Needs focus' }
    ],
    learningGaps: ['Penanda wacana', 'Ayat majmuk']
  },
  {
    id: 'english',
    name: 'English',
    score: 67,
    learningTimeFormatted: '1h 22m',
    learningMinutes: 82,
    trend: '↑ 4%',
    strongestSubtopic: 'Reading comprehension',
    nextFocus: 'Essay evidence',
    priorityNote: 'You understand what you read clearly. Build your score by adding stronger evidence to your writing.',
    topics: [
      { id: 'reading-comprehension', name: 'Reading comprehension', score: 78, status: 'Strong', attempts: 3, timeSpentMinutes: 28, teacherNote: 'Strong literal comprehension' },
      { id: 'vocabulary', name: 'Vocabulary', score: 73, status: 'Strong', attempts: 2, timeSpentMinutes: 22, teacherNote: 'Good vocabulary' },
      { id: 'sentence-structure', name: 'Sentence structure', score: 62, status: 'Developing', attempts: 2, timeSpentMinutes: 18, teacherNote: 'Developing complex sentences' },
      { id: 'essay-evidence', name: 'Essay evidence', score: 55, status: 'Needs focus', attempts: 2, timeSpentMinutes: 14, teacherNote: 'Needs text evidence citation' }
    ],
    learningGaps: ['Evidence in essays', 'Sentence structure']
  },
  {
    id: 'science',
    name: 'Science',
    score: 90,
    learningTimeFormatted: '2h 30m',
    learningMinutes: 150,
    trend: '↑ 10%',
    strongestSubtopic: 'Living things',
    nextFocus: 'Investigation questions',
    priorityNote: 'Excellent scientific thinking. You are ready to explore more challenging investigation questions.',
    topics: [
      { id: 'living-things', name: 'Living things', score: 94, status: 'Strong', attempts: 4, timeSpentMinutes: 45, teacherNote: 'Excellent grasp of living systems' },
      { id: 'cell-structure', name: 'Cell structure', score: 90, status: 'Strong', attempts: 3, timeSpentMinutes: 38, teacherNote: 'High accuracy' },
      { id: 'matter', name: 'Matter', score: 88, status: 'Strong', attempts: 3, timeSpentMinutes: 35, teacherNote: 'Strong concepts' },
      { id: 'energy-transfer', name: 'Energy transfer', score: 87, status: 'Strong', attempts: 3, timeSpentMinutes: 32, teacherNote: 'Strong transfer concepts' }
    ],
    learningGaps: ['Cell structure', 'Energy transfer']
  }
];

export const INITIAL_DEMO_INTERVENTIONS = {
  problem: [
    {
      name: 'Adam Haziq',
      classification: 'Low Mathematics performance',
      health: 68,
      topic: '60%',
      time: '40 min',
      description: 'Jin needs confidence building in science labs.',
      plan: 'Organize a guided experiment session.'
    },
    {
      name: 'Sofia R.',
      classification: 'Low English writing',
      focus: 'Essay evidence',
      health: 86,
      topic: '84%',
      time: '45 min',
      description: 'Sofia requires practice on supporting evidence in essays.',
      plan: 'Assign a structured essay writing workshop.'
    },
    {
      name: 'Aziz M.',
      classification: 'Low Mathematics performance',
      focus: 'Multiplication',
      health: 55,
      topic: '50%',
      time: '35 min',
      description: 'Aziz struggles with multiplication facts.',
      plan: 'Provide flashcard drills and timed practice.'
    },
    {
      name: 'Bala Q.',
      classification: 'Low Science curiosity',
      focus: 'Energy transfer',
      health: 58,
      topic: '55%',
      time: '38 min',
      description: 'Bala needs more engagement in energy concepts.',
      plan: 'Run interactive simulations.'
    },
    {
      name: 'Cara L.',
      classification: 'Low English reading',
      focus: 'Reading comprehension',
      health: 70,
      topic: '65%',
      time: '30 min',
      description: 'Cara needs to improve reading speed and comprehension.',
      plan: 'Assign daily reading passages with questions.'
    },
    {
      name: 'Dewi R.',
      classification: 'Low Mathematics performance',
      focus: 'Division',
      health: 52,
      topic: '48%',
      time: '42 min',
      description: 'Dewi finds division challenging.',
      plan: 'Conduct division practice games.'
    },
    // Additional entries to reach 30 total (repeating patterns)
    {
      name: 'Adam Haziq',
      classification: 'Low Mathematics performance',
      focus: 'Subtraction',
      health: 70,
      topic: '70%',
      time: '30 min',
      description: 'Additional support needed for subtraction.',
      plan: 'Short subtraction drills.'
    },
    {
      name: 'Omar P.',
      classification: 'Low Mathematics performance',
      focus: 'Multiplication',
      health: 47,
      topic: '54%',
      time: '38 min',
      description: 'Focus on multiplication basics.',
      plan: 'Multiplication practice session.'
    },
    {
      name: 'Chong L.',
      classification: 'Low topic mastery',
      focus: 'Division',
      health: 48,
      topic: '52%',
      time: '41 min',
      description: 'Division needs reinforcement.',
      plan: 'Division exercises.'
    },
    {
      name: 'Oliver B.',
      classification: 'Low engagement',
      focus: 'Creative writing',
      health: 49,
      topic: '58%',
      time: '35 min',
      description: 'Encourage creative expression.',
      plan: 'Writing prompts workshop.'
    },
    {
      name: 'Jin L.',
      classification: 'Low Science confidence',
      focus: 'Cell structure',
      health: 68,
      topic: '60%',
      time: '40 min',
      description: 'Deepen understanding of cells.',
      plan: 'Cell model activity.'
    },
    {
      name: 'Sofia R.',
      classification: 'Low English writing',
      focus: 'Sentence structure',
      health: 86,
      topic: '84%',
      time: '45 min',
      description: 'Improve sentence complexity.',
      plan: 'Sentence building exercises.'
    },
    {
      name: 'Aziz M.',
      classification: 'Low Mathematics performance',
      focus: 'Division',
      health: 55,
      topic: '50%',
      time: '35 min',
      description: 'Division practice needed.',
      plan: 'Division worksheets.'
    },
    {
      name: 'Bala Q.',
      classification: 'Low Science curiosity',
      focus: 'Matter',
      health: 58,
      topic: '55%',
      time: '38 min',
      description: 'Explore matter concepts.',
      plan: 'Hands‑on experiments.'
    },
    {
      name: 'Cara L.',
      classification: 'Low English reading',
      focus: 'Vocabulary',
      health: 70,
      topic: '65%',
      time: '30 min',
      description: 'Expand vocabulary range.',
      plan: 'Word games and flashcards.'
    },
    {
      name: 'Dewi R.',
      classification: 'Low Mathematics performance',
      focus: 'Multiplication',
      health: 52,
      topic: '48%',
      time: '42 min',
      description: 'Multiplication practice required.',
      plan: 'Timed multiplication drills.'
    },
    {
      name: 'Adam Haziq',
      classification: 'Low Mathematics performance',
      focus: 'Division',
      health: 70,
      topic: '70%',
      time: '30 min',
      description: 'Division support needed.',
      plan: 'Division tutorial.'
    },
    {
      name: 'Omar P.',
      classification: 'Low Mathematics performance',
      focus: 'Addition',
      health: 47,
      topic: '54%',
      time: '38 min',
      description: 'Addition basics review.',
      plan: 'Addition practice.'
    },
    {
      name: 'Chong L.',
      classification: 'Low topic mastery',
      focus: 'Multiplication',
      health: 48,
      topic: '52%',
      time: '41 min',
      description: 'Multiplication focus.',
      plan: 'Multiplication drills.'
    },
    {
      name: 'Oliver B.',
      classification: 'Low engagement',
      focus: 'Reading comprehension',
      health: 49,
      topic: '58%',
      time: '35 min',
      description: 'Improve reading comprehension.',
      plan: 'Comprehension exercises.'
    },
    {
      name: 'Jin L.',
      classification: 'Low Science confidence',
      focus: 'Energy transfer',
      health: 68,
      topic: '60%',
      time: '40 min',
      description: 'Energy concepts clarity.',
      plan: 'Energy transfer lab.'
    },
    {
      name: 'Sofia R.',
      classification: 'Low English writing',
      focus: 'Essay evidence',
      health: 86,
      topic: '84%',
      time: '45 min',
      description: 'Strengthen essay evidence.',
      plan: 'Evidence gathering workshop.'
    },
    {
      name: 'Aziz M.',
      classification: 'Low Mathematics performance',
      focus: 'Addition',
      health: 55,
      topic: '50%',
      time: '35 min',
      description: 'Addition practice needed.',
      plan: 'Addition drills.'
    },
    {
      name: 'Bala Q.',
      classification: 'Low Science curiosity',
      focus: 'Science experiments',
      health: 58,
      topic: '55%',
      time: '38 min',
      description: 'Engage in hands‑on experiments.',
      plan: 'Interactive labs.'
    },
    {
      name: 'Cara L.',
      classification: 'Low English reading',
      focus: 'Reading comprehension',
      health: 70,
      topic: '65%',
      time: '30 min',
      description: 'Boost reading comprehension.',
      plan: 'Reading sessions.'
    },
    {
      name: 'Dewi R.',
      classification: 'Low Mathematics performance',
      focus: 'Addition',
      health: 52,
      topic: '48%',
      time: '42 min',
      description: 'Addition basics reinforcement.',
      plan: 'Addition exercises.'
    },
    {
      name: 'Adam Haziq',
      classification: 'Low Mathematics performance',
      focus: 'Multiplication',
      health: 68,
      topic: '65%',
      time: '35 min',
      description: 'Multiplication skills need reinforcement.',
      plan: 'Multiplication drills.'
    },
    {
      name: 'Sofia R.',
      classification: 'Low English writing',
      focus: 'Grammar',
      health: 86,
      topic: '80%',
      time: '40 min',
      description: 'Grammar practice required.',
      plan: 'Grammar exercises.'
    },
    {
      name: 'Aziz M.',
      classification: 'Low Mathematics performance',
      focus: 'Subtraction',
      health: 55,
      topic: '55%',
      time: '38 min',
      description: 'Subtraction practice needed.',
      plan: 'Subtraction worksheets.'
    },
    {
      name: 'Bala Q.',
      classification: 'Low Science curiosity',
      focus: 'Physics concepts',
      health: 58,
      topic: '60%',
      time: '45 min',
      description: 'Introduce basic physics.',
      plan: 'Physics demo activities.'
    }
  ],
  review: [
    {
      name: 'Adam Haziq',
      classification: 'Review due',
      focus: 'Maths + Science plan',
      health: 84,
      topic: '54%',
      time: '6h 25m',
      description: 'Adam’s extension-and-support plan is ready for teacher review this week.',
      plan: 'Review his Science extension activity and confirm whether the weekly subtraction support can continue or be adjusted.'
    },
    {
      name: 'Omar P.',
      classification: 'Review due',
      focus: 'Subtraction plan',
      health: 47,
      topic: '54%',
      time: '38 min',
      description: 'Omar’s guided subtraction plan needs a progress review.',
      plan: 'Compare his new subtraction answers with the baseline, then extend the plan if accuracy remains below 60%.'
    },
    {
      name: 'Chong L.',
      classification: 'Review due',
      focus: 'Visual Maths activity',
      health: 48,
      topic: '52%',
      time: '41 min',
      description: 'Chong’s visual activity plan is due for a teacher review.',
      plan: 'Check whether visual supports improved accuracy before moving to mixed subtraction questions.'
    }
  ],
  complete: [
    {
      name: 'Adam Haziq',
      classification: 'Complete check',
      focus: 'Science extension',
      health: 84,
      topic: '90%',
      time: '6h 25m',
      description: 'Adam completed a Science extension task and is ready for a teacher check.',
      plan: 'Review the extension task, celebrate progress, and assign the next Science challenge.'
    },
    {
      name: 'Jin L.',
      classification: 'Complete check',
      focus: 'Science confidence practice',
      health: 68,
      topic: '72%',
      time: '1h 08m',
      description: 'Jin completed the planned confidence practice this week.',
      plan: 'Review the completed questions and set one realistic next learning goal.'
    },
    {
      name: 'Sofia R.',
      classification: 'Complete check',
      focus: 'English writing task',
      health: 86,
      topic: '84%',
      time: '2h 41m',
      description: 'Sofia completed her English writing practice successfully.',
      plan: 'Provide short feedback and offer a more challenging evidence-writing activity.'
    }
  ]
};

// ----------------------------------------------------
// STATEFUL DEMO DATA SERVICE (SINGLE SOURCE OF TRUTH)
// ----------------------------------------------------

class DemoDataService {
  public teacher = { ...INITIAL_DEMO_TEACHER };
  public demoClass = { ...INITIAL_DEMO_CLASS };
  public adam = { ...INITIAL_ADAM_PROFILE };
  public classmates = INITIAL_CLASSMATES.map(c => ({ ...c }));
  public subjects = JSON.parse(JSON.stringify(INITIAL_ADAM_SUBJECTS)) as DemoSubject[];
  public interventions = JSON.parse(JSON.stringify(INITIAL_DEMO_INTERVENTIONS));
  public assignedInterventionStudents: Set<string> = new Set();
  public practiceAttempts: any[] = [];

  constructor() {
    this.resetDemoData();
  }

  public resetDemoData() {
    this.teacher = { ...INITIAL_DEMO_TEACHER };
    this.demoClass = { ...INITIAL_DEMO_CLASS };
    this.adam = { ...INITIAL_ADAM_PROFILE };
    this.classmates = INITIAL_CLASSMATES.map(c => ({ ...c }));
    this.subjects = JSON.parse(JSON.stringify(INITIAL_ADAM_SUBJECTS));
    this.interventions = JSON.parse(JSON.stringify(INITIAL_DEMO_INTERVENTIONS));
    this.assignedInterventionStudents = new Set();
    this.practiceAttempts = [
      {
        id: 'demo-att-001',
        topic: 'subtraction',
        subject: 'Mathematics',
        score: 54,
        isCorrect: false,
        timeSpentSeconds: 45,
        attemptedAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'demo-att-002',
        topic: 'cell-structure',
        subject: 'Science',
        score: 90,
        isCorrect: true,
        timeSpentSeconds: 65,
        attemptedAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
  }

  // -----------------------------------------
  // STUDENT DEMO QUERIES
  // -----------------------------------------

  public getStudentDashboard() {
    return {
      hasAssessment: true,
      overallPerformance: this.adam.overallPerformance,
      healthScore: this.adam.healthScore,
      healthCategory: 'strong',
      learningStreakDays: this.adam.learningStreakDays,
      streakIncreaseThisWeek: 3,
      studyActivityMinutes: this.adam.studyActivityMinutes,
      studyActivityChangePercent: 18,
      availableFocusMinutes: 45,
      bestFocusWindow: '7:00 PM',
      weeklyActivity: [
        { day: 'Mon', minutes: 42 },
        { day: 'Tue', minutes: 63 },
        { day: 'Wed', minutes: 49 },
        { day: 'Thu', minutes: 87 },
        { day: 'Fri', minutes: 68 },
        { day: 'Sat', minutes: 31 },
        { day: 'Sun', minutes: 23 }
      ],
      masteryDonuts: [
        { subject: 'Mathematics', score: 70, ringPercent: 79, status: 'On track' },
        { subject: 'BM', score: 67, ringPercent: 60, status: 'Building skills' },
        { subject: 'BI', score: 67, ringPercent: 60, status: 'Building skills' },
        { subject: 'Science', score: 90, ringPercent: 90, status: 'Excellent' }
      ],
      subjects: this.subjects.map(s => ({
        id: s.id,
        name: s.name,
        score: s.score,
        learningTimeFormatted: s.learningTimeFormatted,
        topicsCount: s.topics.length
      })),
      learningGaps: {
        Mathematics: ['Subtraction', 'Multiplication', 'Division'],
        'Bahasa Melayu': ['Penanda wacana', 'Ayat majmuk'],
        English: ['Sentence structure', 'Evidence in essays'],
        Science: ['Cell structure', 'Energy transfer']
      },
      recommendedPractice: {
        topic: 'Subtraction',
        subject: 'Mathematics',
        currentScore: this.subjects.find(s => s.id === 'mathematics')?.topics.find(t => t.id === 'subtraction')?.score ?? 54,
        title: 'Adaptive practice, made for you',
        description: 'Strengthen subtraction in a 15-minute session calibrated to your pace.'
      }
    };
  }

  public getStudentLearning() {
    return {
      subjects: this.subjects.map(s => ({
        id: s.id,
        name: s.name,
        time: s.learningTimeFormatted,
        score: s.score,
        strongestSubtopic: s.strongestSubtopic,
        nextFocus: s.nextFocus,
        note: s.priorityNote,
        topics: s.topics.map(t => ({
          name: t.name,
          score: t.score
        }))
      }))
    };
  }

  public getStudentInsights() {
    const math = this.subjects.find(s => s.id === 'mathematics');
    const subTopic = math?.topics.find(t => t.id === 'subtraction') || { score: 54, timeSpentMinutes: 48 };

    return {
      hasAssessment: true,
      priority: {
        id: 'rec-subtraction-001',
        subject: 'Mathematics',
        topic: 'Subtraction',
        title: 'Build confidence in subtraction.',
        currentScore: subTopic.score,
        timeSpentMinutes: subTopic.timeSpentMinutes || 48,
        recentCorrect: 6,
        recentTotal: 12,
        recommendedMinutes: 15,
        reason: 'Your subtraction score is lower than your other Mathematics topics. A short, focused session now can help you improve this skill before moving to harder questions.',
        steps: [
          { duration: '5 min', label: 'Warm-up' },
          { duration: '7 min', label: 'Guided practice' },
          { duration: '3 min', label: 'Quick check' }
        ],
        whyPoints: [
          {
            icon: '↓',
            title: 'It is your lowest Mathematics topic.',
            detail: 'Subtraction is 22 points below your strongest skill, Addition.'
          },
          {
            icon: '◷',
            title: 'You have practised it less.',
            detail: 'You spent 48 minutes on subtraction compared with 1h 45m on addition.'
          },
          {
            icon: '✦',
            title: 'It helps unlock the next level.',
            detail: 'Improving subtraction will make number problems and division easier.'
          }
        ]
      },
      whyPoints: [
        {
          icon: '↓',
          title: 'It is your lowest Mathematics topic.',
          detail: 'Subtraction is 22 points below your strongest skill, Addition.'
        },
        {
          icon: '◷',
          title: 'You have practised it less.',
          detail: 'You spent 48 minutes on subtraction compared with 1h 45m on addition.'
        },
        {
          icon: '✦',
          title: 'It helps unlock the next level.',
          detail: 'Improving subtraction will make number problems and division easier.'
        }
      ],
      steps: [
        { duration: '5 min', label: 'Warm-up' },
        { duration: '7 min', label: 'Guided practice' },
        { duration: '3 min', label: 'Quick check' }
      ],
      otherSignals: [
        {
          icon: '✓',
          title: 'Science is a strength',
          detail: '90% overall score · You are ready for a challenge.'
        },
        {
          icon: '◈',
          title: 'Best study time: 7:00 PM',
          detail: 'Your focus sessions are most consistent during this window.'
        }
      ]
    };
  }

  public getStudentReport() {
    const math = this.subjects.find(s => s.id === 'mathematics');

    return {
      hasAssessment: true,
      learnerName: this.adam.name,
      period: 'September 2026',
      overallPerformance: this.adam.overallPerformance,
      summaryText: 'You are building strong learning habits. Science is your biggest strength; focused subtraction practice is your best next step.',
      totalLearningTimeFormatted: this.adam.studyActivityFormatted,
      learningStreakDays: this.adam.learningStreakDays,
      practiceRoundsCompleted: this.adam.practiceRoundsCompleted,
      subjects: this.subjects.map(s => ({
        name: s.name,
        time: s.learningTimeFormatted,
        score: s.score,
        trend: s.trend
      })),
      trendChart: [
        { week: 'Week 1', heightPercent: 55 },
        { week: 'Week 2', heightPercent: 62 },
        { week: 'Week 3', heightPercent: 69 },
        { week: 'Week 4', heightPercent: 84 }
      ],
      mathTopicMastery: math?.topics.map(t => ({
        topic: t.name,
        score: t.score,
        status: t.status
      })) || [],
      studyHabits: [
        {
          icon: '◷',
          title: 'Best focus time: 7:00 PM',
          detail: 'Your sessions are most consistent in the evening.'
        },
        {
          icon: '◉',
          title: 'Average session: 27 minutes',
          detail: 'Short focused sessions are working well for you.'
        },
        {
          icon: '⌁',
          title: 'Most active day: Thursday',
          detail: 'You completed 1h 27m of focused learning.'
        }
      ],
      achievements: [
        { icon: '🔥', text: '12-day learning streak' },
        { icon: '⚗', text: 'Science score: 90%' },
        { icon: '✦', text: '24 practice rounds' },
        { icon: '↑', text: 'Maths improved by 8%' }
      ],
      recommendedNextStep: {
        title: 'Strengthen subtraction this week.',
        description: 'Your current score is 54% after 48 minutes of practice. Complete one 15-minute subtraction round to build confidence and improve your Mathematics foundation.'
      }
    };
  }

  public getStudentProfile() {
    return {
      profile: {
        userId: this.adam.userId,
        name: this.adam.name,
        initials: this.adam.initials,
        grade: this.adam.grade,
        school: this.adam.school,
        district: this.adam.district,
        dateOfBirth: this.adam.dateOfBirth,
        learningLanguages: this.adam.learningLanguages,
        preferredLanguage: this.adam.preferredLanguage,
        favouriteSubject: this.adam.favouriteSubject,
        preferredStudyTime: this.adam.preferredStudyTime,
        activities: this.adam.activities,
        is_demo_account: true,
        diagnostic_completed: true,
        onboarding_completed: true,
        profile_completed: true,
        quick_test_completed: true,
        classId: this.demoClass.id,
        className: this.demoClass.name
      },
      recentActivity: [
        {
          type: 'practice',
          subject: 'Mathematics',
          topic: 'Subtraction',
          name: 'Maths practice',
          detail: 'Subtraction · Today',
          date: 'Today'
        },
        {
          type: 'lesson',
          subject: 'Science',
          topic: 'Cell structure',
          name: 'Science lesson',
          detail: 'Cell structure · Yesterday',
          date: 'Yesterday'
        },
        {
          type: 'achievement',
          name: 'Learning streak',
          detail: '12 days active',
          date: 'Active'
        }
      ]
    };
  }

  // -----------------------------------------
  // TEACHER DEMO QUERIES (LINKED TO SAME DATA)
  // -----------------------------------------

  public getAllDemoStudents(): DemoStudentProfile[] {
    return [this.adam, ...this.classmates];
  }

  public getTeacherDashboard() {
    const allStudents = this.getAllDemoStudents();
    const onTrackCount = allStudents.filter(s => s.healthScore >= 55).length;
    const needsSupportCount = allStudents.filter(s => s.healthScore < 55).length;

    return {
      classHealthScore: 78,
      onTrackCount: 21,
      needsSupportCount: 9,
      totalStudents: 30,
      averageLoginMinutesPerDay: 42,
      weeklyPerformance: [
        { day: 'Mon', score: 54 },
        { day: 'Tue', score: 60 },
        { day: 'Wed', score: 66 },
        { day: 'Thu', score: 72 },
        { day: 'Fri', score: 78 },
        { day: 'Sat', score: 69 },
        { day: 'Sun', score: 74 }
      ],
      subjectPerformance: [
        { subject: 'Mathematics', score: 70, changePercent: 8, priority: 'Subtraction', weeklyScores: [43, 55, 48, 66, 72, 62, 70] },
        { subject: 'Bahasa Melayu', score: 67, changePercent: 3, priority: 'Sentence structure', weeklyScores: [54, 49, 61, 65, 58, 68, 67] },
        { subject: 'English', score: 67, changePercent: 4, priority: 'Essay evidence', weeklyScores: [45, 56, 59, 62, 68, 65, 67] },
        { subject: 'Science', score: 90, changePercent: 10, priority: 'Strong', weeklyScores: [73, 78, 82, 79, 88, 86, 90] }
      ],
      studentList: allStudents.map(s => ({
        id: s.id,
        name: s.name,
        initials: s.initials,
        primarySubject: s.primarySubject,
        learningMinutes: s.studyActivityMinutes,
        healthScore: s.healthScore,
        healthScoreDisplay: `${s.healthScore}`,
        timeFormatted: s.studyActivityFormatted,
        status: s.status,
        trend: s.trend,
        trendSymbol: s.trendSymbol,
        classId: this.demoClass.id,
        className: this.demoClass.name
      }))
    };
  }

  public getTeacherStudents(filter: string = 'all') {
    const all = this.getAllDemoStudents();
    let filtered = all;

    if (filter === 'bad') {
      filtered = all.filter(s => s.healthScore < 55);
    } else if (filter === 'mid') {
      filtered = all.filter(s => s.healthScore >= 55 && s.healthScore < 75);
    } else if (filter === 'good') {
      filtered = all.filter(s => s.healthScore >= 75);
    }

    return {
      students: filtered.map(s => ({
        id: s.id,
        name: s.name,
        initials: s.initials,
        subject: s.primarySubject,
        healthScore: s.healthScore,
        healthScoreDisplay: `${s.healthScore}/100`,
        learningMinutes: s.studyActivityMinutes,
        timeFormatted: s.studyActivityFormatted,
        status: s.status,
        statusClass: s.healthScore >= 75 ? 'good' : (s.healthScore >= 55 ? 'watch' : 'risk'),
        trend: s.trend,
        trendSymbol: s.trendSymbol,
        classId: this.demoClass.id,
        className: this.demoClass.name
      })),
      counts: {
        good: all.filter(s => s.healthScore >= 55).length,
        thriving: all.filter(s => s.healthScore >= 75).length,
        mid: all.filter(s => s.healthScore >= 55 && s.healthScore < 75).length,
        bad: all.filter(s => s.healthScore < 55).length,
        total: all.length
      },
      filter
    };
  }

  public getStudentDetail(studentId: string) {
    const all = this.getAllDemoStudents();
    const student = all.find(s => s.id === studentId || s.userId === studentId || s.name === studentId) || this.adam;

    const math = this.subjects.find(s => s.id === 'mathematics');

    return {
      id: student.id,
      name: student.name,
      initials: student.initials,
      meta: `Grade 5 · ${student.primarySubject} focus · Active today`,
      healthScore: student.healthScore,
      healthScoreDisplay: `${student.healthScore}`,
      healthStatus: student.status,
      overallPerformance: student.overallPerformance,
      learningTimeFormatted: student.studyActivityFormatted,
      streakDays: student.learningStreakDays,
      roundsCompleted: student.practiceRoundsCompleted,
      subjects: this.subjects.map(s => ({
        name: s.name,
        score: s.score
      })),
      topics: math?.topics.map(t => ({
        topic: t.name,
        score: t.score,
        note: t.teacherNote || t.status
      })) || [],
      recommendation: {
        title: student.name === 'Adam Haziq' ? 'Keep Adam challenged in Science' : `Support ${student.name} with ${student.primarySubject}`,
        text: student.name === 'Adam Haziq'
          ? 'Adam is performing strongly in Science at 90%. Consider offering extension questions while he continues targeted Mathematics subtraction practice.'
          : `${student.name} needs guided practice to reinforce foundation skills.`
      },
      recentActivity: [
        {
          icon: '∑',
          title: 'Mathematics practice',
          detail: 'Subtraction · 15 minutes · today'
        },
        {
          icon: '⚗',
          title: 'Science lesson',
          detail: 'Cell structure · 28 minutes · yesterday'
        },
        {
          icon: '✦',
          title: 'Practice round completed',
          detail: 'Addition Level 1 · 88% · 2 days ago'
        }
      ]
    };
  }

  public getTeacherInsights() {
    return {
      priorityIntervention: {
        studentName: 'Omar P.',
        studentId: 'demo-student-omar',
        focus: 'subtraction',
        health: 47,
        topic: '54%',
        time: '38 min',
        reason: 'Omar’s Mathematics progress is at risk. His subtraction score and weekly engagement are below the expected level, so a short guided session is recommended before the next class activity.',
        evidence: {
          healthScore: 47,
          subtractionScore: '54%',
          mathsTime: '38 min'
        },
        whyPoints: [
          {
            icon: '↓',
            title: 'Performance is below the support threshold.',
            detail: 'Omar’s health score is 47, below the class support threshold of 50.'
          },
          {
            icon: '◷',
            title: 'Learning activity has declined.',
            detail: 'He completed only 38 minutes of Mathematics learning this week.'
          },
          {
            icon: '◈',
            title: 'The gap affects future learning.',
            detail: 'Subtraction is a prerequisite for number problems and division.'
          }
        ],
        planSteps: [
          { duration: '5 min', label: 'Visual warm-up' },
          { duration: '7 min', label: 'Guided questions' },
          { duration: '3 min', label: 'Quick review' }
        ]
      },
      monitoringList: [
        { initials: 'CL', name: 'Chong L.', focus: 'Mathematics · subtraction score: 52%', health: 48 },
        { initials: 'OB', name: 'Oliver B.', focus: 'English · engagement has declined', health: 49 },
        { initials: 'YS', name: 'Yasmin S.', focus: 'Mathematics · division score: 56%', health: 56 }
      ],
      recommendations: [
        {
          studentName: 'Omar P.',
          focus: 'Subtraction',
          reason: 'Omar’s Mathematics progress is at risk. His subtraction score and weekly engagement are below the expected level.',
          action: '15-minute guided practice'
        }
      ]
    };
  }

  public getTeacherInterventions(category: 'problem' | 'review' | 'complete' = 'problem') {
    const kpis = {
      total: 30,
      problem: 9,
      review: 3,
      complete: 12
    };
    return {
      category,
      students: this.interventions[category] || this.interventions.problem,
      counts: kpis,
      kpis
    };
  }

  public getTeacherReport() {
    return {
      period: 'September 2026',
      className: this.demoClass.name,
      studentCount: 30,
      classHealthScore: 78,
      averagePerformance: 74,
      studentsOnTrack: 21,
      studentsNeedingSupport: 9,
      subjects: [
        { name: 'Mathematics', score: 70, trend: '↑ 8%', priority: 'Subtraction', priorityClass: 'high' },
        { name: 'Bahasa Melayu', score: 67, trend: '↑ 3%', priority: 'Sentence structure', priorityClass: 'mid' },
        { name: 'English', score: 67, trend: '↑ 4%', priority: 'Essay evidence', priorityClass: 'mid' },
        { name: 'Science', score: 90, trend: '↑ 10%', priority: 'Strong', priorityClass: 'good' }
      ],
      weeklyTrend: [
        { day: 'Mon', score: 54 },
        { day: 'Tue', score: 60 },
        { day: 'Wed', score: 66 },
        { day: 'Thu', score: 72 },
        { day: 'Fri', score: 78 },
        { day: 'Sat', score: 69 },
        { day: 'Sun', score: 74 }
      ],
      supportStudents: [
        { name: 'Omar P.', need: 'Maths subtraction', score: 47 },
        { name: 'Chong L.', need: 'Maths subtraction', score: 48 },
        { name: 'Oliver B.', need: 'English engagement', score: 49 }
      ],
      recommendation: {
        title: 'Reteach subtraction in a small group.',
        description: 'Nine learners are below the 60% mastery threshold. Use a 15-minute visual mini-lesson, then assign Level 1 adaptive practice and review results next week.'
      }
    };
  }

  // Live practice attempt calculation for Adam Haziq
  public submitPracticeAttempt(topic: string, isCorrect: boolean) {
    const math = this.subjects.find(s => s.id === 'mathematics');
    const topicObj = math?.topics.find(t => t.id === topic.toLowerCase() || t.name.toLowerCase() === topic.toLowerCase());

    const prevScore = topicObj ? topicObj.score : 54;
    const latestScore = isCorrect ? 100 : 0;
    const newScore = Math.round((prevScore * 0.7) + (latestScore * 0.3));

    if (topicObj) {
      topicObj.score = newScore;
      topicObj.status = newScore >= 80 ? 'Strong' : (newScore >= 60 ? 'Developing' : 'Needs focus');
    }

    // Recalculate math overall
    if (math) {
      const avg = Math.round(math.topics.reduce((acc, t) => acc + t.score, 0) / math.topics.length);
      math.score = avg;
    }

    this.adam.practiceRoundsCompleted++;

    return {
      isCorrect,
      previousScore: prevScore,
      newTopicScore: newScore,
      topic: topicObj?.name || topic,
      topicMastery: newScore >= 80 ? 'Strong foundation' : (newScore >= 55 ? 'Developing' : 'Beginning')
    };
  }

  public getTeacherProfile() {
    return { ...this.teacher };
  }

  public getDemoClass() {
    return { ...this.demoClass };
  }
}

export const demoDataService = new DemoDataService();
