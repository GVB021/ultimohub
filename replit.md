# V.HUB - Virtual Dubbing Studio Platform

## Overview

V.HUB is a professional virtual dubbing studio management platform (estúdio de dublagem virtual) built for Brazilian Portuguese-speaking users. It allows production companies and studios to manage dubbing productions, recording sessions, voice actors, characters, takes, and studio staff through a web interface.

The application was migrated from VHUB-3 to the current Replit platform, replacing a broken WebRTC/Socket.IO voice chat system with Jitsi Meet integration, and adapting authentication to use Replit's OpenID Connect (OIDC) auth system instead of local JWT-based auth.

Key features:
- Multi-studio workspace with role-based access control
- Production and character management with script support (JSON scripts with timecodes)
- Recording room with browser-based audio capture, waveform visualization, and take management
- Session scheduling and participant tracking
- Platform-wide admin panel for managing users, studios, productions, and audit logs
- Notification system

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, using Vite as the bundler
- **Routing**: Wouter (lightweight client-side routing)
- **State/Data Fetching**: TanStack React Query v5 for server state management; all API calls go through a shared `authFetch` utility that handles 401 redirects to `/api/login`
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives, styled with Tailwind CSS
- **Design System**: Custom design tokens in `index.css` using CSS variables; custom component classes prefixed with `vhub-` for cards, buttons, layout, and typography
- **Forms**: React Hook Form with Zod resolvers
- **Internationalization**: Portuguese (pt-BR) strings in `client/src/lib/i18n.ts`
- **Code splitting**: All pages use `React.lazy` + `Suspense` for lazy loading
- **Audio**: Custom audio engine in `client/src/lib/audio/` for microphone management, recording, and waveform visualization (Web Audio API)

### Backend Architecture

- **Runtime**: Node.js with TypeScript (tsx for dev, esbuild for production)
- **Framework**: Express.js
- **Structure**:
  - `server/index.ts` — app bootstrap, middleware, HTTP server
  - `server/routes.ts` — all REST API route definitions
  - `server/storage.ts` — data access layer (Drizzle ORM queries)
  - `server/middleware/auth.ts` — `requireAuth`, `requireAdmin`, `requireStudioAccess`, `requireStudioRole` middleware (session-based)
  - `server/lib/logger.ts` — structured logging utility
  - `server/replit_integrations/auth/` — Passport.js LocalStrategy (email/password) auth setup
- **File uploads**: Multer (memory storage), files saved to `public/uploads/`, served statically at `/uploads`
- **Shared types**: `shared/schema.ts` and `shared/routes.ts` are imported by both client and server for type-safe API contracts

### Authentication & Authorization

- **Auth Provider**: Email + password via Passport.js LocalStrategy (no Replit OIDC)
- **Password hashing**: `crypto.scryptSync` (Node built-in, no bcrypt dependency)
- **Session storage**: PostgreSQL-backed sessions via `connect-pg-simple`, stored in `http_sessions` table
- **Session secret**: `SESSION_SECRET` environment variable
- **User registration flow**: Users register via `/login` page (create account form) → account created with status `pending` → platform_owner approves in admin panel and assigns studio + role
- **Platform owner seed**: Auto-created at startup: `borbaggabriel@gmail.com` / `pipoca25`
- **Role system** (hierarchical):
  - `platform_owner` (100) — full platform access, admin panel
  - `studio_admin` (80) — manage studio members and settings
  - `diretor` (60) — create productions, manage staff
  - `engenheiro_audio` (40) — create sessions, edit scripts
  - `dublador` (20) — access recording rooms
  - `aluno` (10) — view-only access
- **Studio membership**: Users can have multiple roles within a studio via `userStudioRoles` table; membership approval flow via `studioMemberships`
- **Frontend auth flow**: `useAuth` hook fetches `/api/auth/user`; login via POST `/api/auth/login`; register via POST `/api/auth/register`; logout via POST `/api/auth/logout`; unauthenticated users are redirected to `/login`

### Data Storage

- **Database**: PostgreSQL via Drizzle ORM (dialect: postgresql)
- **Schema location**: `shared/schema.ts` (main) + `shared/models/auth.ts` (auth tables)
- **Key tables**:
  - `http_sessions` — Replit Auth session store (mandatory, do not drop)
  - `users` — combined Replit Auth + VHUB profile
  - `user_roles` — platform-level roles
  - `studios` — studio profiles with address, contact, and media
  - `studio_memberships` — pending/approved studio membership requests
  - `user_studio_roles` — per-studio role assignments
  - `productions` — dubbing production records with video URL and JSON script
  - `characters` — characters per production
  - `sessions` — recording sessions with scheduling
  - `session_participants` — session attendees
  - `takes` — audio take records linked to sessions/characters
  - `staff` — studio staff registry
  - `audit_log` — platform action audit trail
  - `platform_settings` — key/value platform configuration
  - `notifications` — user notification inbox
- **Migrations**: `drizzle-kit push` (`npm run db:push`) for schema deployment; migration files in `./migrations`

### API Structure

- Type-safe API contract defined in `shared/routes.ts` using Zod schemas for request inputs and response shapes
- `buildUrl` utility for parameterized URL construction (shared between client hooks and server routes)
- REST endpoints grouped by resource: `/api/studios`, `/api/productions`, `/api/sessions`, `/api/characters`, `/api/staff`, `/api/takes`, `/api/notifications`, `/api/admin/*`, `/api/auth/*`
- All protected routes use `requireAuth` middleware; role-specific routes layer additional middleware

### Build & Dev

- Dev: `tsx server/index.ts` serves both Express API and Vite middleware (HMR via WebSocket at `/vite-hmr`)
- Production build: `script/build.ts` runs Vite (client → `dist/public`) then esbuild (server → `dist/index.cjs`)
- Path aliases: `@/*` → `client/src/*`, `@shared/*` → `shared/*`, `@assets/*` → `attached_assets/*`

## External Dependencies

### Required Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing secret |
| `REPL_ID` | Replit deployment ID (used by OIDC client discovery) |
| `ISSUER_URL` | OIDC issuer (defaults to `https://replit.com/oidc`) |

### Third-Party Services

- **Replit Auth (OpenID Connect)**: Primary authentication provider. OIDC discovery at `https://replit.com/oidc`. Uses `openid-client` + `passport` + `passport-local`. Session tokens stored in PostgreSQL.
- **PostgreSQL**: Primary data store. Managed via Drizzle ORM with `node-postgres` (pg) driver.
- **Google Fonts**: Inter and JetBrains Mono loaded via CDN in `index.html` and `index.css`

### Key NPM Dependencies

- `drizzle-orm` + `drizzle-kit` — ORM and migration tooling
- `express` + `express-session` — HTTP server and session management
- `connect-pg-simple` — PostgreSQL session store adapter
- `passport` + `openid-client` — OIDC authentication
- `@tanstack/react-query` — client-side data fetching and caching
- `wouter` — client-side routing
- `@radix-ui/*` — accessible UI primitives
- `tailwind-merge` + `clsx` — CSS class utilities
- `zod` + `drizzle-zod` — runtime validation and schema inference
- `multer` — multipart file upload handling
- `date-fns` — date formatting (used in session scheduling and activity timestamps)
- `memoizee` — memoization for OIDC config fetching

### Replit-Specific Plugins (Dev Only)

- `@replit/vite-plugin-runtime-error-modal` — overlay for runtime errors
- `@replit/vite-plugin-cartographer` — Replit code mapping
- `@replit/vite-plugin-dev-banner` — Replit dev banner