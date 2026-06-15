const { execSync } = require('child_process');

// The internal Render database URL
const internalDbUrl = "postgresql://splitit_db_5lye_user:AO9RhIZ2tkAERXflE9jYYcvhzVxQXcWy@dpg-d8nl883tqb8s73daac1g-a/splitit_db_5lye";

// Use the environment variable if Render provides it, otherwise fallback to the hardcoded link
process.env.DATABASE_URL = process.env.DATABASE_URL || internalDbUrl;

console.log("Starting deployment process...");

try {
  console.log("Generating Prisma Client...");
  execSync('node node_modules/prisma/build/index.js generate --schema=backend/prisma/schema.prisma', { stdio: 'inherit' });
  
  console.log("Running Prisma Migrations...");
  execSync('node node_modules/prisma/build/index.js migrate deploy --schema=backend/prisma/schema.prisma', { stdio: 'inherit' });
  
  console.log("Starting the Express Server...");
  require('./server.js');
} catch (e) {
  console.error("Failed to run deployment steps:", e);
  process.exit(1);
}
