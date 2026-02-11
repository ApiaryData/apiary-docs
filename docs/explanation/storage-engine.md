---
title: Storage Engine
sidebar_position: 3
description: "How Apiary provides ACID transactions over Parquet files in object storage."
---

# Storage Engine

Apiary's storage engine provides ACID transactions over Parquet files in object storage. It draws from two proven designs: Delta Lake's transaction log model (append-only ledger with conditional writes for serialization) and bee-inspired principles of leafcutter cell sizing and mason bee isolation.

All committed state lives in object storage -- data files, ledger entries, registry metadata, and coordination state. Local disk is used only for caching, spilling, and write buffering. If every compute node disappears, the bucket contains everything needed to resume operations.

## The StorageBackend Trait

Every storage operation in Apiary goes through a single trait:

```rust
#[async_trait]
pub trait StorageBackend: Send + Sync {
    async fn put(&self, key: &str, data: Bytes) -> Result<()>;
    async fn get(&self, key: &str) -> Result<Bytes>;
    async fn list(&self, prefix: &str) -> Result<Vec<String>>;
    async fn delete(&self, key: &str) -> Result<()>;
    async fn put_if_not_exists(&self, key: &str, data: Bytes) -> Result<bool>;
    async fn exists(&self, key: &str) -> Result<bool>;
}
```

The critical operation is `put_if_not_exists` -- a conditional write that succeeds only if the key does not already exist. This single primitive replaces the entire Raft consensus protocol for serializing concurrent writes.

### Two Implementations

**LocalBackend** -- For solo mode and development. Uses the local filesystem. `put_if_not_exists` uses `O_CREAT | O_EXCL` flags for atomic file creation.

**S3Backend** -- For multi-node and cloud deployments. Any S3-compatible endpoint (AWS S3, GCS, MinIO, Ceph). `put_if_not_exists` uses `PutObject` with `If-None-Match: *` (S3 conditional put). Built on the `object_store` crate from the Arrow ecosystem.

## The Transaction Ledger

Each frame has a ledger -- an ordered sequence of JSON files that describes every mutation to the frame's state. The ledger is the source of truth for which cells are active, what the schema is, and the frame's version history.

### Ledger Entries

Each entry records one action:

- **CreateFrame** -- Initial frame creation with schema and partition columns
- **AddCells** -- Appending new data (one or more Parquet cells)
- **RewriteCells** -- Replacing cells during compaction or overwrite (removes old cells, adds new ones)

Every cell in an AddCells or RewriteCells entry carries metadata: path, row count, byte size, partition values, and column-level min/max statistics.

### Commit Protocol: Optimistic Concurrency

The ledger is the serialization point for all writes to a frame. Two concurrent writers are serialized by the storage backend's conditional write:

```
Writer A:                              Writer B:
  Read current version: 41               Read current version: 41
  Write cells to storage                 Write cells to storage
  put_if_not_exists(                     put_if_not_exists(
    _ledger/000042.json, ...)              _ledger/000042.json, ...)
  → SUCCESS (first to write)             → FAILED (key already exists)
                                         Re-read version: 42
                                         put_if_not_exists(
                                           _ledger/000043.json, ...)
                                         → SUCCESS
```

No consensus protocol. No leader election. The storage layer provides the atomic compare-and-swap. One writer wins; the other retries. Cell files are already written before the ledger commit -- only the ledger entry retries.

### Checkpointing

After every 100 versions, the committing node writes a checkpoint containing the full set of active cells at that version. This accelerates ledger loading -- instead of replaying hundreds of entries, a node loads the checkpoint and replays only subsequent entries.

## The Write Path

```
Python SDK: ap.write_to_frame(hive, box, frame, data)
  │
  ├── 1. Schema validation
  │     Check incoming data against frame schema.
  │     Implicit widening (int32 → float64). Extra columns dropped.
  │     Missing nullable columns filled with null. Missing non-nullable → error.
  │     Null partition values → error.
  │
  ├── 2. Partition the data
  │     Split RecordBatches by partition column values.
  │
  ├── 3. Write cells (leafcutter sizing)
  │     Size cells to match bee memory budgets.
  │     Write Parquet files with LZ4 compression.
  │     Calculate cell-level statistics during write.
  │
  ├── 4. Commit ledger entry
  │     Attempt put_if_not_exists for next version.
  │     On conflict → retry from step 4 with incremented version.
  │
  └── 5. Return write result
        Cells written, rows written.
```

## Leafcutter Cell Sizing

Inspired by leafcutter bees (Megachile), which cut nest materials to precisely fit their chambers, cell sizes are calculated to match the scanning node's memory budget:

- **Target cell size** = `memory_per_bee / 4`
- **Max cell size** = `target * 2`
- **Min cell size** = 16 MB (floor to avoid excessive S3 per-request overhead)

On a Raspberry Pi with 1 GB per bee, the target is 256 MB. On a cloud node with 4 GB per bee, the target is 1 GB. The minimum floor matters because object storage has per-request overhead (20-200ms per GET); very small cells create excessive request overhead.

## Cell Reading and Pruning

### Cell-Level Statistics

Every cell carries min/max statistics per column. The query planner uses these to skip cells that cannot match the query filter:

```sql
SELECT * FROM sensors.temperature WHERE temp > 40.0
```

```
Planner checks cell stats:
  cell_001: temp max = 38.5  → SKIP
  cell_002: temp max = 42.1  → SCAN
  cell_003: temp max = 35.0  → SKIP

Result: 1 of 3 cells scanned
```

### Partition Pruning

Partition column values are encoded in the storage path. The planner eliminates entire partitions before examining individual cells:

```sql
SELECT * FROM sensors.temperature WHERE region = 'north'
```

```
Partitions:
  region=north/  → INCLUDE
  region=south/  → EXCLUDE
  region=east/   → EXCLUDE
```

### Projection Pushdown

Parquet is columnar. When a query selects specific columns, only those column chunks are read from storage. Combined with partition pruning and cell statistics, this minimizes data pulled from object storage.

## Compaction

Over time, a frame accumulates many small cells from individual writes. Compaction merges them into fewer, larger cells:

1. Identify a partition meeting compaction criteria (> 10 cells, or cells older than 1 hour)
2. Read all small cells from object storage
3. Merge into new, larger cells (respecting leafcutter sizing)
4. Write new cells with new UUIDs
5. Commit a RewriteCells ledger entry via conditional put
6. On conflict, retry with fresh state
7. Old cells become eligible for garbage collection

## The Registry

The registry is the namespace catalog: which hives, boxes, and frames exist. It is stored as versioned JSON files using the same conditional-put mechanism as the ledger. Checkpointed every 100 versions.

## Design Rationale

For a deeper discussion of why Apiary uses object storage instead of local-first storage, and why conditional puts replace Raft, see [Design Decisions](/docs/explanation/design-decisions).

For the exact directory structure, see [Storage Layout](/docs/reference/storage-layout).
