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

## Current v1 Commands

In v1, the CLI binary prints version information and directs users to the Python SDK:

```bash
apiary-cli
```

```
apiary v1.0.0
CLI not yet implemented. Use the Python SDK.
See: https://apiarydata.github.io/apiary-docs/docs/reference/python-sdk
```

All data operations, queries, and cluster management are performed through the [Python SDK](/docs/reference/python-sdk).

## Planned v2 Commands

:::info Planned for v2
The following commands are planned for the v2 release. They are listed here to preview the intended CLI surface.
:::

### `apiary start`

Start an Apiary node.

```bash
apiary start [OPTIONS]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--storage <URI>` | Storage backend URI | Local filesystem (`~/.apiary/data/`) |
| `--name <NAME>` | Apiary instance name | `default` |

### `apiary sql`

Execute a SQL query against a running Apiary instance.

```bash
apiary sql "<QUERY>"
```

### `apiary shell`

Open an interactive SQL shell.

```bash
apiary shell [OPTIONS]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--storage <URI>` | Storage backend URI | Local filesystem |
