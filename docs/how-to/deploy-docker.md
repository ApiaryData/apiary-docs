---
title: Deploy with Docker
sidebar_position: 4
description: "How to deploy Apiary using Docker and Docker Compose."
---

# Deploy with Docker

## Build the Docker Image

Create a `Dockerfile` in the Apiary project root:

```dockerfile
# Build stage
FROM rust:1.75-bookworm AS builder

WORKDIR /app
COPY . .

RUN cargo build --workspace --release

# Python stage
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Rust artifacts
COPY --from=builder /app/target/release/apiary-cli /usr/local/bin/
COPY --from=builder /app/target/release/*.so /usr/local/lib/

# Install Python package
COPY pyproject.toml Cargo.toml ./
COPY python/ python/
COPY crates/ crates/

RUN pip install maturin && maturin develop --release

# Expose port for future HTTP API (v2 -- not active in v1)
# EXPOSE 8080
CMD ["python", "-c", "from apiary import Apiary; ap = Apiary('apiary', storage='${APIARY_STORAGE}'); ap.start(); import signal; signal.pause()"]
```

Build the image:

```bash
docker build -t apiary:latest .
```

## Run a Single Container

```bash
# Solo mode with local storage
docker run -d --name apiary \
  -v apiary-data:/root/.apiary \
  apiary:latest

# With MinIO storage
docker run -d --name apiary \
  -e AWS_ACCESS_KEY_ID=apiary \
  -e AWS_SECRET_ACCESS_KEY=apiary123 \
  -e AWS_ENDPOINT_URL=http://minio:9000 \
  -e APIARY_STORAGE=s3://apiary-data/prod \
  apiary:latest
```

## Multi-Node with Docker Compose

Create a `docker-compose.yml`:

```yaml
version: "3.8"

services:
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: apiary
      MINIO_ROOT_PASSWORD: apiary123
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio-init:
    image: minio/mc
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 apiary apiary123;
      mc mb --ignore-existing local/apiary-data;
      "

  apiary-node-1:
    image: apiary:latest
    depends_on:
      minio-init:
        condition: service_completed_successfully
    environment:
      AWS_ACCESS_KEY_ID: apiary
      AWS_SECRET_ACCESS_KEY: apiary123
      AWS_ENDPOINT_URL: http://minio:9000
      APIARY_STORAGE: s3://apiary-data/prod

  apiary-node-2:
    image: apiary:latest
    depends_on:
      minio-init:
        condition: service_completed_successfully
    environment:
      AWS_ACCESS_KEY_ID: apiary
      AWS_SECRET_ACCESS_KEY: apiary123
      AWS_ENDPOINT_URL: http://minio:9000
      APIARY_STORAGE: s3://apiary-data/prod

  apiary-node-3:
    image: apiary:latest
    depends_on:
      minio-init:
        condition: service_completed_successfully
    environment:
      AWS_ACCESS_KEY_ID: apiary
      AWS_SECRET_ACCESS_KEY: apiary123
      AWS_ENDPOINT_URL: http://minio:9000
      APIARY_STORAGE: s3://apiary-data/prod

volumes:
  minio-data:
```

Start the cluster:

```bash
docker compose up -d
```

## Scale Nodes

Add more nodes by scaling the service:

```bash
# Scale to 5 nodes
docker compose up -d --scale apiary-node-1=5
```

Or add additional service entries in the compose file. Nodes discover each other automatically through MinIO -- no additional configuration needed.

## Verify the Cluster

Connect from a Python client:

```python
import os
os.environ["AWS_ACCESS_KEY_ID"] = "apiary"
os.environ["AWS_SECRET_ACCESS_KEY"] = "apiary123"
os.environ["AWS_ENDPOINT_URL"] = "http://localhost:9000"

from apiary import Apiary
ap = Apiary("prod", storage="s3://apiary-data/prod")
ap.start()

swarm = ap.swarm_status()
print(f"Nodes alive: {swarm['alive']}, Total bees: {swarm['total_bees']}")

ap.shutdown()
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Containers can't reach MinIO | Check that all containers are on the same Docker network |
| MinIO bucket not created | Check `minio-init` container logs: `docker compose logs minio-init` |
| Nodes not discovering each other | Verify all nodes use the same `APIARY_STORAGE` value |
| Out of memory | Limit container memory with `deploy.resources.limits.memory` |
