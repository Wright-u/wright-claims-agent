import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Free-tier LLM via Groq. Get a key at https://console.groq.com/keys (no card).
  // Model names on free tiers change — check https://console.groq.com/docs/models
  // if the default below stops working.
  LLM_API_KEY: z.string().min(1, "LLM_API_KEY is required"),
  LLM_MODEL: z.string().default("llama-3.3-70b-versatile"),

  CORE_MCP_URL: z.string().url().default("http://localhost:5000/mcp"),
  CORE_API_KEY: z.string().default(""),

  // "mock": use the fixture-driven mock Core (no real MCP server needed yet).
  // "mcp": connect to a real Core over MCP once its tools are finalized.
  CORE_MODE: z.enum(["mock", "mcp"]).default("mock"),
  MOCK_FIXTURE_PATH: z.string().default("test/mock-core/fixtures/notes-tool.json"),

  // Name of whichever tool reveals real source code, so it can be rationed.
  // Update this if the real Core names it differently.
  CODE_READ_TOOL_NAME: z.string().default("request_code"),

  AGENT_API_KEY: z.string().default(""),

  MAX_ROUNDS: z.coerce.number().int().positive().default(4),
  MAX_CODE_REQUESTS_PER_CLAIM: z.coerce.number().int().min(0).default(2),

  LLM_CACHE_ENABLED: z.coerce.boolean().default(true),
  LLM_CACHE_DIR: z.string().default(".cache/llm"),
});

export type Config = z.infer<typeof EnvSchema>;

function loadConfig(): Config {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
