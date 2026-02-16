---
title: Deploy with Docker
sidebar_position: 4
description: "How to deploy Apiary using Docker and Docker Compose."
---

# Deploy with Docker

## Build the Docker Image

The project includes a multi-stage `Dockerfile` that builds both the CLI binary and the Python wheel:

```dockerfile
# ---------- Stage 1: Builder ----------
FROM rust:slim-bookworm AS builder

RUN apt-get update && apt-get install -y \
    build-essential libssl-dev pkg-config \
    python3 python3-dev python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages maturin

WORKDIR /build
COPY . .

RUN cargo build --release -p apiary-cli
RUN maturin build --release

# ---------- Stage 2: Runtime ----------
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    libssl3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 -s /bin/bash apiary

COPY --from=builder /build/target/release/apiary /usr/local/bin/apiary
COPY --from=builder /build/target/wheels/*.whl /tmp/
RUN pip3 install --no-cache-dir /tmp/*.whl && rm -f /tmp/*.whl
RUN pip3 install --no-cache-dir pyarrow pandas

COPY scripts/apiary-node.py /usr/local/bin/apiary-node.py
RUN chmod +x /usr/local/bin/apiary-node.py

USER apiary
WORKDIR /home/apiary
RUN mkdir -p /home/apiary/data /home/apiary/cache

EXPOSE 8080
CMD ["python3", "/usr/local/bin/apiary-node.py"]
```

Build the image:

```bash
docker build -t apiary:latest .

# For Raspberry Pi (ARM64)
docker build --platform linux/arm64 -t apiary:latest .

# Multi-arch (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t apiary:latest .
```

## Run a Single Container

```bash
# Solo mode with local storage
docker run -d --name apiary \
  -v apiary-data:/home/apiary/data \
  apiary:latest

# With MinIO storage
docker run -d --name apiary \
  -e AWS_ACCESS_KEY_ID=minioadmin \
  -e AWS_SECRET_ACCESS_KEY=minioadmin \
  -e AWS_ENDPOINT_URL=http://minio:9000 \
  -e APIARY_STORAGE_URL=s3://apiary/data \
  -e APIARY_NAME=production \
  apiary:latest
```

## Multi-Node with Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  minio:
    image: minio/minio:latest
    container_name: apiary-minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  minio-setup:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      /usr/bin/mc config host add myminio http://minio:9000 $${MINIO_ROOT_USER:-minioadmin} $${MINIO_ROOT_PASSWORD:-minioadmin};
      /usr/bin/mc mb myminio/apiary --ignore-existing;
      exit 0;
      "
    restart: "no"

  apiary-node:
    image: ${APIARY_IMAGE:-apiary:latest}
    depends_on:
      minio-setup:
        condition: service_completed_successfully
    environment:
      AWS_ACCESS_KEY_ID: ${MINIO_ROOT_USER:-minioadmin}
      AWS_SECRET_ACCESS_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      AWS_ENDPOINT_URL: http://minio:9000
      APIARY_STORAGE_URL: ${APIARY_STORAGE_URL:-s3://apiary/data}
      APIARY_NAME: ${APIARY_NAME:-production}
      RUST_LOG: ${RUST_LOG:-info}
    volumes:
      - apiary-cache:/home/apiary/cache
    restart: unless-stopped

volumes:
  minio-data:
  apiary-cache:
```

Start the cluster:

```bash
docker compose up -d
```

:::note
The compose file uses a single `apiary-node` service that can be scaled. Nodes discover each other automatically through MinIO -- no additional configuration needed.
:::

## Scale Nodes

Add more nodes by scaling the service:

```bash
# Scale to 5 nodes
docker compose up -d --scale apiary-node=5
```

Nodes discover each other automatically through MinIO -- no additional configuration needed.

## Verify the Cluster

Connect from a Python client:

```python
import os
os.environ["AWS_ACCESS_KEY_ID"] = "minioadmin"
os.environ["AWS_SECRET_ACCESS_KEY"] = "minioadmin"
os.environ["AWS_ENDPOINT_URL"] = "http://localhost:9000"

from apiary import Apiary
ap = Apiary("production", storage="s3://apiary/data")
ap.start()

swarm = ap.swarm_status()
print(f"Total bees: {swarm['total_bees']}, Idle: {swarm['total_idle_bees']}")
for node in swarm['nodes']:
    print(f"  {node['node_id']}: {node['state']}")

ap.shutdown()
```

:::tip
For Raspberry Pi-specific Docker Compose profiles with resource constraints matched to each Pi model, see [Pi Deploy Profiles](/docs/how-to/deploy-pi-profiles).
:::

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Containers can't reach MinIO | Check that all containers are on the same Docker network |
| MinIO bucket not created | Check `minio-init` container logs: `docker compose logs minio-init` |
| Nodes not discovering each other | Verify all nodes use the same `APIARY_STORAGE` value |
| Out of memory | Limit container memory with `deploy.resources.limits.memory` |
