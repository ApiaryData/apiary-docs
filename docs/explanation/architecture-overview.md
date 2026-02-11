---
title: Architecture Overview
sidebar_position: 2
description: "Apiary's design principles, subsystems, and how they fit together."
---

# Architecture Overview

Apiary is a distributed data processing framework with a single guiding principle: **object storage is the only coordination layer**. There is no node-to-node communication, no consensus protocol, and no gossip network. Nodes coordinate exclusively through the same storage layer that holds the data.

## Core Principles

1. **Object storage is canonical.** All committed data, metadata, and coordination state lives in object storage. Local state is ephemeral cache.

2. **No node-to-node communication.** Nodes never talk to each other directly. This eliminates NAT traversal, firewall configuration, and mesh networking complexity -- critical when running on home networks with Raspberry Pis.

3. **Conditional writes for serialization.** Instead of Raft consensus, Apiary uses `put_if_not_exists` on the storage backend. One write succeeds; the other retries. The storage layer provides the atomic operation.

4. **Biology is the runtime.** Resource management decisions (memory budgets, cell sizing, backpressure, failure recovery) are governed by bee-inspired algorithms, not ad-hoc heuristics.

5. **Solo to swarm without code changes.** A single Pi with local filesystem storage runs the same code as a multi-node cluster on S3. Adding nodes is a configuration change, not an architecture change.

## Three-Layer Interface

Apiary exposes three interfaces:

```
┌─────────────────────────────────┐
│         Python SDK              │   ← Data operations, namespace management
│    (PyO3 zero-copy bindings)    │
├─────────────────────────────────┤
│         SQL Engine              │   ← Queries via Apache DataFusion
│    (DataFusion SessionContext)  │
├─────────────────────────────────┤
│         Status APIs             │   ← Monitoring and observability
│   (status, bee, swarm, colony)  │
└─────────────────────────────────┘
```

- **Python SDK** -- Write data, manage namespaces, execute operations. Uses Arrow IPC for zero-copy data transfer between Python and Rust.
- **SQL Engine** -- Query data with standard SQL. Apache DataFusion provides parsing, planning, and execution. Custom commands (`USE`, `SHOW`, `DESCRIBE`) extend standard SQL.
- **Status APIs** -- Monitor node health, bee utilization, swarm membership, and colony temperature.

## Subsystems

Apiary is built from six Rust crates that form a layered architecture:

### apiary-core

Foundational types shared by all other crates: configuration, errors, typed identifiers (HiveId, BoxId, FrameId, CellId, BeeId, NodeId), the `StorageBackend` trait, and ledger/registry data structures.

### apiary-storage

Concrete implementations of `StorageBackend`:

- **LocalBackend** -- Filesystem-based, for solo mode and development
- **S3Backend** -- S3-compatible, for multi-node and cloud deployments

Also contains the cell reader (Parquet with projection pushdown), cell writer (with partitioning and LZ4 compression), and the transaction ledger.

See [Storage Engine](/docs/explanation/storage-engine) for details.

### apiary-runtime

The node runtime:

- **BeePool** -- Manages sealed chambers (one per core), dispatches tasks, enforces memory budgets
- **Heartbeat writer** -- Writes node status to storage every 5 seconds
- **World view builder** -- Reads heartbeat files to discover nodes and detect failures
- **Cell cache** -- Local LRU cache for recently accessed Parquet files
- **Behavioral model** -- Colony temperature, abandonment tracking

See [Swarm Coordination](/docs/explanation/swarm-coordination) and [Behavioral Model](/docs/explanation/behavioral-model).

### apiary-query

The DataFusion-based SQL engine:

- Resolves Apiary namespace references (`hive.box.frame`) to storage locations
- Cell pruning from WHERE predicates (partition elimination + cell statistics)
- Projection pushdown (read only needed columns from Parquet)
- Distributed query planning and execution
- Custom command handling (USE, SHOW, DESCRIBE)

See [Query Execution](/docs/explanation/query-execution).

### apiary-python

PyO3 bindings exposing the `Apiary` class to Python. Handles Arrow IPC serialization for zero-copy data transfer.

### apiary-cli

Command-line interface (minimal in v1). See [CLI Reference](/docs/reference/cli).

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Language | Rust 1.75+ | Memory safety, zero-cost abstractions, ARM64 cross-compilation |
| Python bridge | PyO3 + maturin | Zero-copy Arrow interop, native Python wheels |
| SQL engine | Apache DataFusion | Rust-native, Arrow-native, extensible |
| Storage format | Apache Parquet | Columnar, compressed, universal |
| In-memory format | Apache Arrow | Zero-copy, columnar, cross-language |
| Object storage | `object_store` crate | S3, GCS, Azure, local filesystem via unified interface |
| Async runtime | Tokio | Standard Rust async |
| Serialization | serde + JSON | Ledger entries, registry state, heartbeats |

## What Makes Apiary Different

Most distributed data systems are designed for the cloud and then adapted (poorly) for edge deployments. Apiary inverts this: it is designed for a Raspberry Pi and scales up to the cloud.

The key consequences of this design:

- **No coordinator node.** There is no master, no leader, no scheduler. Every node is equal. This means there is no single point of failure beyond the storage backend itself (and S3 provides 99.999999999% durability).
- **No inter-node networking.** Nodes on a home network behind NAT work without port forwarding, VPNs, or mesh networks.
- **Deterministic resource usage.** Memory budgets per bee are hard limits. A Pi with 4 GB of RAM will never OOM from a runaway query.
- **Graceful degradation.** If a node dies, its tasks are retried on other nodes. If all nodes die, the data is intact in object storage.

See [Design Decisions](/docs/explanation/design-decisions) for the detailed rationale behind each architectural choice.
