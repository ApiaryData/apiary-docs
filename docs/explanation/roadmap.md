---
title: Roadmap
sidebar_position: 8
description: "Apiary's development phases: v1 (current), v2, and v3."
---

# Roadmap

Apiary is developed in three major phases, each building on the previous one's foundation.

## v1 -- Core Platform (Current Release)

v1 proves the fundamental thesis: a distributed data platform can run on Raspberry Pis, coordinate through object storage, and use biology-inspired algorithms for resource management.

### What v1 Delivers

**Runtime:**
- Rust workspace with 6 crates
- Python SDK via PyO3 with zero-copy Arrow interop
- LocalBackend (filesystem) and S3Backend (S3-compatible object storage)
- Node configuration with automatic hardware detection

**Data Management:**
- Three-level namespace (Hive/Box/Frame) with dual terminology
- ACID transactions via ledger with conditional writes
- Parquet cell storage with LZ4 compression
- Partitioning with partition pruning
- Cell-level min/max statistics for query pruning
- Leafcutter cell sizing
- Ledger checkpointing

**SQL Engine:**
- Apache DataFusion integration
- Full SELECT with WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, JOIN
- Custom commands: USE, SHOW, DESCRIBE
- Projection pushdown

**Multi-Node:**
- Storage-based heartbeat and world view
- Node state detection (alive/suspect/dead)
- Distributed query planning with cache-aware cell assignment
- SQL fragment generation and partial result merging
- Query timeouts and task abandonment

**Behavioral Model (4 behaviors):**
- Mason bee sealed chambers (memory-budgeted isolation per core)
- Leafcutter cell sizing (cells fit bee budgets)
- Task abandonment (retry limits with diagnostics)
- Colony temperature (composite health metric for system monitoring)

### v1 Design Constraints

v1 intentionally omits features that require direct node-to-node communication or complex protocols:

- No gossip protocol (storage-based heartbeats only)
- No Arrow Flight (S3 for all data exchange)
- No streaming ingestion (batch writes only)
- No DELETE/UPDATE (append-only with full overwrite)
- No schema evolution (frames have fixed schemas)
- No time travel queries

These constraints keep v1 simple, testable, and deployable on constrained hardware.

## v2 -- Direct Communication

v2 adds direct communication between nodes for workloads that require low latency. It supplements (does not replace) storage-based coordination -- nodes behind NAT continue to work via S3.

### Planned Features

**Communication:**
- SWIM gossip for sub-second failure detection
- Arrow Flight for low-latency data shuffles between reachable nodes
- S3 fallback for nodes behind NAT

**Full Behavioral Model (20 behaviors):**
- Waggle Dance -- quality-weighted task distribution
- Three-Tier Workers -- employed/onlooker/scout roles
- Pheromone Signalling -- distributed backpressure
- Nectar Ripening -- streaming ingestion pipeline
- Queen Substance -- configuration propagation
- Drone Assembly -- dedicated high-memory bees for large aggregations
- Wax Comb Building -- adaptive storage structure optimization
- Robber Detection -- anomalous access pattern detection
- Bee Bread Fermentation -- incremental materialized views
- Piping Signal -- cascade shutdown coordination
- Absconding -- emergency data migration
- Hibernation -- power-saving mode for idle nodes
- Cleansing Flights -- garbage collection and space reclamation
- Propolis Sealing -- data integrity verification
- Royal Jelly Allocation -- dynamic resource redistribution
- Undertaker Behavior -- dead data cleanup

**Data Management:**
- Streaming ingestion
- Time travel queries (read data at any ledger version)
- Schema evolution (add/rename/widen columns)
- DELETE and UPDATE via copy-on-write rewrites
- Distributed joins (hash join with Arrow Flight shuffle)

**Operational:**
- HTTP API for language-agnostic access
- Full CLI with interactive shell
- Metrics export (Prometheus format)
- Alerting hooks
- EXPLAIN and EXPLAIN ANALYZE query plan inspection

## v3 -- Enterprise and Federation

v3 targets production enterprise deployments and multi-cluster coordination.

### Planned Features

- **Multi-apiary federation:** Query across multiple independent Apiary deployments
- **Regulatory compliance:** Data residency controls, audit logging
- **Data lineage:** Track data provenance across frames and queries
- **Advanced access control:** Row-level and column-level security
- **Cost-based query optimizer:** Choose between distributed and single-node execution based on estimated cost

## Community and Open Source

Apiary is open source under the Apache License 2.0. The project values:

- **Simplicity over features.** Each release does fewer things well rather than many things poorly.
- **Small compute as a first-class target.** Performance is measured on a Raspberry Pi, not a cloud VM.
- **Correctness over speed.** ACID transactions and deterministic resource usage are non-negotiable.
- **Documentation as a product.** Every feature is documented before it is considered complete.
