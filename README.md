# 🦥 Clever Sloth

**A self-hosted, Jira-style project management platform**

> **Created and built by [Nithin Pasula](https://github.com/NithinPasula).**
> This project is designed, owned, and maintained by Nithin Pasula as a hands-on platform for mastering production-grade Kubernetes and DevOps.

---

## 📖 Overview

Clever Sloth is a full-featured project tracker (a focused, open-source take on Jira) built from scratch. It is **100% free and self-hostable** — every component is open-source, with no paid services.

The application is intentionally engineered as the **workload for a real DevOps journey**: it ships with health/readiness probes, Prometheus metrics, structured logging, graceful shutdown, and 12-factor configuration — so it can be deployed and operated on Kubernetes the way real production systems are.

**Status:** ✅ Application (Phases 1–3) complete — currently moving into the Kubernetes / DevOps phases.

---

## ✨ Features

### Project & issue management
- **Workspaces & projects** with role-based access (owner / admin / member / viewer)
- **Issues** with types (Epic, Story, Task, Sub-task, Bug), priorities, and auto-generated keys (`CS-1`, `CS-2`, …)
- **Kanban board** with drag-and-drop across columns and **real-time updates over WebSockets**
- **Backlog** with search, grooming, and assign-to-sprint
- **Sprints** — create, start, and complete (incomplete work returns to the backlog)
- **Dashboard** — analytics by status, priority, and type
- **Rich issue detail** — editable title/description, comments, full **activity/audit log**, and **file attachments**

### Engineering & security
- JWT auth (access + refresh tokens), bcrypt password hashing, httpOnly refresh cookies
- No user enumeration on login; JWT algorithm-confusion protection
- Presigned S3 (MinIO) uploads — files never pass through the API
- Prometheus `/metrics`, `/healthz` (liveness) and `/readyz` (DB-aware readiness)
- Structured JSON logs, graceful shutdown, env-based configuration

---

## 🧱 Tech stack

| Layer | Technology |
|------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, dnd-kit, Zustand |
| Backend | Go, Fiber, GORM |
| Database | PostgreSQL 16 |
| Cache / realtime | Redis |
| Object storage | MinIO (S3-compatible) |
| Email (dev) | MailHog |
| Monorepo | Turborepo + pnpm |
| Local infra | Docker Compose |
| Target platform | Kubernetes (k3s) |

---

## 📂 Repository structure

```
clever-sloth/
├── apps/
│   ├── api/                 # Go + Fiber backend
│   │   ├── cmd/server/      # entrypoint
│   │   └── internal/        # config, database, models, handlers, auth, ws, storage, observability
│   └── web/                 # Next.js 16 frontend
│       ├── app/             # routes (auth, projects, board, backlog, sprints, dashboard)
│       ├── components/      # UI primitives + board components
│       └── lib/, store/     # API client, types, auth store
├── packages/                # shared config (eslint, typescript, ui)
├── docker-compose.yml       # local infra: Postgres, Redis, MinIO, MailHog
└── PROGRESS.md              # detailed build log & roadmap
```

---

## 🚀 Getting started (local)

**Prerequisites:** Docker Desktop, Go 1.24+, Node 20+, pnpm 9+.

```bash
# 1. Start infrastructure (Postgres :5433, Redis, MinIO, MailHog)
docker compose up -d

# 2. Run the API (http://localhost:8080)
cd apps/api
go run ./cmd/server

# 3. Run the web app (http://localhost:3000)
cd apps/web
pnpm install
pnpm dev        # or: pnpm build && pnpm start  (lighter on low-RAM machines)
```

Open http://localhost:3000, sign up, create a project, and start tracking work.

> **Note:** The Postgres container is mapped to host port **5433** to avoid clashing with a local PostgreSQL install on 5432.

---

## 🔌 API overview

Base path: `/api/v1`

- **Auth:** `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`
- **Workspaces / Projects:** `GET /workspaces`, `POST|GET /workspaces/:id/projects`, `GET|PATCH /projects/:id`, project members
- **Issues:** `POST|GET /projects/:id/issues`, `GET /projects/:id/board`, `GET|PATCH|DELETE /issues/:id`, `/issues/:id/activity`
- **Comments / Attachments:** `/issues/:id/comments`, `/issues/:id/attachments`, `/attachments/:id/download`
- **Sprints:** `POST|GET /projects/:id/sprints`, `/sprints/:id/start`, `/sprints/:id/complete`
- **Realtime:** `GET /projects/:id/board/ws` (WebSocket)
- **Ops:** `/healthz`, `/readyz`, `/metrics`

---

## 🗺️ Roadmap — the DevOps phases (next)

The application is the foundation; the next phases turn it into a production-grade, observable, GitOps-managed system on Kubernetes:

- **Phase 4 — Kubernetes:** multi-stage Docker images, k3s cluster, Helm chart, Ingress + cert-manager (TLS), Sealed Secrets
- **Phase 5 — Observability:** Prometheus + Grafana dashboards, Loki + Promtail log aggregation, Alertmanager
- **Phase 6 — Advanced platform:** ArgoCD (GitOps), Linkerd service mesh (mTLS, canary, tracing), HPA, NetworkPolicies, and a **custom Kubernetes Operator** (`CleverSlothProject` CRD)


---

## 👤 Author

**Nithin Pasula** — creator, architect, and maintainer of Clever Sloth.
GitHub: [@NithinPasula](https://github.com/NithinPasula)

## 📄 License

Released under the MIT License — © Nithin Pasula. See [`LICENSE`](./LICENSE).
