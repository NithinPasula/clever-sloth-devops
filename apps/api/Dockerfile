# syntax=docker/dockerfile:1

# ---- Stage 1: build ----------------------------------------------------------
# A full Go toolchain image. We only use it to COMPILE; it never ships.
FROM golang:1.25-alpine AS builder

WORKDIR /src

# Copy just the dependency manifests first. Docker caches each layer, so as long
# as go.mod/go.sum don't change, the (slow) module download is reused on rebuilds
# even when your application code changes. This is the #1 Docker build-speed trick.
COPY go.mod go.sum ./
RUN go mod download

# Now copy the rest of the source.
COPY . .

# Build a fully static binary:
#   CGO_ENABLED=0  -> no libc dependency, so it runs on `scratch`/distroless.
#   -ldflags "-s -w" strips debug info & symbol tables -> smaller binary.
#   -trimpath removes local filesystem paths from the binary (reproducible builds).
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath -ldflags="-s -w" \
    -o /out/cs-api ./cmd/server

# ---- Stage 2: runtime --------------------------------------------------------
# Distroless "static" = just the bare minimum to run a static binary: no shell,
# no package manager, no OS userland. Tiny and a much smaller attack surface.
FROM gcr.io/distroless/static-debian12:nonroot

# Copy ONLY the compiled binary out of the builder stage. The Go toolchain,
# source code, and module cache are all left behind.
COPY --from=builder /out/cs-api /cs-api

# Run as an unprivileged user (provided by the :nonroot tag, UID 65532).
USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/cs-api"]
