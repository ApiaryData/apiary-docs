---
title: Swarm Coordination
sidebar_position: 4
description: "How Apiary nodes discover each other and coordinate through storage."
---

# Swarm Coordination

Apiary nodes coordinate exclusively through the storage layer. There is no gossip protocol, no membership service, and no direct communication between nodes. Every piece of coordination state is a file in object storage.

## Heartbeat Mechanism

Each running node writes a heartbeat file to storage every 5 seconds:

```
_heartbeats/node_{node_id}.json
```

The heartbeat contains:

```json
{
  "node_id": "rpi-kitchen-01",
  "state": "alive",
  "cores": 4,
  "memory_gb": 3.7,
  "bees_active": 2,
  "bees_idle": 2,
  "cache_keys": ["cell_a1b2c3", "cell_d4e5f6"],
  "temperature": 0.45,
  "last_updated": "2026-02-10T14:30:00Z"
}
```

The heartbeat is the only signal a node sends to the swarm. It is intentionally simple -- a single JSON file that any node can read.

## World View

Each node periodically reads all heartbeat files from `_heartbeats/` and builds a world view: a snapshot of the entire swarm's state. The world view contains:

- All known nodes and their current state
- Aggregate capacity (total bees, total memory)
- Cache contents per node (for cache-aware query planning)

### Node State Detection

Node state is determined by heartbeat age:

| Heartbeat Age | State | Meaning |
|--------------|-------|---------|
| < 15 seconds | **Alive** | Node is operating normally |
| 15 -- 30 seconds | **Suspect** | Node may have failed; do not assign new work |
| > 30 seconds | **Dead** | Node has failed; reassign its tasks |

These thresholds are deliberately conservative. On a home network with variable latency and constrained hardware, a node might be slow to write its heartbeat without being truly failed.

## Node Lifecycle

```
Start → Write first heartbeat → Alive
                                  │
                          ┌───────┴───────┐
                          │               │
                    Heartbeat OK    Heartbeat stale
                          │               │
                        Alive          Suspect
                                          │
                                    Heartbeat recovery?
                                     ┌────┴────┐
                                    Yes        No
                                     │          │
                                   Alive      Dead
                                               │
                                          Cleanup (60s)
                                               │
                                      Heartbeat deleted
```

### Graceful Departure

When a node shuts down gracefully (`ap.shutdown()`), it deletes its heartbeat file. Other nodes immediately see it as gone -- no 30-second detection delay.

### Crash Detection

If a node crashes (power loss, kernel panic, network failure), its heartbeat file remains but stops being updated. After 15 seconds it becomes suspect; after 30 seconds, dead. After 60 seconds, another node cleans up the stale heartbeat file.

## Solo Mode

A single node with local filesystem storage is a swarm of one. The heartbeat mechanism still runs -- the node writes its heartbeat to the local `_heartbeats/` directory and reads it back. This means there is no special "solo mode" code path. The same swarm coordination logic runs whether there are 1 or 100 nodes.

This design choice keeps the codebase simple: one code path, tested at every scale.

## Distributed Task Coordination

When a query spans multiple nodes, the coordinator writes a **query manifest** to storage:

```
_queries/{query_id}/manifest.json
```

The manifest contains:

- The SQL query
- Cell-to-node assignments (which node scans which cells)
- Cache-aware assignments (prefer nodes that already have cells cached)

Workers poll for new manifests. When a worker finds a manifest with cells assigned to it:

1. Read assigned cells from storage (or cache)
2. Execute the SQL fragment
3. Write partial results as Arrow IPC to `_queries/{query_id}/partial_{node_id}.arrow`

The coordinator polls for partial results, merges them, and returns the final result.

### Cache-Aware Planning

Each node's heartbeat reports which cells it has cached locally. The query planner uses this information to preferentially assign cells to nodes that already have them cached, reducing S3 fetches.

If no node has a cell cached, the planner assigns it based on available capacity (idle bees).

## Why No Gossip?

Gossip protocols (like SWIM) provide sub-second failure detection through peer-to-peer probing. They are effective and well-understood. So why does Apiary use storage-based heartbeats instead?

**Network assumptions.** Gossip requires that nodes can reach each other directly. On a home network with Raspberry Pis behind NAT routers, this is not guaranteed. Storage (S3, MinIO, or local filesystem) is always reachable.

**Complexity.** SWIM requires a protocol implementation, a transport layer, and careful tuning of probe intervals, suspicion timeouts, and incarnation numbers. Storage-based heartbeats require writing and reading JSON files.

**v1 scope.** 5-second heartbeats with 30-second failure detection is acceptable for v1's batch query workloads. Gossip is planned for v2, where streaming workloads require sub-second detection.

## Why No Direct Communication?

Direct node-to-node communication (for query results, data shuffles, or cache coordination) would reduce latency. But it introduces:

- **NAT traversal.** Home networks often use NAT. Direct communication requires port forwarding, UPnP, or a relay service.
- **Firewall configuration.** Each new port is an attack surface that must be secured.
- **Connection management.** TCP connections between N nodes scale as O(N^2).
- **Partial failures.** Node A can reach B but not C, creating split-brain scenarios.

By routing everything through storage, Apiary eliminates all of these problems. The tradeoff is higher latency for coordination (50-200ms per S3 round trip). For v1's batch workloads, this is acceptable.

v2 adds Arrow Flight for low-latency data shuffles between nodes that can reach each other directly, with S3 as a fallback.
