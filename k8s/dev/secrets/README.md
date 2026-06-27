# Dev secrets

Real Kubernetes `Secret` manifests live here but are **gitignored** — credentials
must never be committed. Only the `*.example.yaml` templates are tracked.

## First-time setup (or after recreating the cluster)

Copy each template, fill in real values, and apply the secrets **before** the
workloads that consume them:

```bash
# 1. create the real secret files from templates (one-time)
cp postgres-secret.example.yaml postgres-secret.yaml
cp minio-secret.example.yaml    minio-secret.yaml
cp api-secret.example.yaml      api-secret.yaml
# ...edit each and replace CHANGE_ME...

# 2. apply secrets first, then the rest of the manifests
kubectl apply -f k8s/dev/secrets/
kubectl apply -f k8s/dev/
```

The Deployments/StatefulSet reference these by name (`envFrom.secretRef`), so the
secrets must exist in the namespace for the pods to start.

A later step replaces this with **Sealed Secrets**, which encrypts the secret so
the *encrypted* form is safe to commit to git.
