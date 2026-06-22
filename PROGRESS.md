# Clever Sloth — Build Progress & Roadmap

> Living status doc for the project — what's done, how to run it, and what's next.

- **Last updated:** 2026-06-22
- **Current status:** Phases 1–3 complete (full application). Next up: Phase 4 (Kubernetes / DevOps).

---

## How to run locally

```bash
# 1. Start infrastructure (Postgres :5433, Redis, MinIO, MailHog)
docker compose up -d

# 2. Run the API (http://localhost:8080)
cd apps/api && go run ./cmd/server      # wait for "migrations applied"

# 3. Run the web app (http://localhost:3000)
cd apps/web && pnpm install
pnpm dev          # or, on low-RAM machines: pnpm build && pnpm start
```

**Notes / gotchas (Windows):**
- Postgres is mapped to host port **5433** (a native PostgreSQL install owns 5432). Dev DSN uses `127.0.0.1:5433`.
- On a low-RAM machine, the Next.js **dev** server is heavy — prefer `pnpm build && pnpm start` (production mode, ~150 MB).
- A backgrounded Go server isn't reliably stopped by `kill`; use `taskkill /F /IM cs-api.exe`.

---

## Tech stack
Go + Fiber (API) · Next.js 16 + React 19 + Tailwind v4 (web) · PostgreSQL · Redis · MinIO · MailHog ·
Turborepo + pnpm · Docker Compose. Target platform: Kubernetes (k3s).

---

## ✅ Phase 1 — Foundation (DONE)
- Turborepo monorepo (`apps/web`, `apps/api`, `packages/*`)
- Go API: `/healthz` (liveness), `/readyz` (DB-aware readiness), `/metrics` (Prometheus)
- Structured JSON logging, graceful shutdown, 12-factor env config
- `docker-compose.yml`: Postgres(:5433), Redis, MinIO, MailHog
- DB schema: 14 GORM models + AutoMigrate
- JWT auth: register / login / refresh / logout / me; bcrypt; httpOnly refresh cookie
- Auto-provision a personal workspace + admin membership on signup

## ✅ Phase 2 — Core backend (DONE)
- Projects CRUD + membership/roles (owner/admin/member/viewer; add member by email)
- Issues CRUD (epic/story/task/subtask/bug; auto keys `CS-1` via row-locked counter; filters)
- Kanban board endpoint (issues grouped by status, rank-ordered)
- Activity/audit log on status/priority/assignee changes
- Sprints (create/list/update/start/complete; completing returns unfinished issues to backlog)
- Comments (create/list)
- Attachments → MinIO presigned PUT/GET URLs
- WebSocket live board updates (issue.created/updated/deleted; `?token=` auth guard)

## ✅ Phase 3 — App features (DONE)
- Full frontend: landing, auth pages, app shell (sidebar + auth guard)
- Projects list + create
- Kanban board: drag-and-drop across columns (rank ordering), create issue, live updates
- Rich issue detail: editable title/description, status/priority, comments, activity log, attachments
- Backlog (search, grooming, assign-to-sprint), Sprints UI, Dashboard (charts)
- Search across issues; RBAC enforced in the backend
- Deferred (low priority): email notifications, roadmap/timeline view

---

## 🔜 Phases 4–6 — Kubernetes / DevOps (NEXT)
- **Phase 4:** multi-stage Docker images for api/web → k3s cluster → Helm chart → Ingress + cert-manager (TLS) → Sealed Secrets
- **Phase 5:** Prometheus + Grafana dashboards, Loki + Promtail logs, Alertmanager
- **Phase 6:** ArgoCD (GitOps), Linkerd service mesh (mTLS, canary, tracing), HPA, NetworkPolicies, custom Operator (`CleverSlothProject` CRD)

> First decision for Phase 4: where the cluster runs. The full stack needs ~8 GB+; on a 7.4 GB
> machine, the Oracle Cloud always-free tier (4 ARM cores / 24 GB) is the recommended host.

---

## Repo layout (key paths)
```
apps/api/   cmd/server/main.go · internal/{config,database,models,handlers,auth,middleware,ws,storage,observability,server}
apps/web/   app/(auth) · app/(app)/projects/[projectId]/{board,backlog,sprints,dashboard} · components/{ui,board} · lib/ · store/
docker-compose.yml · turbo.json · package.json
```

## ⏭️ Next action
Start Phase 4: decide cluster location, then write Dockerfiles for `api` and `web`, stand up k3s,
and deploy via a Helm chart to a `clever-sloth-dev` namespace.
