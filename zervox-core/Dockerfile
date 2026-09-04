# ==========================================
# Multi-Stage Production Dockerfile for Zervox
# ==========================================

# Stage 1: Build binary
FROM rust:1.80-bullseye AS builder

WORKDIR /usr/src/zervox-core

# Install build dependencies including libsqlite3 & ssl
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY policies ./policies

RUN cargo build --release

# Stage 2: Minimal hardened runtime
FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl1.1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -u 10001 -U -d /app -s /bin/false zervox && \
    mkdir -p /app/data /app/policies && \
    chown -R zervox:zervox /app

WORKDIR /app

COPY --from=builder /usr/src/zervox-core/target/release/zervox-core /app/zervox-core
COPY policies /app/policies

USER zervox

ENV ZERVOX_HTTP_PORT=8080
ENV ZERVOX_HEARTBEAT_PORT=9000
ENV ZERVOX_DB_PATH=/app/data/zervox.db
ENV OPA_URL=http://127.0.0.1:8181/v1/data/zervox/authz

EXPOSE 8080 9000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/app/zervox-core"]
