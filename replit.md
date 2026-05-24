# Zero-Wait OPD Kiosk

A hospital outpatient department self-service kiosk app that lets patients register, describe symptoms, get AI-routed to the right department, and check insurance — all without staff involvement.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/opd-kiosk run dev` — run the frontend kiosk app (port 20234)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit-managed OpenAI proxy

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TanStack Query, Wouter, shadcn/ui, Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI via Replit AI Integrations (gpt-5.1 for chat, extraction, insurance)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle schemas: patients, visits, conversations, messages
- `artifacts/api-server/src/routes/` — Express route handlers
  - `patients.ts` — patient CRUD + search
  - `visits.ts` — visit CRUD
  - `ai.ts` — AI extraction, insurance check, kiosk stats
  - `openai/index.ts` — OpenAI streaming chat (symptom routing agent)
- `artifacts/opd-kiosk/src/` — React frontend
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `lib/integrations-openai-ai-server/` — OpenAI SDK client wrapper

## Architecture decisions

- OpenAPI-first: all API contracts defined in `openapi.yaml`, client hooks and server Zod schemas generated from it.
- SSE for AI chat: streaming responses use native `fetch + ReadableStream` on the client; generated hooks can't handle SSE response bodies.
- Replit AI Integrations: OpenAI is accessed through the Replit-managed proxy — no user API key needed.
- Single Express server: all endpoints on `artifacts/api-server`, frontend is Vite static with wouter for routing.

## Product

- **Home**: live stats dashboard (patients today, total visits, top department)
- **Scan ID** (`/scan-id`): paste ID card text → AI extracts name/age/gender/phone/insuranceId → patient saved to DB
- **AI Chat** (`/chat`): real-time streaming symptom chat → AI routes to the right hospital department
- **Insurance Check** (`/insurance`): enter insurance ID → AI-powered status check (active/inactive/unknown)
- **Confirmation** (`/confirmation`): full visit summary after save

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before implementing backend routes.
- DB schema exports must be in `lib/db/src/schema/index.ts` for Drizzle push to pick them up.
- SSE endpoints: Orval cannot generate typed hooks for streaming responses — use native `fetch + ReadableStream` on the client.
- The `integrations-openai-ai-server` lib uses TypeScript composite mode — it's in root `tsconfig.json` references.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `ai-integrations-openai` skill for OpenAI SDK usage patterns
