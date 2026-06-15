import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'backend/prisma/schema.prisma'),
  migrate: {
    connectionString: process.env.DATABASE_URL!,
  },
})
