---
title: Contributing
sidebar_position: 12
description: "How to contribute to the Apiary project."
---

# Contributing to Apiary

Apiary is open source under the Apache License 2.0. This guide covers how to set up a development environment and submit changes.

## Project Structure

The Apiary workspace contains 6 Rust crates:

| Crate | Purpose |
|-------|---------|
| `apiary-core` | Types, traits, configuration, error types |
| `apiary-storage` | Storage backends (local filesystem, S3) and data operations (ledger, cell reader/writer) |
| `apiary-runtime` | Node runtime, bee pool, heartbeat, behavioral model, cell cache |
| `apiary-query` | Apache DataFusion SQL integration, distributed query planning |
| `apiary-python` | PyO3 Python bindings |
| `apiary-cli` | Command-line interface binary |

## Development Setup

### Prerequisites

- **Rust (stable)** -- Install from [rustup.rs](https://rustup.rs/)
- **Python 3.9+** -- For the Python bindings
- **maturin** -- `pip install maturin`

### Clone and Build

```bash
git clone https://github.com/ApiaryData/apiary.git
cd apiary

# Build the full workspace
cargo build --workspace

# Build and install Python bindings
maturin develop
```

### Run Tests

```bash
cargo test --workspace
```

### Run Lints

```bash
# Format check
cargo fmt --check

# Clippy with warnings as errors
cargo clippy --workspace -- -D warnings
```

All three checks (fmt, clippy, test) must pass before a PR can be merged. CI runs these automatically.

## Code Conventions

### Error Handling

- Use `thiserror` for error types, not `anyhow`
- All error variants live in `ApiaryError` (see [Error Reference](/docs/reference/errors))
- Never `unwrap()` in library code -- always return `Result<T, ApiaryError>`

### Logging

- Use `tracing` for structured logging, not `println!` or `log`
- Use appropriate log levels:
  - `error!` -- Unrecoverable failures
  - `warn!` -- Unexpected but recoverable
  - `info!` -- Operational milestones (node start, frame created)
  - `debug!` -- Detailed operational flow
  - `trace!` -- Very detailed / per-record

### Storage

- All storage operations go through the `StorageBackend` trait -- never raw filesystem calls
- Object storage is canonical. Local disk is cache and spill only

### Documentation

- All public APIs must have rustdoc comments
- Every feature is documented before it is considered complete
- Use `// DESIGN:` comments to flag open design questions

### Testing

- Unit tests go in `#[cfg(test)]` modules within the same file
- Integration tests go in `tests/`
- Acceptance tests are Python scripts in `tests/test_step*_acceptance.py`

## Design Principles

Before implementing a feature, read the relevant architecture document in `docs/architecture/`. These are the source of truth:

1. **Object storage is canonical.** All committed data lives in S3/local filesystem via the StorageBackend trait
2. **No consensus protocol in v1.** Serialization via conditional writes (`put_if_not_exists`)
3. **No gossip protocol in v1.** Node discovery via heartbeat files in storage
4. **No direct node-to-node communication in v1.** All coordination through the shared storage layer
5. **SQL fragments, not physical plans.** Distributed queries send SQL strings to workers
6. **ListingTable, not CatalogProvider.** DataFusion integration via ListingTables

If the architecture documents don't answer your question, flag it with a `// DESIGN:` comment and proceed with the simplest reasonable implementation.

## Python SDK

The Python SDK in `crates/apiary-python/` mirrors the Rust API naming:

- Use `snake_case` for all Python methods
- Bee-themed and traditional database terminology are both supported (e.g., `create_hive()` / `create_database()`)
- Data transfer between Python and Rust uses Arrow IPC stream bytes

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes, ensuring all tests and lints pass locally
3. Write tests for new functionality
4. Update documentation for any API changes
5. Submit a pull request with a clear description of the change

### CI Requirements

Every pull request runs:

| Check | Command | Requirement |
|-------|---------|-------------|
| Format | `cargo fmt --check` | No formatting issues |
| Lint | `cargo clippy --workspace -- -D warnings` | Zero warnings |
| Test | `cargo test --workspace` | All tests pass |

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | Rust (2021 edition) |
| Python bridge | PyO3 + maturin |
| SQL engine | Apache DataFusion |
| Storage format | Apache Parquet (LZ4 compression) |
| In-memory format | Apache Arrow |
| Object storage | `object_store` crate (S3/GCS/local) |
| Async runtime | Tokio |
| Serialization | serde + serde_json |
| Error handling | thiserror |
| Logging | tracing |
