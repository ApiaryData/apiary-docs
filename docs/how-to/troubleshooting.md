---
title: Troubleshooting
sidebar_position: 10
description: "Solutions for common Apiary issues across installation, storage, queries, and multi-node deployments."
---

# Troubleshooting

This guide consolidates common issues and their solutions. For a complete list of error types, see the [Error Reference](/docs/reference/errors).

## Installation Issues

| Problem | Solution |
|---------|----------|
| `maturin develop` fails with "Rust not found" | Install Rust via [rustup.rs](https://rustup.rs/) and ensure `~/.cargo/bin` is in your PATH |
| Build fails on Raspberry Pi with OOM | Use `--release` flag and consider adding swap space. Pi 3 (1 GB RAM) may struggle -- use cross-compilation instead |
| `ImportError: No module named 'apiary'` | Run `maturin develop` in the project root first. Ensure you're using the same Python environment |
| Build takes very long on Pi | Normal. A full build takes 15-30 minutes on Pi 4. Use `cargo build --release -p apiary-cli` to build only the CLI |

## Storage Connection Issues

### Cannot Connect to MinIO

```
Storage error: Connection refused
```

**Checklist:**
1. Is MinIO running? Check with `docker compose ps` or `systemctl status minio`
2. Is the endpoint correct? Verify `AWS_ENDPOINT_URL` matches MinIO's address
3. Are credentials correct? Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
4. Does the bucket exist? Create it with `mc mb myminio/apiary`

### S3 Permission Denied

```
Storage error: Access Denied
```

- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set correctly
- For AWS S3, check IAM permissions include `s3:GetObject`, `s3:PutObject`, `s3:ListBucket`, `s3:DeleteObject`
- For MinIO, verify the bucket policy allows the configured user

### Local Storage Path Issues

```
Storage error: No such file or directory
```

- Default local storage is at `~/.apiary/data/{name}/`
- Ensure the parent directory exists and is writable
- On Docker, mount a volume for persistent storage: `-v apiary-data:/home/apiary/data`

## Query Issues

### Frame Not Found in SQL

```
Cannot resolve frame path 'orders': No hive context set
```

Use fully qualified three-part names or set context first:

```python
# Option 1: Fully qualified
ap.sql("SELECT * FROM warehouse.sales.orders")

# Option 2: Set context
ap.sql("USE HIVE warehouse")
ap.sql("USE BOX sales")
ap.sql("SELECT * FROM orders")
```

### Query Timeout

```
Task timeout: query exceeded 30s limit
```

- Add WHERE filters to reduce the number of cells scanned
- Use partitioned frames and filter on partition columns for efficient pruning
- Check storage latency -- slow S3/MinIO can cause timeouts
- For very large scans, consider breaking the query into smaller partition-scoped queries

### Memory Exceeded

```
Memory exceeded for bee bee_0: requested 1073741824 bytes, budget 536870912 bytes
```

- The query cell is larger than the bee's memory budget
- Add LIMIT or WHERE to reduce result size
- Write smaller cells in the future (leafcutter sizing adjusts automatically)
- Run on hardware with more memory

### Blocked SQL Operations

```
INSERT is not supported via SQL. Use write_to_frame() in the Python SDK.
```

Use the Python SDK for data operations:

| SQL Operation | Python Alternative |
|---------------|--------------------|
| INSERT | `write_to_frame()` |
| UPDATE | `overwrite_frame()` |
| DELETE | `overwrite_frame()` |
| CREATE TABLE | `create_frame()` |

## Multi-Node Issues

### Nodes Not Discovering Each Other

Nodes discover each other through heartbeat files in shared storage. If nodes don't appear in `swarm_status()`:

1. **Same storage URI?** All nodes must use the exact same `APIARY_STORAGE_URL` value
2. **Storage accessible?** Each node must be able to read and write to the shared bucket
3. **Firewall?** Nodes don't communicate directly -- they only need access to MinIO/S3. No inter-node ports needed
4. **Heartbeat timing:** Wait at least 10 seconds after starting a new node. Heartbeats are written every 5 seconds and the world view updates on a polling interval

### Node Shows as Dead

A node is marked `dead` after missing heartbeats for 30 seconds.

- **Node crashed?** Check node logs and restart
- **Network partition?** The node may have lost access to storage
- **Storage slow?** If MinIO is overloaded, heartbeat writes may time out

The `suspect` state (15 seconds without heartbeat) serves as an early warning before `dead`.

### Write Conflicts in Multi-Node

```
Write conflict on key: warehouse/sales/orders/_ledger/...
```

This means two nodes tried to commit a ledger entry simultaneously. Apiary automatically retries on conflict using conditional writes. If this error surfaces to clients:

- Reduce the number of nodes writing to the same frame concurrently
- Retry the write from the application layer
- Consider writing to different partitions from different nodes

## Docker Issues

| Problem | Solution |
|---------|----------|
| Containers can't reach MinIO | Ensure all containers are on the same Docker network (default with `docker compose`) |
| MinIO bucket not created | Check `minio-setup` container logs: `docker compose logs minio-setup` |
| Out of memory | Add resource limits: `deploy.resources.limits.memory` in compose file. See [Pi Deploy Profiles](/docs/how-to/deploy-pi-profiles) for examples |
| Image build fails | Ensure you have at least 4 GB free disk space. The build stage requires Rust compilation |
| Container exits immediately | Check logs: `docker compose logs apiary-node`. Common issue: storage not ready (add `depends_on` with health check) |

## Logging

Enable detailed logging with the `RUST_LOG` environment variable:

```bash
# General info with debug for specific crates
RUST_LOG=info,apiary_query=debug

# Trace storage operations
RUST_LOG=info,apiary_storage=trace

# Trace everything (very verbose)
RUST_LOG=trace
```

When running with Docker:

```bash
docker compose logs -f apiary-node
```

When running with systemd:

```bash
journalctl -u apiary -f
```

## Getting Help

If you can't resolve an issue:

1. Check the [Error Reference](/docs/reference/errors) for detailed error type documentation
2. Enable debug logging (`RUST_LOG=debug`) and check the output
3. Open an issue on [GitHub](https://github.com/ApiaryData/apiary/issues) with:
   - Apiary version
   - Hardware and OS
   - Full error message
   - Steps to reproduce
   - Relevant log output
