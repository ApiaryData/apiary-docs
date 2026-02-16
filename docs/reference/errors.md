---
title: Error Reference
sidebar_position: 7
description: "Complete reference for all Apiary error types, their causes, and how to resolve them."
---

# Error Reference

All errors in Apiary are represented by `ApiaryError`. This page documents every variant, when it occurs, and how to resolve it.

## Error Types

### Storage

A storage operation (read, write, list, or delete) failed at the storage backend layer.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `String` | Human-readable description of the failure |
| `source` | `Option<Error>` | The underlying I/O or S3 error, if available |

**Common causes:**
- Network connectivity issues to MinIO or S3
- Permission denied (invalid AWS credentials)
- Storage service unavailable
- Disk full (local backend)

**Resolution:** Check storage connectivity, verify credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL`), and ensure the storage service is running.

---

### NotFound

The requested key was not found in storage.

| Field | Type | Description |
|-------|------|-------------|
| `key` | `String` | The storage key that was not found |

**Common causes:**
- Reading a cell that has been deleted or compacted
- Stale ledger reference to a removed cell
- Incorrect storage URI configuration

**Resolution:** Verify the storage URI matches where data was written. If cells are missing, the ledger may reference deleted files -- try `overwrite_frame()` to rebuild.

---

### WriteConflict

A conditional write conflict occurred -- another writer committed a change to the same key first.

| Field | Type | Description |
|-------|------|-------------|
| `key` | `String` | The storage key where the conflict occurred |

**Common causes:**
- Two nodes writing to the same frame simultaneously
- Concurrent registry updates

**Resolution:** This is expected in multi-node deployments. Apiary automatically retries on conflict. If you see this error surfaced to clients, it means retries were exhausted. Reduce write concurrency or retry from the application layer.

---

### AlreadyExists

An entity with this name already exists in the registry.

| Field | Type | Description |
|-------|------|-------------|
| `entity_type` | `String` | The type of entity (e.g., "Hive", "Box", "Frame") |
| `name` | `String` | The conflicting name |

**Common causes:**
- Calling `create_hive()`, `create_box()`, or `create_frame()` with a name that already exists

**Resolution:** Use `list_hives()`, `list_boxes()`, or `list_frames()` to check existence before creating. If you need to replace a frame's data, use `overwrite_frame()` instead.

---

### EntityNotFound

The requested entity was not found in the registry.

| Field | Type | Description |
|-------|------|-------------|
| `entity_type` | `String` | The type of entity (e.g., "Hive", "Box", "Frame") |
| `name` | `String` | The name that was not found |

**Common causes:**
- Referencing a hive, box, or frame that hasn't been created yet
- Typo in entity name
- Using a different storage URI than where the entity was created

**Resolution:** Create the entity first with `create_hive()`, `create_box()`, or `create_frame()`. Verify the storage URI matches the original deployment.

---

### Schema

A schema validation error occurred during a write operation.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `String` | Description of the schema mismatch |

**Common causes:**
- Writing data with columns that don't match the frame's schema
- Column type mismatch (e.g., writing `utf8` to an `int64` column)
- Missing required columns

**Resolution:** Ensure the Arrow table you're writing matches the schema defined in `create_frame()`. Use `get_frame()` to inspect the expected schema.

---

### MemoryExceeded

A bee exceeded its memory budget during task execution.

| Field | Type | Description |
|-------|------|-------------|
| `bee_id` | `BeeId` | The bee that exceeded its budget |
| `budget` | `u64` | The memory budget in bytes |
| `requested` | `u64` | The amount of memory requested in bytes |

**Common causes:**
- Query processing a cell larger than the bee's memory budget
- Aggregation requiring too much intermediate state
- Running on hardware with very limited RAM

**Resolution:** Reduce query scope (add WHERE filters, use LIMIT), write smaller cells (leafcutter sizing will adjust on future writes), or run on hardware with more memory. See [Behavioral Model](/docs/explanation/behavioral-model#1-mason-bee-sealed-chambers) for details on memory isolation.

---

### TaskTimeout

A task exceeded its maximum execution time (default: 30 seconds).

| Field | Type | Description |
|-------|------|-------------|
| `message` | `String` | Description of the timed-out task |

**Common causes:**
- Query scanning too many cells without pruning
- Slow storage backend (high-latency S3, overloaded MinIO)
- Large aggregation on constrained hardware

**Resolution:** Add partition filters to reduce scan scope, ensure cells are properly partitioned, or check storage backend performance. See [Configuration](/docs/reference/configuration) for timeout settings.

---

### TaskAbandoned

A task was permanently abandoned after exceeding the retry limit (default: 3 attempts).

| Field | Type | Description |
|-------|------|-------------|
| `message` | `String` | Description including attempt history |

**Common causes:**
- A "poison pill" query that fails on every attempt (e.g., always triggers OOM)
- Persistent storage connectivity issues
- Corrupted cell data

**Resolution:** Examine the error message for the underlying failure cause. Fix the root issue (reduce query scope, fix storage, rebuild corrupted frames with `overwrite_frame()`), then retry the query.

---

### Config

Invalid configuration was provided.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `String` | Description of the configuration problem |

**Common causes:**
- Invalid storage URI format
- Missing required configuration parameters

**Resolution:** Check the storage URI format (must be `s3://bucket/path` or `None` for local). See [Configuration](/docs/reference/configuration) for valid options.

