---
title: Core Concepts
sidebar_position: 1
description: "Why Apiary uses a biological model, and the key concepts that underpin the system."
---

# Core Concepts

This page explains the fundamental ideas behind Apiary -- not just what the concepts are, but why they exist.

## Why a Biological Model?

Apiary's design is rooted in a practical observation: bee colonies solve the same problems as distributed data systems. A colony of thousands of bees coordinates work, manages resources, handles failures, and scales up or down -- all without a central controller. Each bee makes local decisions based on simple signals, and intelligent behavior emerges at the colony level.

This is not a metaphor. Apiary's runtime algorithms are directly inspired by documented bee colony behaviors:

- **Mason bees** build isolated chambers for their offspring. Apiary uses sealed execution chambers per CPU core with hard memory boundaries.
- **Leafcutter bees** cut materials to precisely fit their nests. Apiary sizes data cells to fit each node's memory budget.
- **Colonies regulate temperature** through collective behavior. Apiary uses a composite health metric that monitors system load and reports it to clients.
- **Bees abandon unproductive food sources** after repeated failures. Apiary abandons poison-pill tasks after a configurable retry limit.

The biological model provides a unified framework for resource management decisions that would otherwise be a collection of ad-hoc heuristics.

## The Namespace Hierarchy

Apiary organizes data in a three-level namespace:

```
Hive (database)
└── Box (schema)
    └── Frame (table)
        └── Cell (Parquet file)
```

### Why three levels?

Three levels balance flexibility with simplicity. A single level forces everything into a flat namespace. Two levels (database + table) lack the grouping that schemas provide for organizing related tables. Four or more levels add complexity without proportional benefit.

The names are bee-themed, but every operation has a traditional database alias:

| Bee-Themed | Traditional | Purpose |
|------------|-------------|---------|
| Hive | Database | Top-level grouping |
| Box | Schema | Namespace within a hive |
| Frame | Table | Queryable dataset |
| Cell | Parquet file | Physical storage unit |

You can use either terminology -- `create_hive()` and `create_database()` are identical. The dual naming exists because some users prefer domain-specific language, while others prefer standard database terms.

## The Compute Model: 1 Core = 1 Bee

Each virtual CPU core on a node is one bee. A Raspberry Pi 4 with 4 cores has 4 bees; a cloud VM with 16 cores has 16 bees.

This model exists because of Apiary's target hardware. On a Raspberry Pi with 4 GB of RAM, each of 4 bees gets roughly 1 GB. That is a hard limit, not a suggestion. If a query exceeds a bee's memory budget, it fails in isolation -- other bees are unaffected, and the node continues operating.

The 1-core-1-bee model makes resource planning deterministic:

- **Memory budget per bee** = total RAM / core count
- **Cell size target** = memory per bee / 4 (so a bee can hold 4 cells concurrently)
- **Concurrency** = number of bees (no oversubscription)

This is intentionally conservative. A Raspberry Pi cannot recover gracefully from memory pressure the way a cloud server with swap can. Hard limits prevent cascading failures.

## The Storage Model

Apiary uses a three-tier storage model:

| Tier | Medium | Purpose | Speed |
|------|--------|---------|-------|
| Tier 1 | Memory | Active computation (Arrow RecordBatches) | Fastest |
| Tier 2 | Local disk | Cache + spill + write buffer | Fast |
| Tier 3 | Object storage | Canonical data, metadata, coordination | Slowest |

### Why object storage is the source of truth

This is Apiary's most important design decision. All committed data, metadata, coordination state, and query results live in object storage (S3, MinIO, GCS, or local filesystem). Local state is always ephemeral.

This means:

- **Any node can read any data.** No need to track which node holds which file.
- **Any node can write to any frame.** The conditional-write mechanism on the ledger provides serialization.
- **Losing a node loses nothing.** The bucket contains the complete system state.
- **Adding a node requires no coordination.** Point it at the same bucket and start it.

The tradeoff is latency -- S3 round trips add 20-200ms per operation. The local cell cache mitigates this for reads, and the latency is acceptable for batch workloads (v1's primary target).

See [Architecture Overview](/docs/explanation/architecture-overview) for the full architectural discussion and [Design Decisions](/docs/explanation/design-decisions) for why alternatives were rejected.

## The Swarm

A swarm is the collection of all nodes connected to the same storage backend. Nodes discover each other by reading heartbeat files from storage -- there is no separate discovery mechanism, no seed nodes, and no gossip protocol.

Each node writes a heartbeat file every 5 seconds containing its ID, state, capacity, and cached cells. Other nodes read these files to build a world view: who is alive, who is suspect, who is dead.

A single node with local filesystem storage is a swarm of one. Adding S3 storage and a second node creates a swarm of two. The code path is identical -- there is no special "solo mode" branch.

See [Swarm Coordination](/docs/explanation/swarm-coordination) for the complete discussion.

## Further Reading

- [Architecture Overview](/docs/explanation/architecture-overview) -- The system's design principles and subsystem interactions
- [Storage Engine](/docs/explanation/storage-engine) -- How ACID transactions work over object storage
- [Behavioral Model](/docs/explanation/behavioral-model) -- The four v1 bee-inspired behaviors in detail
- [Design Decisions](/docs/explanation/design-decisions) -- Why Apiary chose its approach over alternatives
