---
title: Storage Layout
sidebar_position: 5
description: "Reference for the on-disk and object storage directory structure used by Apiary."
---

# Storage Layout

Apiary stores all state in the configured storage backend -- local filesystem or S3-compatible object storage. This page documents the exact directory structure.

## Three-Tier Storage Model

| Tier | Medium | Purpose | Persistence |
|------|--------|---------|-------------|
| Tier 1 | Memory | Arrow RecordBatches in bee chambers during active computation | Ephemeral |
| Tier 2 | Local disk | Cell cache (LRU) + spill files + write buffers | Ephemeral (cache) |
| Tier 3 | Object storage | Canonical data, metadata, and coordination state | Durable |

Tier 3 (object storage) is the source of truth. If all compute nodes disappear, the bucket contains everything needed to resume operations.

## Bucket Layout

```
{storage_root}/
├── _registry/
│   ├── state_000001.json            # Registry version 1
│   ├── state_000002.json            # Registry version 2 (latest)
│   └── _checkpoint/
│       └── checkpoint_000100.json   # Registry checkpoint
├── _heartbeats/
│   ├── node_abc123.json             # Node heartbeat files
│   └── node_def456.json
├── _queries/
│   └── {query_id}/                  # Distributed query coordination
│       ├── manifest.json            # Query plan and cell assignments
│       └── partial_{node_id}.arrow  # Partial results from workers
└── {hive}/
    └── {box}/
        └── {frame}/
            ├── _ledger/
            │   ├── 000000.json              # Ledger entry version 0
            │   ├── 000001.json              # Ledger entry version 1
            │   └── _checkpoint/
            │       └── checkpoint_000100.json
            └── {partition_col}={value}/
                ├── cell_{uuid}.parquet      # Data cells
                └── cell_{uuid}.parquet
```

## Directory Details

### `_registry/`

The namespace catalog. Contains versioned JSON files tracking which hives, boxes, and frames exist. New versions are committed using conditional writes (`put_if_not_exists`) for concurrency control.

Checkpoints are written every 100 versions to accelerate loading.

### `_heartbeats/`

One JSON file per active node, updated every 5 seconds. Contains the node ID, status, core count, memory, cache contents, and last-updated timestamp. Used by the world view builder to discover nodes and detect failures.

Heartbeat files are deleted on graceful shutdown and cleaned up after 60 seconds for dead nodes.

### `_queries/`

Temporary directory for distributed query coordination. Each query gets a subdirectory containing:

- `manifest.json` -- The query plan with cell-to-node assignments
- `partial_{node_id}.arrow` -- Arrow IPC files with partial results from each worker

Query directories are cleaned up after the query completes.

### `{hive}/{box}/{frame}/`

Data directory for a single frame, containing:

- **`_ledger/`** -- Ordered sequence of JSON files recording every mutation (AddCells, RewriteCells). The ledger is the source of truth for which cells are active. Checkpointed every 100 versions.
- **`{partition_col}={value}/`** -- Partition directories following Hive-style partitioning. Each directory contains Parquet cell files.

### Cell Files

Each cell file is a Parquet file with:

- LZ4 compression
- Column-level min/max statistics
- UUID-based naming (`cell_{uuid}.parquet`)
- Size governed by the [leafcutter sizing policy](/docs/reference/configuration#leafcutter-cell-sizing)

## Local Storage

When using `LocalBackend` (the default for solo mode), the storage root is:

```
~/.apiary/{apiary_name}/
```

The directory structure is identical to the bucket layout above.

## Namespace Hierarchy

```
Apiary Instance
└── Hive (database)
    └── Box (schema)
        └── Frame (table)
            └── Cell (Parquet file)
```

See the [Glossary](/docs/reference/glossary) for definitions of each term.