---

### Resolution

A frame path could not be resolved to a concrete hive/box/frame.

| Field | Type | Description |
|-------|------|-------------|
| `path` | `String` | The path that could not be resolved |
| `reason` | `String` | The reason resolution failed |

**Common causes:**
- Using a 1-part or 2-part table name without setting context via `USE HIVE` / `USE BOX`
- Referencing a non-existent hive or box in a 3-part name

**Resolution:** Use fully qualified 3-part names (`hive.box.frame`) or set context first with `USE HIVE` and `USE BOX`. See [SQL Reference](/docs/reference/sql-reference#table-references).

---

### Unsupported

An unsupported operation was attempted.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `String` | Description of the unsupported operation |

**Common causes:**
- Attempting SQL operations blocked in v1 (INSERT, UPDATE, DELETE, DROP, ALTER)
- Using features planned for v2

**Resolution:** Use the Python SDK for data operations. See the [SQL Reference](/docs/reference/sql-reference#blocked-operations) for alternatives.

---

### Ledger

A ledger operation failed for a specific frame.

| Field | Type | Description |
|-------|------|-------------|
| `frame_id` | `FrameId` | The frame whose ledger had an error |
| `message` | `String` | Description of the ledger error |

**Common causes:**
- Corrupted or missing ledger files in storage
- Race condition during concurrent writes (should auto-retry)
- Storage backend returning unexpected responses

**Resolution:** If the ledger is corrupted, you may need to rebuild the frame using `overwrite_frame()`. Check storage backend logs for underlying issues.

---

### Internal

An internal error indicating a bug in Apiary.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `String` | Description of the internal error |

**Common causes:**
- This indicates a bug in Apiary itself, not a user error

**Resolution:** Please report this as a [GitHub issue](https://github.com/ApiaryData/apiary/issues) with the full error message, steps to reproduce, and your Apiary version.

---

### Conflict

A conflict occurred during a DDL operation (registry update) after exhausting retries.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `String` | Description of the conflict |

**Common causes:**
- Multiple nodes performing DDL operations (create/delete hives/boxes/frames) simultaneously
- Very high contention on the registry

**Resolution:** This is rare in practice. Reduce concurrent DDL operations or retry from the application layer. Data writes are not affected by registry conflicts.

---

### Serialization

A serialization or deserialization error occurred.

| Field | Type | Description |
|-------|------|-------------|
| (message) | `String` | Description of the serialization failure |

**Common causes:**
- Corrupted JSON in registry, ledger, or heartbeat files
- Incompatible data format from a different Apiary version

**Resolution:** Check for corrupted files in storage. If upgrading Apiary versions, ensure all nodes run the same version.

---

## Error Handling in Python

All Apiary errors are raised as Python `RuntimeError` exceptions with a descriptive message:

```python
from apiary import Apiary

ap = Apiary("test")
ap.start()

try:
    ap.create_hive("warehouse")
except RuntimeError as e:
    if "already exists" in str(e):
        print("Hive already exists, continuing...")
    else:
        raise

ap.shutdown()
```

The error message string includes the Rust error type information, making it possible to distinguish error categories by pattern matching on the message text.
