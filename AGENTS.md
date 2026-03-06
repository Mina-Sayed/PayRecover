# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages, layouts, and API handlers (`app/api/**/route.ts`).
- `app/components/`: Reusable UI components used across dashboard/auth flows.
- `lib/`: Shared utilities (auth, Prisma client, validation, API helpers, middleware helpers).
- `prisma/schema.prisma`: Database schema and model relationships.
- `tests/unit/` and `tests/integration/`: Logic-level and route-level test suites.
- `docs/`: Project documentation (for example, security review notes).

Use the `@/` path alias for root imports (configured in `tsconfig.json`).

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start local dev server.
- `npm run build`: Build production bundle (`next build`).
- `npm run start`: Run the production server locally.
- `npm run lint`: Run ESLint checks.
- `npm run test`: Run all Vitest tests once.
- `npm run test:watch`: Run Vitest in watch mode during development.
- `npm run clean`: Clear Next.js build artifacts.

CI baseline: `npm ci && npm run lint && npm run test && npm run build`.

## Coding Style & Naming Conventions
- Language: TypeScript with `strict` mode enabled.
- Formatting style in this repo: 2-space indentation and single quotes.
- Naming: PascalCase for React component/type names, camelCase for variables/functions, kebab-case for most file names and route segments.
- Keep API handlers small and defensive: validate input and return normalized error shapes.

## Testing Guidelines
- Framework: Vitest (`vitest.config.ts`) with tests matched by `tests/**/*.test.ts`.
- Environment defaults are set in `tests/setup.ts`.
- Place pure logic tests in `tests/unit/` and endpoint behavior tests in `tests/integration/`.
- For behavior changes, add/update both unit and integration coverage where applicable.
- Target high coverage (90%+ where practical), especially on auth, validation, and data-scoping code.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits (for example: `feat: add invoice status filter`, `fix: scope reminders by user`).
- Keep commits focused to one logical change.
- PRs should include:
  - Clear summary and linked issue/task.
  - Test evidence (`npm run lint`, `npm run test`, `npm run build`).
  - Screenshots/video for UI changes.
  - Notes for schema/env updates and any breaking changes.

## Security & Configuration Tips
- Copy `.env.example` and supply required values (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`).
- Never commit secrets or real credentials.
- Run dependency/security checks before merge: `npm audit --omit=dev --audit-level=high`.
- CI also enforces Trivy scanning and optional Snyk checks.
