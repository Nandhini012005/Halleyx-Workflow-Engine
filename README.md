# Halleyx Workflow Engine

A full-stack MERN application for designing, executing, and tracking automated workflows with a dynamic rule engine.

---

## 🧱 Tech Stack

| Layer    | Technology           |
|----------|----------------------|
| Frontend | React 18, React Router v6, Lucide Icons, date-fns |
| Backend  | Node.js, Express.js  |
| Database | MongoDB + Mongoose   |
| Engine   | Custom Rule Engine (no external deps) |

---

## 📁 Project Structure

```
halleyx-workflow/
├── backend/
│   ├── models/         # Mongoose schemas (Workflow, Step, Rule, Execution)
│   ├── routes/         # Express route handlers
│   ├── engine/         # Rule engine + workflow executor
│   ├── utils/          # Seed script
│   ├── server.js       # Entry point
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/      # WorkflowList, Editor, Execution, AuditLog, Detail
│   │   ├── components/ # RuleEditor, reusable UI
│   │   ├── utils/      # Axios API client
│   │   └── styles/     # Global CSS (dark theme)
│   └── public/
└── README.md
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)

### 1. Clone & install

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI if not using localhost
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start MongoDB

```bash
# Local MongoDB
mongod --dbpath /data/db

# Or use MongoDB Atlas — set MONGODB_URI in backend/.env
```

### 3. Seed sample data (optional)

```bash
cd backend
node utils/seed.js
```
Creates 2 sample workflows:
- **Expense Approval** (4 steps, complex rules)
- **Employee Onboarding** (5 steps, branching)

### 4. Run the application

```bash
# Terminal 1: Backend
cd backend
npm run dev   # nodemon on port 5000

# Terminal 2: Frontend
cd frontend
npm start     # React on port 3000
```

Open http://localhost:3000

---

## 📡 API Reference

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /api/workflows | Create workflow |
| GET    | /api/workflows | List (pagination, search, status filter) |
| GET    | /api/workflows/:id | Get with steps & rules |
| PUT    | /api/workflows/:id | Update (increments version) |
| DELETE | /api/workflows/:id | Delete (cascades steps/rules) |

### Steps
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /api/workflows/:workflow_id/steps | Add step |
| GET    | /api/workflows/:workflow_id/steps | List steps |
| PUT    | /api/steps/:id | Update step |
| DELETE | /api/steps/:id | Delete step (cascades rules) |

### Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /api/steps/:step_id/rules | Add rule |
| GET    | /api/steps/:step_id/rules | List rules |
| PUT    | /api/rules/:id | Update rule |
| DELETE | /api/rules/:id | Delete rule |
| POST   | /api/rules/validate | Validate condition syntax |

### Executions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /api/workflows/:workflow_id/execute | Start execution |
| GET    | /api/executions | List all (audit log) |
| GET    | /api/executions/:id | Get status & logs |
| POST   | /api/executions/:id/cancel | Cancel execution |
| POST   | /api/executions/:id/retry | Retry failed step only |
| POST   | /api/executions/:id/approve | Approve/reject step |

---

## ⚙️ Rule Engine Design

### Condition Syntax
```
Comparison:  amount > 100   country == 'US'   priority != 'Low'
Logical:     amount > 100 && country == 'US'
             priority == 'High' || amount > 500
String:      contains(department, 'Eng')
             startsWith(name, 'A')
             endsWith(email, '.com')
Special:     DEFAULT  (fallback — required in every step)
```

### Evaluation Order
1. Rules are sorted by **priority** (lowest number = evaluated first)
2. First matching condition wins
3. `DEFAULT` is used only if nothing else matches
4. If no rule matches and no DEFAULT → step **fails**
5. All evaluations are **logged** (matched/unmatched, errors, winning rule)

### Branching
Each rule's `next_step_id` can point to any step — not just the next sequential one. This enables full branching (e.g., approve → CEO step, reject → rejection task).

### Looping
Steps can loop back to earlier steps via rules. Set `max_iterations` in step metadata to prevent infinite loops (default: 10). The engine tracks iteration counts per step.

---

## 🎯 Sample Workflow: Expense Approval

### Input
```json
{ "amount": 1500, "country": "US", "priority": "High", "description": "Conference travel" }
```

### Steps
1. **Manager Approval** (approval)
2. **Finance Notification** (notification → email)
3. **CEO Approval** (approval)
4. **Task Completion** (task)
5. **Task Rejection** (task)

### Rules (Manager Approval step)
| Priority | Condition | Next Step |
|----------|-----------|-----------|
| 1 | `amount > 100 && country == 'US' && priority == 'High'` | Finance Notification |
| 2 | `amount <= 100 \|\| priority == 'Low'` | Task Completion |
| 3 | `priority == 'Low' && country != 'US'` | Task Rejection |
| 4 | `DEFAULT` | Task Rejection |

### Execution Log Example
```
✓ Manager Approval    [approval]    awaiting_approval → completed (approved)
  Rule: amount > 100 && country == 'US' && priority == 'High' → Finance Notification
✓ Finance Notification [notification] completed  35ms
  Rule: amount > 1000 (matched) → CEO Approval
✓ CEO Approval        [approval]    awaiting_approval → completed (approved)
  Rule: DEFAULT → Task Completion
✓ Task Completion     [task]        completed  12ms
  → END WORKFLOW
```

---

## ✅ Features Implemented

- [x] Full CRUD for Workflows, Steps, Rules
- [x] Dynamic rule engine with expression evaluation
- [x] Branching (rules point to any step)
- [x] Looping with configurable max iterations
- [x] Step types: task, approval, notification
- [x] Approval step pausing + resume
- [x] Retry failed steps (not entire workflow)
- [x] Cancel running executions
- [x] Input schema validation
- [x] Full execution logging with rule evaluation details
- [x] Workflow versioning (increments on update)
- [x] Pagination & search on all lists
- [x] Audit log with stats
- [x] Dark-theme UI with all 5 views
- [x] Seed data with 2 sample workflows

---

## 🎬 Demo Flow

1. Open http://localhost:3000
2. You'll see 2 seeded workflows (after running seed.js)
3. Click **Edit** on "Expense Approval" to explore the step/rule editor
4. Click **Run** → enter `{ amount: 1500, country: "US", priority: "High" }`
5. Watch the execution log update in real time
6. When it hits "Manager Approval" — click **Approve**
7. Watch it continue through Finance Notification → CEO Approval → Completion
8. Go to **Audit Log** to see full execution history
9. Click **View Logs** on any execution for detailed step-by-step breakdown
