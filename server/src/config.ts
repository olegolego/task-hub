import { z } from 'zod'

const configSchema = z.object({
  PORT: z.coerce.number().default(8765),
  DATA_DIR: z.string().optional(),
  LLM_SERVER_URL: z.string().url().default('http://localhost:8766'),
  MAX_FILE_SIZE: z.coerce.number().default(50 * 1024 * 1024), // 50MB
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SKIP_SIG_VERIFY: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
})

export const config = configSchema.parse(process.env)
