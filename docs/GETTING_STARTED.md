# Getting Started with Clever Sloth

A step-by-step guide for someone who just cloned this repo and wants to run
Clever Sloth — either as a **quick local app** or as the **full Kubernetes +
GitOps + observability stack** it was built to showcase.

> **What is this?** A self-hosted Jira-style project tracker (Go API + Next.js web,
> Postgres/Redis/MinIO) deployed on a local Kubernetes cluster with Helm, GitOps
> (ArgoCD), TLS, Sealed Secrets, NetworkPolicies, autoscaling, and a full
> observability stack (Prometheus/Grafana/Loki). 100% free and local.

There are two ways to run it. Pick based on what you want:

| Path | You get | Effort |
|------|---------|--------|
| **A — Local dev** (docker compose) | The app running at `localhost:3000` | 5 minutes |
| **B — Full Kubernetes** | The whole DevOps stack (the real showcase) | 30–45 minutes |

---

## Prerequisites

**Path A** needs: Docker Desktop, Go 1.25+, Node 22+, pnpm 9+.

**Path B** additionally needs these CLIs (on Windows, `choco install` each):
- **kubectl**, **helm**, **k3d** (runs k3s in Docker)
- **kubeseal** (only if you want the production Sealed-Secrets flow)
- Docker Desktop with **≥ 4 GB** given to the Docker/WSL2 VM (this stack is RAM-hungry).

Clone the repo:
```bash
git clone https://github.com/NithinPasula/clever-sloth-devops.git
cd clever-sloth-devops
```

---

## Path A — Quick local dev (docker compose)

Good for just trying the app or doing feature development.

```bash
# 1. Start infrastructure (Postgres :5433, Redis, MinIO, MailHog)
docker compose up -d

# 2. Run the API (http://localhost:8080)
cd apps/api && go run ./cmd/server          # wait for "migrations applied"

# 3. Run the web app (http://localhost:3000)
cd apps/web && pnpm install && pnpm dev      # or: pnpm build && pnpm start (lighter)
```

Open **http://localhost:3000**, sign up, create a project, start tracking work.
Postgres is on host port **5433** to avoid clashing with a local Postgres on 5432.

That's it for Path A. Everything below is the Kubernetes showcase.

---

## Path B — Full Kubernetes deployment

### ⚠️ Things you MUST change/set before running

Read this first — these are the steps newcomers miss:

1. **Your own secret values.** Copy the example and edit it:
   ```bash
   cp k8s/charts/clever-sloth/values.local.example.yaml \
      k8s/charts/clever-sloth/values.local.yaml
   # edit: postgres.password, minio.rootUser/rootPassword, api.jwtSecret
   ```
   `values.local.yaml` is **gitignored** — real secrets never get committed.

2. **The committed Sealed Secrets will NOT work on your cluster.** A `SealedSecret`
   is encrypted for one specific `sealed-secrets` controller's private key. Your
   fresh cluster has a *different* key, so the repo's `k8s/dev/secrets/*-sealed.yaml`
   can't be decrypted by your controller. **Two options:**
   - **Easy (recommended for a first run):** let the chart create plaintext Secrets
     from your `values.local.yaml` by setting `--set secrets.create=true` at install
     time (see Step 6). No kubeseal needed.
   - **Production-style:** re-seal your own secrets with `kubeseal` (Step 6, option B).

3. **Hosts file** — map the app's hostnames to your machine. Add to
   `C:\Windows\System32\drivers\etc\hosts` (or `/etc/hosts`):
   ```
   127.0.0.1  clever-sloth.local
   127.0.0.1  minio.clever-sloth.local
   127.0.0.1  grafana.clever-sloth.local
   ```

