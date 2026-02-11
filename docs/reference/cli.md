---
title: CLI Reference
sidebar_position: 4
description: "Command-line interface reference for the Apiary CLI."
---

# CLI Reference

:::note
The Apiary CLI is minimal in v1. Most operations are performed through the [Python SDK](/docs/reference/python-sdk). A more complete CLI is planned for v2.
:::

## Installation

The CLI is built as part of the Rust workspace:

```bash
cargo build --workspace --release
```

The binary is located at `target/release/apiary-cli`.

## Commands

### `apiary start`

Start an Apiary node.

```bash
apiary start [OPTIONS]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--storage <URI>` | Storage backend URI | Local filesystem (`~/.apiary/data/`) |
| `--name <NAME>` | Apiary instance name | `default` |

```bash
# Solo mode with local storage
apiary start --name my_project

# Multi-node with MinIO
apiary start --name production --storage s3://apiary-data@minio.local:9000
```

### `apiary sql`

Execute a SQL query against a running Apiary instance.

```bash
apiary sql "<QUERY>"
```

```bash
apiary sql "SELECT * FROM warehouse.sales.orders LIMIT 10"
apiary sql "SHOW HIVES"
apiary sql "DESCRIBE warehouse.sales.orders"
```

### `apiary shell`

Open an interactive SQL shell.

```bash
apiary shell [OPTIONS]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--storage <URI>` | Storage backend URI | Local filesystem |

```bash
apiary shell --storage s3://apiary-data@minio.local:9000
```

The shell supports all SQL statements documented in the [SQL Reference](/docs/reference/sql-reference), including `USE`, `SHOW`, and `DESCRIBE`.
