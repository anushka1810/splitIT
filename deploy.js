const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// The internal Render database URL
const internalDbUrl = "postgresql://splitit_db_5lye_user:AO9RhIZ2tkAERXflE9jYYcvhzVxQXcWy@dpg-d8nl883tqb8s73daac1g-a/splitit_db_5lye";

const dbUrl = process.env.DATABASE_URL || internalDbUrl;
process.env.DATABASE_URL = dbUrl;

console.log("Starting deployment process...");

try {
  // Write the DATABASE_URL to root .env so Prisma finds it when run from root
  const rootEnvPath = path.join(__dirname, '.env');
  let envContent = '';
  if (fs.existsSync(rootEnvPath)) {
    envContent = fs.readFileSync(rootEnvPath, 'utf8');
  }
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${dbUrl}"`);
  } else {
    envContent += `\nDATABASE_URL="${dbUrl}"\n`;
  }
  fs.writeFileSync(rootEnvPath, envContent);
  console.log("Successfully wrote DATABASE_URL to root .env");

  // Also write to backend/.env just in case the server needs it
  const backendEnvPath = path.join(__dirname, 'backend', '.env');
  fs.writeFileSync(backendEnvPath, envContent);

  console.log("Generating Prisma Client...");
  execSync('node node_modules/prisma/build/index.js generate', { 
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl }
  });
  
  console.log("Running Prisma Migrations...");
  execSync('node node_modules/tsx/dist/cli.mjs node_modules/prisma/build/index.js migrate deploy', { 
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl }
  });
  
  console.log("Starting the Express Server...");
  require('./server.js');
} catch (e) {
  console.error("Failed to run deployment steps!");
  console.error("Error Message:", e.message);
  if (e.stdout) console.error("STDOUT:", e.stdout.toString());
  if (e.stderr) console.error("STDERR:", e.stderr.toString());
  process.exit(1);
}