4. **TLS trust.** The cluster uses a self-signed **private CA** (via cert-manager).
   Your browser won't trust it until you either add the CA to your OS trust store
   (extract it from the `clever-sloth-ca` issuer's secret — see `k8s/dev/tls.yaml`)
   or simply click through the browser warning. HTTP auto-redirects to HTTPS.

5. **The web image bakes its API URL at build time** (`NEXT_PUBLIC_API_URL`). If you
   change the app hostname, rebuild the web image with the new URL (Step 5).

---

### Step 1 — Create the k3d cluster

Traefik is disabled because we use ingress-nginx. Map ports 80/443 to the load balancer:
```bash
k3d cluster create clever-sloth \
  --k3s-arg "--disable=traefik@server:*" \
  -p "80:80@loadbalancer" -p "443:443@loadbalancer"
kubectl cluster-info        # confirm the cluster is up
```
> **kubeconfig gotcha:** if `kubectl` can't reach the API server, k3d may have written
> `host.docker.internal` as the server host. Repoint your kubeconfig's server to
> `https://127.0.0.1:<port>` (find the `->6443` port via `docker ps` on
> `k3d-clever-sloth-serverlb`).

### Step 2 — Install cluster prerequisites (Helm)

```bash
# ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# cert-manager (TLS)
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace \
  --set crds.enabled=true

# sealed-secrets controller (only needed for the production secrets flow)
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system
```
Wait for each to be Ready (`kubectl get pods -A`).

### Step 3 — Bootstrap the TLS issuers

```bash
kubectl apply -f k8s/dev/tls.yaml     # SelfSigned + private-CA ClusterIssuers
```

### Step 4 — Create the app namespace

```bash
kubectl create namespace clever-sloth-dev
```

### Step 5 — Build & import the images

k3d uses its own containerd, so images are **imported**, not pulled:
```bash
docker build -t clever-sloth-api:dev ./apps/api
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://clever-sloth.local/api/v1 \
  -t clever-sloth-web:dev .
k3d image import clever-sloth-api:dev clever-sloth-web:dev -c clever-sloth
```
> **Prefer not to build?** The images are on Docker Hub — skip this step and point the chart
> at `nithinpasula195/clever-sloth-{api,web}` instead (see **Prebuilt images** at the end).

### Step 6 — Provide the secrets

**Option A — Easy (chart creates them from your values):** skip to Step 7 and add
`--set secrets.create=true` to the install command.

**Option B — Production (Sealed Secrets):** write your plaintext Secrets (use the
`k8s/dev/secrets/*-secret.example.yaml` files as templates), then seal + apply:
```bash
kubeseal --format yaml -f my-secret.yaml > k8s/dev/secrets/my-secret-sealed.yaml
kubectl apply -f k8s/dev/secrets/          # controller decrypts -> real Secrets
```

### Step 7 — Install the app

```bash
# Option A (easy): chart creates Secrets from values.local.yaml
helm install clever-sloth k8s/charts/clever-sloth -n clever-sloth-dev \
  -f k8s/charts/clever-sloth/values.local.yaml --set secrets.create=true

# Option B (production): Secrets already exist from Step 6, keep chart default
helm install clever-sloth k8s/charts/clever-sloth -n clever-sloth-dev \
  -f k8s/charts/clever-sloth/values.local.yaml
```

### Step 8 — Verify & open

```bash
kubectl get pods -n clever-sloth-dev -w     # wait for web/api/postgres/redis/minio = 1/1
```
Open **https://clever-sloth.local**, sign up, and you're in. 🦥

---

## Using the app (feature tour)

- **Projects** — create one; its `KEY` prefixes issue keys (e.g. `CS-1`).
- **Board** — Kanban with **drag-and-drop** (Pragmatic DnD) and real-time updates over
  WebSocket. Drag a card between columns; open another browser tab to see it sync live.
- **Backlog** — issues not in a sprint; search, set status, assign to a sprint.
- **Sprints** — create, **start**, and **complete** sprints; each shows a progress bar.
- **Issue detail** — edit title/description, set status/priority, add **comments**, upload
  **attachments** (stored in MinIO via presigned URLs), and see the **activity log**.
- **Dashboard** — issue counts and breakdowns by status / priority / type.
- **⌘K command palette** — jump to any project or page; toggle light/dark theme.

---

## Observability (Prometheus, Grafana, Loki)

> ⚠️ **RAM note:** on a small machine, run the monitoring stack and ArgoCD **one at a
> time** — not alongside each other. Bring monitoring up in stages if the node struggles.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace --version 87.3.0 \
  -f k8s/monitoring/kube-prometheus-stack.values.yaml

kubectl apply -f k8s/monitoring/grafana-dashboard-api.yaml   # API dashboard (as code)
kubectl apply -f k8s/monitoring/prometheus-rules.yaml        # SLO alert rules

# Logs (Loki + Promtail)
helm repo add grafana https://grafana.github.io/helm-charts
helm upgrade --install loki grafana/loki -n monitoring --version 6.55.0 \
  -f k8s/monitoring/loki.values.yaml
helm upgrade --install promtail grafana/promtail -n monitoring --version 6.17.1 \
  -f k8s/monitoring/promtail.values.yaml
kubectl apply -f k8s/monitoring/loki-datasource.yaml
```

**Access:**
- **Grafana** → **https://grafana.clever-sloth.local**. Login `admin` /
  `kubectl get secret -n monitoring monitoring-grafana -o jsonpath='{.data.admin-password}' | base64 -d`.
  Open the **Clever Sloth** folder → API dashboard (request rate, error rate, p50/p95/p99
  latency). For **logs**, go to **Explore** → Loki datasource →
  `{namespace="clever-sloth-dev", container="api"} | json`.
- **Prometheus** → `kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n monitoring 9090:9090`
  → http://localhost:9090 (**Status → Targets** should show the api **UP**; **Alerts** shows the SLO rules).
- **Alertmanager** → `kubectl port-forward svc/monitoring-kube-prometheus-alertmanager -n monitoring 9093:9093`
  → http://localhost:9093.

---

## GitOps with ArgoCD

```bash
kubectl create namespace argocd
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd --version 10.1.0 -n argocd -f k8s/argocd/values.yaml

# Point ArgoCD at the app (Helm chart on this repo's main branch)
kubectl apply -f k8s/argocd/apps/clever-sloth-dev.yaml
```
> If you forked the repo, edit `repoURL` in `k8s/argocd/apps/clever-sloth-dev.yaml` to
> your fork first, and make sure the repo is public (or add credentials in ArgoCD).

**Access:**
- `kubectl -n argocd port-forward svc/argocd-server 8080:80` → http://localhost:8080
- Login `admin` /
  `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`
- The `clever-sloth-dev` app should go **Synced / Healthy**. Auto-sync + self-heal are on:
  try `kubectl -n clever-sloth-dev scale deploy/api --replicas=3` and watch ArgoCD revert it.

---

## Security & scaling (already in the chart)

- **NetworkPolicies** (`networkPolicy.enabled: true`) — default-deny ingress + least-privilege
  allows (web←ingress, api←ingress+monitoring, datastores←api). Requires a CNI that enforces
  NetworkPolicy (k3s does). Verify: a pod that isn't `app=api` cannot reach `postgres:5432`.
- **HPA** (`autoscaling.enabled: true`) — CPU-based autoscaling of the API (1→4). Requires
  metrics-server (bundled with k3s). `kubectl get hpa -n clever-sloth-dev`.

---

## Troubleshooting

- **Pods stuck Pending / node NotReady / everything slow** → RAM pressure. Give Docker more
  memory, or scale down what you're not using (`kubectl scale ... --replicas=0`). Don't run
  monitoring + ArgoCD together on a small box.
- **Browser TLS warning** → expected with the private CA; trust the CA cert or click through.
- **`kubectl` can't reach the cluster** → the kubeconfig `host.docker.internal` gotcha (Step 1).
- **App loads but attachments fail** → check the `minio.clever-sloth.local` hosts entry and that
  the MinIO ingress + TLS secret exist.
- **Grafana shows "No data"** → confirm Prometheus **Targets** show the api UP, and that the
  app's `ServiceMonitor` exists (`kubectl get servicemonitor -A`).

## Teardown

```bash
k3d cluster delete clever-sloth        # removes the whole cluster
docker compose down -v                 # (Path A) stop local infra + volumes
```

---

## Prebuilt images (skip the build)

The images are published publicly on Docker Hub, so you can skip **Step 5** entirely:

- **API** → [`nithinpasula195/clever-sloth-api`](https://hub.docker.com/r/nithinpasula195/clever-sloth-api)
- **Web** → [`nithinpasula195/clever-sloth-web`](https://hub.docker.com/r/nithinpasula195/clever-sloth-web)

Point the chart at them by adding to your `values.local.yaml`:
```yaml
api:
  image: nithinpasula195/clever-sloth-api:0.1.0
web:
  image: nithinpasula195/clever-sloth-web:0.1.0
```
The cluster will pull them straight from Docker Hub (no `k3d image import` needed).

> **Caveat:** the published **web** image bakes `NEXT_PUBLIC_API_URL=https://clever-sloth.local/api/v1`
> at build time, so it only works for the local `clever-sloth.local` hostname described in this guide.
> For a different/public hostname, rebuild the web image with your URL (Step 5). Images are **amd64**.
