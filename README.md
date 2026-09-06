# 2Block Ai — Intelligent Adaptive Learning & Teacher Intervention Platform

> **Google Developer Groups (GDG) Hackathon Project**  
> *Transforming KSSR Primary Education with Real-Time Learning Gap Detection, Adaptive Practice, and Teacher Intervention Workflows.*

---

## 🌟 Executive Summary

**2Block Ai** is a full-stack, dual-sided educational intelligence platform designed to address the critical challenge in contemporary primary education: **identifying and closing student learning gaps before they compound into chronic academic struggle.**

Traditional classrooms often rely on end-of-term exams that deliver diagnostic insights too late for meaningful remediation. **2Block Ai** bridges the gap between learners and educators through:
1. **A student-centric adaptive learning arena** featuring game-like survival practice, live mastery tracking, and personalized next-step recommendations.
2. **An educator intelligence suite** providing class health scoring, early risk signals, 1-click guided intervention plans, and print-ready progress reports.

---

## 🚀 Live Demo & Repository Access

* **GitHub Repository (Primary):** [https://github.com/adamhaziq1224-dotcom/twoblock](https://github.com/adamhaziq1224-dotcom/twoblock)
* **GitHub Repository (Hackathon Org):** [https://github.com/GDG-HACKATHON-rizz-code/twoblock-AI](https://github.com/GDG-HACKATHON-rizz-code/twoblock-AI)
* **Local Web Interface:** `http://localhost:5000`

---

## 🔑 Demonstration Accounts

The platform includes two zero-configuration, fully-populated demo accounts demonstrating the complete student and educator journey:

| Role | Name | Details / Class | Access Method |
| :--- | :--- | :--- | :--- |
| **Student** | **Adam Haziq** | Grade 5 Learner · 12-day streak · 84% Health Score · 385 mins focused study | Click **"Try Demo Student — Adam Haziq"** on login screen |
| **Teacher** | **Ms. Liyana Karim** | Year 5 Educator · Class *5 Cemerlang* · 30 Learners · 78 Class Health | Click **"Try Demo Teacher — Ms. Liyana Karim"** on login screen |

---

## 📐 System Architecture

```
                                  ┌─────────────────────────────────────────┐
                                  │           2Block Ai Web Client          │
                                  │   (Responsive Glassmorphism UI / SVG)   │
                                  └──────────────┬──────────────────┬───────┘
                                                 │                  │
                         Supabase Auth & RLS     │                  │ REST Endpoints & Real-time
                                                 ▼                  ▼
                         ┌──────────────────────────────────────────────────┐
                         │              Express.js API Engine               │
                         │              (TypeScript / Node.js)              │
                         └──────────────┬───────────────────┬───────────────┘
                                        │                   │
                     Adaptive Scoring & │                   │ Fallback Store
                     Diagnostic Engine  ▼                   ▼ & Seed System
                         ┌────────────────────┐   ┌─────────────────────────┐
                         │   Supabase Cloud   │   │  In-Memory / File-based │
                         │ PostgreSQL w/ RLS  │   │  Fallback Store (.json) │
                         └────────────────────┘   └─────────────────────────┘
```

### Core Architecture Components
* **Adaptive Scoring & Diagnostic Engine:** Evaluates question difficulty against real-time student response latencies and accuracy using moving average calibration (`previous * 0.7 + current * 0.3`).
* **Supabase Integration & Row Level Security (RLS):** Enforces data isolation ensuring student profiles, attempts, and diagnostics are strictly partitioned while granting teachers designated access to class cohorts.
* **Resilient Dual-Mode Execution:** Operates seamlessly with cloud Supabase credentials, falling back cleanly to an offline persistent data store for uninterrupted demonstration.

---

## 💻 Tech Stack

| Layer | Technology | Key Library / Tool |
| :--- | :--- | :--- |
| **Frontend** | Vanilla HTML5 / Modern CSS / ES6 JavaScript | Glassmorphism design tokens, dynamic SVG charting, CSS Grid/Flexbox |
| **Backend** | Node.js (v24), TypeScript, Express.js (v4.21) | `tsx`, `cors`, `helmet`, `zod`, `jsonwebtoken`, `bcryptjs` |
| **Database & Auth** | Supabase PostgreSQL + Prisma ORM (v5.22) | Row Level Security (RLS), Supabase Auth SDK, `@prisma/client` |
| **Testing** | Node.js Test Runner & Vitest | Native `node --test`, TypeScript test execution |
| **Deployment** | Vercel Serverless & Node.js Docker | Clean TypeScript build (`tsc`) with zero errors |

---

## ✨ Key Features & User Journeys

### 1. 🧑‍🎓 Student Experience (Adam Haziq)
* **Diagnostic Onboarding:** 8-field KSSR-aligned profile intake paired with a 20-question multi-subject Quick Learning Check.
* **Personalized Overview Dashboard:**
  * **Weekly Learning Streak:** Dynamic 7-day dot indicators reflecting daily practice habits.
  * **Study Activity KPI:** Real-time counter of focused minutes completed.
  * **Interactive Formula Proof Modal:** Full transparency explaining mathematical calculation of mastery and engagement scores.
  * **Mastery Donut Rings:** Visual rings for Mathematics (70%), Bahasa Melayu (67%), English (67%), and Science (90%).
  * **Multi-Tier Learning Gap Cards:** Identifies prerequisite concept weaknesses (e.g., Subtraction regrouping before Division).
* **Survival Practice Arena:**
  * 3-life survival mechanic with dynamic question generation.
  * Instant feedback with step-by-step conceptual hints.
  * Round completion mastery summaries and real-time score updates.

### 2. 👩‍🏫 Teacher Intelligence Suite (Ms. Liyana Karim)
* **Class Overview Dashboard:**
  * **Class Health Score (78/100):** Weighted index combining mastery, practice frequency, and learning velocity.
  * **Cohort Distribution:** Clear indicators showing 21 students On Track (70%) and 9 students Needing Support (30%).
  * **7-Day Class Performance Curve:** Interactive SVG bezier visualization of day-by-day cohort growth.
  * **Subject Health Breakdown:** Mathematics, Bahasa Melayu, English, and Science scores with weekly trend spark-bars.
  * **AI Intervention Priority Cards:** Action-oriented alerts for high-priority students (e.g., Omar P. & Chong L. subtraction support).
* **30-Student Cohort Directory:**
  * Full roster of 30 realistic learners in *5 Cemerlang* with search and status filtering (`all`, `good`, `mid`, `bad`).
  * Interactive slide-over drawer displaying categorized cohorts and login activity.
* **Individual Learner Deep Dive:**
  * Granular topic tracking table showing sub-skill scores (Addition 92%, Multiplication 68%, Subtraction 54%).
  * Historical timeline of completed focus sessions and diagnostic evaluations.
* **Automated Intervention Engine:**
  * Segmented workflows for **Problem Learners**, **Due for Review**, and **Complete Check**.
  * Pre-built 15-minute guided support plans tailored for small-group instruction.
* **Print-Ready Class Progress Reports:**
  * Professional progress reports formatted for A4 print and PDF export with clean black-and-white print styles.

---

## 📁 Repository Structure

```
twoblock-AI/
├── public/
│   ├── index.html                  # Unified single-page application interface
│   ├── assets/                     # Platform logos and branding assets
│   └── favicon.ico                 # Application favicon
├── src/
│   ├── controllers/
│   │   ├── authController.ts       # Authentication & demo login endpoints
│   │   ├── studentController.ts    # Student learning, practice & diagnostics
│   │   ├── teacherController.ts    # Teacher analytics, cohort directory & reports
│   │   ├── practiceController.ts   # Adaptive survival round state machine
│   │   └── diagnosticController.ts # Baseline diagnostic question evaluation
│   ├── services/
│   │   ├── demoData.ts             # Stateful single source of truth for demo mode
│   │   ├── dataStore.ts            # Persistent application store
│   │   ├── analyticsService.ts     # Health score and gap detection engine
│   │   └── scoringService.ts       # Adaptive mastery calibration service
│   ├── routes/                     # Modular API route definitions
│   ├── middlewares/                # Auth verification & error handling
│   ├── app.ts                      # Express application setup
│   └── server.ts                   # HTTP listener entrypoint
├── tests/
│   └── adamHaziqDemoAccount.test.ts# End-to-end integration test suite
├── package.json                    # Project dependencies & scripts
├── tsconfig.json                   # TypeScript compiler configuration
└── README.md                       # Comprehensive platform documentation
```

---

## 🛠️ Getting Started Locally

### Prerequisites
* **Node.js:** v18.0.0 or later (v20+ recommended)
* **npm:** v9.0.0 or later

### Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/adamhaziq1224-dotcom/twoblock.git
   cd twoblock
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=twoblock_secret_key_2026_gdg
   SUPABASE_URL=https://jpapghryrtnelmgfnfjg.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwYXBnaHJ5cnRuZWxtZ2ZuZmpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MzU0MDksImV4cCI6MjEwNDExMTQwOX0.RdfpagEfLUxf83mv_1dGFOMBjvcZKDhTlAJjnkeeBm8
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Open your browser to: **`http://localhost:5000`**

5. **Run Verification & Tests:**
   ```bash
   npm run build
   npx tsx --test tests/adamHaziqDemoAccount.test.ts
   ```

---

## 📡 API Overview

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/demo-login` | Authenticate as Adam Haziq or Ms. Liyana Karim | Public |
| `GET` | `/api/student/dashboard` | Student KPIs, streaks, donuts & learning gaps | Student |
| `GET` | `/api/student/learning` | Topic mastery breakdowns across 4 core subjects | Student |
| `POST` | `/api/student/practice/answer` | Submit adaptive answer & recalculate mastery | Student |
| `GET` | `/api/student/insights` | Personalized AI practice recommendations | Student |
| `GET` | `/api/teacher/dashboard` | Class health score, 7-day curve & priorities | Teacher |
| `GET` | `/api/teacher/students` | 30-student cohort directory with filters | Teacher |
| `GET` | `/api/teacher/students/:name` | Granular student mastery & activity history | Teacher |
| `GET` | `/api/teacher/interventions` | Priority support queues (Problem, Review, Complete)| Teacher |
| `GET` | `/api/teacher/report` | Comprehensive class performance report data | Teacher |

---

## 🏆 Innovation & Hackathon Impact

1. **Pedagogical Alignment:** Tailored specifically for the Malaysian Kurikulum Standard Sekolah Rendah (KSSR) framework across Primary 1–6.
2. **Explainable AI:** Eliminates "black-box" student metrics by providing clickable calculation proofs for every grade and score.
3. **Teacher-in-the-Loop:** Empowers educators with actionable 15-minute small group lesson structures rather than generic alerts.
4. **Inclusive Accessibility:** Low-bandwidth, mobile-optimized glassmorphic UI requiring minimal hardware overhead.

---

*Built with ❤️ for the Google Developer Groups (GDG) Hackathon.*