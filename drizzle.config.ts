import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: ['.env.local', '.env'] })

const directUrl = process.env.DIRECT_URL
if (!directUrl) {
  throw new Error('DIRECT_URL is not set')
}

export default defineConfig({
  out: './drizzle',
  schema: './src/server/db/schema',
  dialect: 'postgresql',
  dbCredentials: {
    url: directUrl,
  },
})