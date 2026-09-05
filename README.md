# 2Block Ai — Adaptive Learning Platform Backend & Frontend

A full-stack adaptive learning platform featuring an interactive student space, practice arena with survival-round mechanics, AI-driven learning gap detection, and teacher analytics with intervention recommendation workflows.

---

## 🚀 Tech Stack

* **Runtime:** Node.js (v24)
* **Language:** TypeScript
* **Web Framework:** Express.js (v4.21) with CORS, Helmet, and JSON middleware
* **Database & ORM:** Prisma ORM (v5.22) with PostgreSQL datasource & built-in local persistence data store
* **Authentication:** JWT Bearer tokens (`jsonwebtoken`) + `bcryptjs` password hashing
* **Validation:** Zod schemas
* **Testing:** Vitest + Supertest
* **Frontend:** Vanilla HTML/CSS/JavaScript with glassmorphism / dark neon UI, served directly by Express static middleware (`public/index.html`)

---

## 📁 Project Structure

```
twoblock-AI/
├── data/
│   └── app-data.json               # Local persisted database store
├── prisma/
│   └── schema.prisma               # Complete Prisma schema (19 relational models)
├── public/
│   ├── index.html                  # Assembled 2Block Ai frontend interface
│   └── index.original.html         # Backup of original interface
├── src/
│   ├── config/
│   │   ├── db.ts                   # Prisma client instance & DB health checker
│   │   └── env.ts                  # Environment variable validations
│   ├── controllers/
│   │   ├── authController.ts       # Register, Login, Demo Login, Me
│   │   ├── contentController.ts    # Subjects, Topics, Questions
│   │   ├── diagnosticController.ts # Diagnostics & learning snapshots
│   │   ├── healthController.ts     # Health check endpoint
│   │   ├── practiceController.ts   # Adaptive practice state machine
│   │   ├── studentController.ts    # Student overview, learning, practice, insights, reports, profile
│   │   └── teacherController.ts    # Teacher dashboard, students, interventions, report, profile
│   ├── middlewares/
│   │   ├── auth.ts                 # JWT authentication & role authorization
│   │   ├── errorHandler.ts         # Centralized error handler
│   │   └── validate.ts             # Zod schema validation middleware
│   ├── routes/
│   │   ├── authRoutes.ts           # /auth routes
│   │   ├── contentRoutes.ts        # Content routes
│   │   ├── diagnosticRoutes.ts     # /students diagnostic routes
│   │   ├── healthRoutes.ts         # /health route
│   │   ├── index.ts                # Master router
│   │   ├── practiceRoutes.ts       # /practice routes
│   │   ├── studentRoutes.ts        # /api/student routes
│   │   └── teacherRoutes.ts        # /api/teacher routes
│   ├── scripts/
│   │   └── seed.ts                 # Database & store seed script
│   ├── services/
│   │   ├── adaptiveEngine.ts       # Adaptive question selection engine
│   │   ├── analyticsService.ts     # Composite health score, streaks, gap detection
│   │   ├── authService.ts          # Auth business logic
│   │   ├── dataStore.ts            # Persistent application store populated from demo models
│   │   ├── learningGapService.ts   # Multi-tier learning gap detection service
│   │   └── recommendationEngine.ts # Rule-based AI recommendation engine
│   ├── app.ts                      # Express app initialization
│   └── server.ts                   # HTTP server entry point
├── tests/
│   ├── integrationEndpoints.test.ts # Full integration suite for student/teacher endpoints
│   ├── health.test.ts              # Health check test
│   ├── masteryCalculation.test.ts  # Mastery calculation unit tests
│   └── errorHandler.test.ts        # Error handling tests
├── student-demo-data.json          # Reference student data model
├── teacher-demo-data.json          # Reference teacher data model
├── package.json
└── tsconfig.json
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/twoblock_ai?schema=public
JWT_SECRET=supersecretjwtkey_2be_ai_2026
```

> **Note:** The backend automatically falls back to `data/app-data.json` if PostgreSQL credentials are not configured, so the platform runs immediately out-of-the-box without manual database setup.

