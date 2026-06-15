const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// The internal Render database URL
const internalDbUrl = "postgresql://splitit_db_5lye_user:AO9RhIZ2tkAERXflE9jYYcvhzVxQXcWy@dpg-d8nl883tqb8s73daac1g-a/splitit_db_5lye";

const dbUrl = process.env.DATABASE_URL || internalDbUrl;
process.env.DATABASE_URL = dbUrl;

// Write to backend/.env so dotenv picks it up when server starts
const backendEnvPath = path.join(__dirname, 'backend', '.env');
let envContent = '';
if (fs.existsSync(backendEnvPath)) {
  envContent = fs.readFileSync(backendEnvPath, 'utf8');
}
if (envContent.includes('DATABASE_URL=')) {
  envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${dbUrl}"`);
} else {
  envContent += `\nDATABASE_URL="${dbUrl}"\n`;
}
fs.writeFileSync(backendEnvPath, envContent);
console.log("DATABASE_URL written to backend/.env");

const env = { ...process.env, DATABASE_URL: dbUrl };

console.log("Generating Prisma Client...");
execSync('node node_modules/prisma/build/index.js generate --schema=backend/prisma/schema.prisma', { stdio: 'inherit', env });

console.log("Running Prisma Migrations...");
execSync('node node_modules/prisma/build/index.js migrate deploy --schema=backend/prisma/schema.prisma', { stdio: 'inherit', env });

console.log("Starting server...");
require('./server.js');
