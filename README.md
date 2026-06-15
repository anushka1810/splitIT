# SplitIT - Shared Expenses Application

SplitIT is a full-stack web application designed to help groups of friends track shared expenses seamlessly. It features a robust, interactive 4-Tier CSV Import Engine capable of detecting, analyzing, and resolving severe data inconsistencies (duplicate rows, missing currencies, mixed split types, negative balances, and missing members).

## Key Features
- **Intelligent CSV Import:** 4-Tier interactive dashboard to catch and resolve 19 different edge cases dynamically.
- **Group & Member Management:** Add and remove members. Balances dynamically adjust.
- **Expense & Settlement Ledgers:** Distinct tables for shared expenses and direct peer-to-peer debt settlements.
- **Comprehensive Balances:** See exact "Who Owes Who" breakdowns and individual balance summaries.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL (or SQLite, via Prisma)

### 1. Database Setup
```bash
cd backend
npm install
npx prisma db push
```

### 2. Start the Backend Server
```bash
cd backend
npm run dev
# The backend will run on http://localhost:5000
```

### 3. Start the Frontend
```bash
cd frontend
npm install
npm run dev
# The frontend will run on http://localhost:5173
```

## AI Tools Used
This project was built collaboratively with **Antigravity (Google DeepMind's Agentic Coding Assistant)** acting as the primary pair-programmer. 
Please refer to `AI_USAGE.md` for a detailed log of prompts, mistakes caught, and architectural course-corrections. All major architectural logic for the interactive CSV anomaly resolution was architected specifically for this assignment.