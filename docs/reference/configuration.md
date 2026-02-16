---
title: Configuration
sidebar_position: 3
description: "Configuration reference for Apiary constructor, environment variables, and tuning parameters."
---

# Configuration Reference

## Constructor Parameters

The `Apiary` constructor accepts two parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `str` | (required) | Logical name for this apiary. Used as the root namespace and the default directory name for local storage. |
| `storage` | `str \| None` | `None` | Storage URI. When `None`, uses local filesystem at `~/.apiary/data/{name}/`. |

### Storage URI Formats

| Format | Backend | Example |
|--------|---------|---------|
| `None` / omitted | Local filesystem | `Apiary("mydb")` -- stores at `~/.apiary/data/mydb/` |
| `s3://bucket/path` | AWS S3 | `Apiary("prod", storage="s3://my-bucket/apiary")` |
| `s3://bucket/path?endpoint=http://host:port` | MinIO / S3-compatible | `Apiary("prod", storage="s3://data@minio.local:9000")` |

:::note
Google Cloud Storage is supported via its [S3-compatible endpoint](https://cloud.google.com/storage/docs/interoperability). Use `s3://` URIs with GCS HMAC credentials and `AWS_ENDPOINT_URL=https://storage.googleapis.com`. Native `gs://` URIs are not supported in v1.
:::

---

## Environment Variables

### Storage Credentials

| Variable | Description | Used By |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | S3 access key | S3Backend, MinIO |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key | S3Backend, MinIO |
| `AWS_ENDPOINT_URL` | Custom S3 endpoint (e.g., MinIO) | S3Backend |
| `AWS_REGION` | AWS region (default: `us-east-1`) | S3Backend |
| `AWS_SESSION_TOKEN` | Temporary session token | S3Backend |

### Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Log level filter for the Rust runtime | `info` |

Supported levels: `error`, `warn`, `info`, `debug`, `trace`. Module-level filtering is supported:

```bash
# General info, debug for query engine
RUST_LOG=info,apiary_query=debug

# Trace storage operations
RUST_LOG=info,apiary_storage=trace
```
### Apiary Configuration

| Variable | Description | Default |
|----------|-------------|--------|
| `APIARY_STORAGE_URL` | Storage URI for the node (e.g., `s3://apiary/data`) | (set in Docker compose) |
| `APIARY_NAME` | Logical name for this apiary instance | `production` |
| `APIARY_IMAGE` | Docker image tag for Apiary containers | `apiary:latest` |
| `APIARY_VERSION` | Version to install via install scripts | `latest` |
| `INSTALL_DIR` | Custom binary install location | `/usr/local/bin` (Linux), `$USERPROFILE\.apiary\bin` (Windows) |
---

## Runtime Defaults

### Bee Pool

| Parameter | Default | Description |
|-----------|---------|-------------|
| Bee count | Auto-detected CPU cores | One bee per virtual core |
| Memory budget per bee | Total RAM / core count | Each bee gets an equal share of available memory |
| Task timeout | 30 seconds | Maximum time a single task can run before termination |
| Scratch directory | System temp dir / bee ID | Isolated temp directory per bee for spill files |

### Cell Cache

| Parameter | Default | Description |
|-----------|---------|-------------|
| Cache size | 2 GB | Maximum total size of cached cells on local disk |
| Eviction policy | LRU | Least recently used cells evicted first |
| Cache directory | `~/.apiary/{name}/_cache/` | Local directory for cached Parquet files |

### Heartbeat and Swarm

| Parameter | Default | Description |
|-----------|---------|-------------|
| Heartbeat interval | 5 seconds | How often each node writes its heartbeat file to storage |
| Suspect threshold | 15 seconds | Node is marked `suspect` after missing this many seconds of heartbeats (derived: `dead_threshold / 2`) |
| Dead threshold | 30 seconds | Node is marked `dead` after missing this many seconds of heartbeats |
| Stale cleanup | 60 seconds | Dead node heartbeat files are deleted after this duration |

### Colony Temperature

| Range | Classification | Effect |
|-------|---------------|--------|
| 0.0 -- 0.3 | Cold | System underutilized |
| 0.3 -- 0.7 | Ideal | Normal operating range |
| 0.7 -- 0.85 | Warm | Approaching capacity (0.85 is classified as Warm) |
| > 0.85 -- 0.95 | Hot | Temperature reported to client (v2: write backpressure) |
| > 0.95 | Critical | Temperature reported to client (v2: query admission control) |

Colony temperature is a composite metric derived from CPU utilization, memory pressure, and task queue depth.

### Task Abandonment

| Parameter | Default | Description |
|-----------|---------|-------------|
| Max retries | 3 | Number of times a failed task is retried before permanent abandonment |
| Retry policy | Immediate | Failed tasks are re-queued immediately |

### Compaction

:::info Planned for v2
Automatic compaction is not implemented in v1. The following parameters describe the planned v2 compaction behavior. In v1, use `overwrite_frame()` to manually consolidate a frame's data.
:::

| Parameter | Default | Description |
|-----------|---------|-------------|
| Min cell count | 10 | Compact when a partition exceeds this number of cells |
| Small cell threshold | `target_cell_size / 4` | Cells smaller than this are candidates for compaction |
| Max uncompacted age | 1 hour | Compact cells older than this regardless of count |

### Leafcutter Cell Sizing

| Parameter | Default | Description |
|-----------|---------|-------------|
| Target cell size | `memory_per_bee / 4` | Target size for new Parquet cells |
| Max cell size | `target * 2` | Upper bound on cell size |
| Min cell size | 16 MB | Floor to avoid excessive S3 per-request overhead |