---

## 📦 Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Seed Database / Data Store:**
   Populates students, teachers, classes, subjects, topics, and initial progress from `student-demo-data.json` and `teacher-demo-data.json`:
   ```bash
   npm run seed
   ```

4. **(Optional) Push Schema to PostgreSQL:**
   If a local PostgreSQL instance is running:
   ```bash
   npm run prisma:push
   ```

---

## 🏃 Running the Application

### Development Mode (with Live Reload):
```bash
npm run dev
```

### Production Build & Run:
```bash
npm run build
npm run start
```

Once started, open your browser and navigate to:
👉 **`http://localhost:5000`**

---

## 🧪 Testing

Run all unit and integration tests:
```bash
npm run test
```

Or test specific integration suites:
```bash
npx vitest run tests/integrationEndpoints.test.ts
```

---

## 📑 API Reference

### 1. Authentication (`/auth`)
| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `POST` | `/auth/demo-login` | Instant demo login (`{ role: "student" \| "teacher" }`) | Public |
| `POST` | `/auth/login` | Email & password authentication | Public |
| `POST` | `/auth/register` | Create a new student or teacher account | Public |
| `GET` | `/auth/me` | Fetch currently authenticated user | Authenticated |

### 2. Student APIs (`/api/student`)
| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `GET` | `/api/student/dashboard` | Streak, focus time, weekly chart, mastery, gaps | Student |
| `GET` | `/api/student/learning` | 4 core subjects, subtopics, strengths, next focus | Student |
| `GET` | `/api/student/practice/questions` | Fetch questions for topic & level | Student |
| `POST` | `/api/student/practice/answer` | Submit answer attempt, check correctness | Student |
| `POST` | `/api/student/practice/end` | Finalize round, compute score and mastery level | Student |
| `GET` | `/api/student/insights` | Priority recommendation card, 15-min plan, signals | Student |
| `GET` | `/api/student/report` | Complete progress report, trends, achievements | Student |
| `GET` | `/api/student/profile` | Load student education profile | Student |
| `PUT` | `/api/student/profile` | Save student education profile | Student |

### 3. Teacher APIs (`/api/teacher`)
| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `GET` | `/api/teacher/dashboard` | Class health score, on-track count, subject curves | Teacher |
| `GET` | `/api/teacher/students` | Student directory with filter (`all`, `bad`, `mid`, `good`) | Teacher |
| `GET` | `/api/teacher/students/:nameOrId` | Individual student progress and topic tracking | Teacher |
| `GET` | `/api/teacher/insights` | AI priority recommendations for students needing support | Teacher |
| `POST` | `/api/teacher/interventions` | Create support plan and update problem list | Teacher |
| `GET` | `/api/teacher/interventions` | Filtered interventions (`problem`, `review`, `complete`) | Teacher |
| `GET` | `/api/teacher/report` | Class report summary, priority subjects, students at risk | Teacher |
| `GET` | `/api/teacher/profile` | Load teacher profile and class assignments | Teacher |
| `PUT` | `/api/teacher/profile` | Save teacher professional profile | Teacher |

### 4. Health Check
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server & database liveness check |

---

## 🧮 Calculation & Service Layer

1. **Overall Student Performance:**
   Weighted average across core subjects (Mathematics, Bahasa Melayu, English, Science).
2. **Student Health Score (0–100):**
   Composite calculation:
   * Mastery (40%)
   * Weekly learning activity (30%)
   * Streak consistency (20%)
   * Recent performance trend (10%)
3. **Performance Categories:**
   * **Good (Thriving / On track):** $\ge 75$
   * **Mid (Watch):** $55 - 74$
   * **Bad (Support needed):** $< 55$
4. **Learning Gaps:**
   Identifies subtopics where student mastery is below the $60\%$ threshold.
5. **Teacher Class Health Score:**
   Mean health score of all active students in the class.
6. **AI Recommendations:**
   Deterministic rule-based recommendation engine prioritizing learners with low health scores, declining engagement, or weak prerequisites, generating 15-minute intervention plans (warm-up, guided questions, review).