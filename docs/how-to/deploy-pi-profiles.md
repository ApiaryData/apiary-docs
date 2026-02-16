---
title: Pi Deploy Profiles
sidebar_position: 11
description: "Docker Compose profiles for each Raspberry Pi model with resource constraints."
---

# Pi Deploy Profiles

Apiary provides 10 Docker Compose profiles that constrain container resources to match specific Raspberry Pi hardware. These are used for benchmarking, testing, and simulating Pi deployments on more powerful machines.

## Available Profiles

| Profile | File | Pi Model |
|---------|------|----------|
| Pi 3 | `deploy/docker-compose.pi3.yml` | Raspberry Pi 3 (1 GB RAM, 1.4 GHz) |
| Pi 4 1GB | `deploy/docker-compose.pi4-1gb.yml` | Raspberry Pi 4 (1 GB RAM, 1.5 GHz) |
| Pi 4 2GB | `deploy/docker-compose.pi4-2gb.yml` | Raspberry Pi 4 (2 GB RAM, 1.5 GHz) |
| Pi 4 4GB | `deploy/docker-compose.pi4-4gb.yml` | Raspberry Pi 4 (4 GB RAM, 1.5 GHz) |
| Pi 4 8GB | `deploy/docker-compose.pi4-8gb.yml` | Raspberry Pi 4 (8 GB RAM, 1.5 GHz) |
| Pi 5 1GB | `deploy/docker-compose.pi5-1gb.yml` | Raspberry Pi 5 (1 GB RAM, 2.4 GHz) |
| Pi 5 2GB | `deploy/docker-compose.pi5-2gb.yml` | Raspberry Pi 5 (2 GB RAM, 2.4 GHz) |
| Pi 5 4GB | `deploy/docker-compose.pi5-4gb.yml` | Raspberry Pi 5 (4 GB RAM, 2.4 GHz) |
| Pi 5 8GB | `deploy/docker-compose.pi5-8gb.yml` | Raspberry Pi 5 (8 GB RAM, 2.4 GHz) |
| Pi 5 16GB | `deploy/docker-compose.pi5-16gb.yml` | Raspberry Pi 5 (16 GB RAM, 2.4 GHz) |

## Resource Constraints

Each profile sets CPU and memory limits per container to simulate the target Pi model:

| Profile | CPU Limit | Memory/Node | Memory/MinIO | Node Reservation |
|---------|-----------|-------------|-------------|-----------------|
| Pi 3 | 2.0 | 512 MB | 512 MB | 256 MB |
| Pi 4 1GB | 2.0 | 512 MB | 512 MB | 256 MB |
| Pi 4 2GB | 2.0 | 1 GB | 768 MB | 512 MB |
| Pi 4 4GB | 2.0 | 2 GB | 1.5 GB | 1 GB |
| Pi 4 8GB | 2.0 | 4 GB | 3 GB | 2 GB |
| Pi 5 1GB | 2.5 | 512 MB | 512 MB | 256 MB |
| Pi 5 2GB | 2.5 | 1 GB | 768 MB | 512 MB |
| Pi 5 4GB | 2.5 | 2 GB | 1.5 GB | 1 GB |
| Pi 5 8GB | 2.5 | 4 GB | 3 GB | 2 GB |
| Pi 5 16GB | 2.5 | 8 GB | 6 GB | 4 GB |

**CPU limit rationale:**
- **Pi 3/4:** `cpus: '2.0'` simulates the 1.4--1.5 GHz quad-core at ~50% of a modern x86 core
- **Pi 5:** `cpus: '2.5'` simulates the 2.4 GHz quad-core at ~62% of a modern x86 core

## Architecture

All profiles follow the same 3-service pattern:

| Service | Purpose |
|---------|---------|
| `minio` | S3-compatible object storage with health check |
| `minio-setup` | One-shot container that creates the `apiary` bucket |
| `apiary-node` | Scalable Apiary compute node |

## Usage

### Start a Profile

```bash
# Single node with Pi 4 4GB constraints
docker compose -f deploy/docker-compose.pi4-4gb.yml up -d

# Three nodes
docker compose -f deploy/docker-compose.pi4-4gb.yml up -d --scale apiary-node=3
```

### Stop

```bash
docker compose -f deploy/docker-compose.pi4-4gb.yml down
```

### Override Environment Variables

All profiles support these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ROOT_USER` | `minioadmin` | MinIO admin username |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | MinIO admin password |
| `APIARY_STORAGE_URL` | `s3://apiary/data` | Storage URL for Apiary nodes |
| `APIARY_NAME` | `{profile}-benchmark` | Instance name (varies per profile) |
| `APIARY_IMAGE` | `apiary:latest` | Docker image to use |
| `RUST_LOG` | `info` | Log verbosity |

```bash
# Custom image and log level
APIARY_IMAGE=apiary:dev RUST_LOG=debug docker compose -f deploy/docker-compose.pi4-4gb.yml up -d
```

## Choosing a Profile

| Scenario | Recommended Profile |
|----------|-------------------|
| Quick smoke tests | Pi 3 or Pi 4 1GB (most constrained) |
| Realistic Pi deployment testing | Pi 4 4GB or Pi 5 4GB |
| Performance benchmarking | Pi 5 8GB or Pi 5 16GB |
| Stress testing / finding limits | Pi 3 (most constrained) |
| Cloud-like testing | Use the main `docker-compose.yml` without resource constraints |

## Use with Benchmarks

The benchmark framework integrates with these profiles via the `--profile` flag:

```bash
python benchmarks/bench_runner.py --suite ssb --engine apiary-docker --image apiary:latest --profile pi4-4gb
```

See [Benchmarks](/docs/reference/benchmarks) for the full benchmark framework documentation.
