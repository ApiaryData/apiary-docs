---
title: Glossary
sidebar_position: 6
description: "Definitions of all Apiary-specific terms and concepts."
---

# Glossary

### Abandonment

When a task fails after exceeding the maximum retry count (default: 3), it is permanently abandoned. The abandonment tracker records diagnostics for debugging. See [Behavioral Model](/docs/explanation/behavioral-model).

### Bee

A unit of compute. Each virtual CPU core on a node is one bee. A Raspberry Pi 4 with 4 cores has 4 bees. Each bee executes tasks in an isolated [chamber](#chamber) with a fixed memory budget.

### Bee Pool

The collection of all bees on a single node, managed by the runtime. Tasks are queued and dispatched to available bees. See [Python SDK: bee_status()](/docs/reference/python-sdk#bee-status).

### Box

A namespace within a [hive](#hive). Equivalent to a **schema** in traditional databases. Contains [frames](#frame).

### Cell

A single Parquet file within a [frame](#frame). The smallest unit of physical storage. Cells are sized according to the [leafcutter sizing](#leafcutter-sizing) policy.

### Cell Cache

A local LRU (Least Recently Used) cache on each node that stores recently accessed cells. Reduces redundant fetches from object storage. Default size: 2 GB. Cached cell locations are reported in [heartbeats](#heartbeat) for cache-aware query planning.

### Chamber

A sealed execution environment for a single [bee](#bee). Also called a **mason bee chamber**. Provides memory isolation, scratch directory isolation, and task timeout enforcement. One bee's failure does not affect other bees. See [Behavioral Model](/docs/explanation/behavioral-model).

### Colony Temperature

A composite health metric for the entire node, ranging from 0.0 (cold) to 1.0 (critical). Derived from CPU utilization, memory pressure, and task queue depth. Controls write backpressure and query admission. See [Configuration: Colony Temperature](/docs/reference/configuration#colony-temperature).

### Conditional Write

An atomic storage operation (`put_if_not_exists`) that succeeds only if the key does not already exist. Used for ledger commits and registry updates to provide serialization without a consensus protocol.

### Frame

A queryable dataset within a [box](#box). Equivalent to a **table** in traditional databases. Stores data as [cells](#cell) (Parquet files) organized by partition columns.

### Heartbeat

A JSON file written by each node to storage every 5 seconds. Contains the node's ID, state, resource capacity, and cached cells. Used by other nodes to build the [world view](#world-view).

### Hive

A top-level namespace. Equivalent to a **database** in traditional databases. Contains [boxes](#box).

### Leafcutter Sizing

A cell sizing policy inspired by leafcutter bees, which cut nest materials to precisely fit their chambers. Target cell size is `memory_per_bee / 4`, with a minimum of 16 MB (to avoid excessive S3 per-request overhead). See [Storage Engine](/docs/explanation/storage-engine).

### Ledger

An ordered sequence of JSON files recording every mutation to a [frame](#frame). The ledger is the source of truth for which cells are active. Uses [conditional writes](#conditional-write) for concurrency control, similar to Delta Lake's transaction log.

### Meadow

Object storage (S3, MinIO, GCS, or local filesystem) where all data lives. The canonical source of truth for the entire apiary.

### Node

A single compute instance running the Apiary runtime. Can be a Raspberry Pi, a Docker container, a cloud VM, or any machine with Python and the Apiary package installed.

### Partition

A subdivision of a [frame](#frame) based on one or more column values. Data is stored in directories named `{column}={value}/`. Partition pruning eliminates entire partitions from queries that filter on partition columns.

### Regulation

The classification of a node's [colony temperature](#colony-temperature): cold (< 0.3), ideal (0.3--0.7), warm (0.7--0.85), hot (0.85--0.95), or critical (> 0.95).

### Swarm

The collection of all nodes connected to the same storage backend. Nodes discover each other through [heartbeat](#heartbeat) files. See [Swarm Coordination](/docs/explanation/swarm-coordination).

### World View

A node's current understanding of the swarm: which nodes are alive, suspect, or dead, along with their capacity and cached cells. Built by periodically reading all [heartbeat](#heartbeat) files from storage.
