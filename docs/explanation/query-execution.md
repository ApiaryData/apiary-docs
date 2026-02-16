---
title: Query Execution
sidebar_position: 5
description: "How Apiary executes SQL queries across single and multiple nodes."
---

# Query Execution

Apiary uses [Apache DataFusion](https://datafusion.apache.org/) as its SQL engine. DataFusion provides SQL parsing, logical and physical planning, and vectorized execution over Arrow arrays. Apiary extends DataFusion with custom table resolution, cell pruning, and distributed execution.

## Single-Node Query Path

When a query can be satisfied by one node (the common case for solo mode or small queries), the execution path is:

```
SQL string
  │
  ├── 1. Parse (DataFusion SQL parser)
  │
  ├── 2. Resolve table references
  │     "warehouse.sales.orders" → lookup in registry
  │     → frame metadata (schema, partition columns)
  │     → active cells from ledger
  │
  ├── 3. Prune cells
  │     WHERE predicates → partition pruning (eliminate partitions)
  │                      → cell statistics pruning (eliminate cells by min/max)
  │
  ├── 4. Plan (DataFusion physical planner)
  │     → Projection pushdown (read only needed columns)
  │     → Aggregation plan (partial → final for GROUP BY)
  │
  ├── 5. Execute in bee chamber
  │     → Memory-budgeted execution
  │     → Read cells from cache or storage
  │     → DataFusion executes the physical plan
  │
  └── 6. Return Arrow IPC bytes
```

### Cell Pruning in Detail

Cell pruning happens in two stages:

**Stage 1: Partition elimination.** If the WHERE clause references a partition column, entire partition directories are excluded. For `WHERE region = 'north'`, only cells in `region=north/` are considered.

**Stage 2: Statistics-based elimination.** Each cell carries column-level min/max statistics in the ledger. For `WHERE temp > 40.0`, cells where `temp max < 40.0` are skipped without reading.

These two stages can dramatically reduce the amount of data read from storage. In a frame with 100 cells across 10 partitions, a query filtering on one partition and one column might scan only 2-3 cells instead of 100.

## Distributed Query Path

When a query spans data that would benefit from multiple nodes (large cell count, multiple workers available), the coordinator distributes work:

```
Coordinator:
  1. Parse and resolve (same as single-node)
  2. Prune cells (same as single-node)
  3. Build query plan
  4. Assign cells to workers:
     - Prefer nodes that have cells cached
     - Balance load by available bee count
     - Generate SQL fragment per worker
  5. Write query manifest to storage
  6. Poll for partial results
  7. Merge final results

Workers:
  1. Poll for manifests with cells assigned to this node
  2. Read assigned cells (from cache or storage)
  3. Execute SQL fragment in bee chamber
  4. Write partial results as Arrow IPC to storage
```

### SQL Fragment Generation

Each worker receives a SQL fragment -- a self-contained SQL query that operates on a subset of cells. The coordinator does not serialize physical plans; it generates SQL strings.

In v1, the SQL fragment is the original query passed through as-is to each worker, scoped to that worker's assigned cells. Each worker executes the full query on its local subset.

:::info Planned for v2
**Aggregation decomposition** (e.g., rewriting `AVG(x)` into partial `SUM(x)` / `COUNT(x)` on workers, then merging at the coordinator) is planned for v2. In v1, each worker runs the original SQL independently on its cell subset, and the coordinator merges the raw result sets.
:::

### Why SQL Fragments Instead of Physical Plans?

Serializing DataFusion physical plans would be more efficient (no re-parsing, no re-planning on workers). But:

1. **DataFusion plan serialization is not stable.** Plan formats change between releases. SQL is stable.
2. **SQL is debuggable.** You can read and test a SQL fragment independently. Serialized plans are opaque.
3. **Workers are independent.** Each worker runs its own DataFusion instance. SQL fragments make workers truly self-contained.

The cost is re-parsing and re-planning on each worker. For v1's batch workloads, this overhead is negligible compared to I/O time.

## EXPLAIN and EXPLAIN ANALYZE

:::info Planned for v2
`EXPLAIN` and `EXPLAIN ANALYZE` support is planned for v2. In the current release, query plan inspection is not available through SQL.

The planned v2 implementation will include:

- **EXPLAIN:** Logical plan, physical plan, cell pruning results, and partition elimination results
- **EXPLAIN ANALYZE:** Execution time per operator, rows processed, bytes read from storage vs. cache, and memory used per bee

In v1, you can observe partition pruning indirectly by using `read_from_frame()` with `partition_filter` to read a specific partition, or by comparing query times on partitioned vs. unpartitioned data.
:::

## Query Timeouts and Abandonment

Each query task has a timeout (default: 30 seconds). If a worker does not produce a partial result within the timeout:

1. The coordinator marks the task as failed
2. The task is reassigned to another worker (up to 3 retries)
3. After 3 failures, the task is abandoned and the query returns an error

This prevents poison-pill queries (e.g., a query that triggers an OOM on every worker) from consuming resources indefinitely.

## Custom Commands

In addition to standard SQL, Apiary supports custom commands:

| Command | Description | Returns |
|---------|-------------|---------|
| `USE HIVE name` | Set current hive context | Confirmation |
| `USE BOX name` | Set current box context | Confirmation |
| `SHOW HIVES` | List all hives | Table of hive names |
| `SHOW BOXES IN hive` | List boxes in a hive | Table of box names |
| `SHOW BOXES` | List boxes in current hive (requires `USE HIVE`) | Table of box names |
| `SHOW FRAMES IN hive.box` | List frames in a box | Table of frame names |
| `SHOW FRAMES` | List frames in current box (requires `USE HIVE` + `USE BOX`) | Table of frame names |
| `DESCRIBE hive.box.frame` | Show frame schema and stats | Schema with metadata |

These commands are intercepted before reaching DataFusion and handled by the Apiary query layer directly.
