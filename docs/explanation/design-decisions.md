---
title: Design Decisions
sidebar_position: 7
description: "Why Apiary chose its approach: the rationale behind key architectural decisions."
---

# Design Decisions

This page collects the reasoning behind Apiary's major architectural choices. Each section explains what alternatives were considered and why Apiary chose its approach.

## Why Object Storage, Not Local-First?

**Decision:** All canonical state lives in object storage (S3, MinIO, GCS, or local filesystem).

**Alternatives considered:** Local-first storage with replication (like CockroachDB or Cassandra), or a hybrid model where hot data lives locally and cold data spills to object storage.

**Why object storage wins for Apiary's use case:**

1. **Cell location tracking is eliminated.** Every node can read every cell. There is no need to track which node holds which file, no gossip state for cell locations, no replication protocol.

2. **Write path residency is eliminated.** Any node can write to any frame. The conditional put on the ledger provides serialization. No consensus protocol needed.

3. **Durability is delegated.** S3 provides 99.999999999% (eleven nines) durability. Apiary does not need to implement its own replication, and a Raspberry Pi's SD card failure does not lose data.

**The tradeoff:** Latency. S3 round trips add 20-200ms per operation. An internet or network dependency is introduced. The local cell cache mitigates read latency for hot data. Write latency is acceptable for v1's batch workloads. v2's local write-ahead log (flushed to S3 asynchronously) will address streaming write latency.

## Why Conditional Puts, Not Raft?

**Decision:** Concurrent writes are serialized using `put_if_not_exists` on the storage backend, not a Raft consensus protocol.

**What Raft requires:** A leader election protocol, a persistent log on every node, a state machine that applies committed entries, a TCP transport between consensus participants, and handling of membership changes. It is the most complex component in a distributed system.

**What conditional puts require:** A single HTTP request with a header (`If-None-Match: *`). The storage layer (S3, GCS, or the local filesystem) provides the atomic operation. Apiary trusts the storage layer's consistency guarantees, which have been battle-tested at planetary scale.

**The tradeoff:** Commit latency. Raft can commit in a single network round trip (~1ms on a LAN). S3 conditional puts take 50-200ms. For v1's batch workloads, this difference is negligible. For v2's streaming writes, a write-ahead log on local disk (flushed to S3 asynchronously) will bridge the gap.

## Why No Gossip Protocol?

**Decision:** Nodes discover each other by reading heartbeat files from storage, with 5-second write intervals and 30-second failure detection.

**Alternatives considered:** SWIM (Scalable Weakly-consistent Infection-style Membership), Serf, or custom gossip over UDP.

**Why storage-based heartbeats for v1:**

1. **Network assumptions.** Gossip requires nodes to reach each other directly. On a home network with Raspberry Pis behind NAT routers, this is not guaranteed. Storage is always reachable.

2. **Complexity.** SWIM requires a protocol implementation, a transport layer, and careful tuning of probe intervals, suspicion timeouts, and incarnation numbers. Storage-based heartbeats are JSON file reads and writes.

3. **Detection speed acceptable in v1.** 30-second failure detection is fine for batch queries that take minutes. Sub-second detection matters for streaming workloads, which are a v2 feature.

**v2 adds SWIM gossip** for sub-second failure detection, supplementing (not replacing) storage-based coordination.

## Why No Direct Node-to-Node Communication?

**Decision:** Nodes never communicate directly. All coordination goes through object storage: heartbeats, query manifests, partial results, cached cell reports.

**What direct communication would enable:** Lower-latency query results, data shuffles without S3 round trips, real-time cache coordination.

**Why Apiary avoids it:**

1. **NAT traversal.** Home networks use NAT. Direct communication requires port forwarding, UPnP, or a relay -- all complex and unreliable.
2. **Firewall configuration.** Each open port is an attack surface.
3. **Connection management.** TCP connections between N nodes scale as O(N^2).
4. **Partial failures.** Node A can reach B but not C, creating split-brain scenarios that are difficult to handle correctly.

**v2 adds Arrow Flight** for low-latency data shuffles between nodes that can reach each other, with S3 as a fallback for nodes behind NAT.

## Why SQL Fragments, Not Serialized Physical Plans?

**Decision:** Distributed queries send SQL strings to workers, not serialized DataFusion physical plans.

**What plan serialization would enable:** No re-parsing or re-planning on workers. More precise control over execution operators.

**Why Apiary uses SQL fragments:**

1. **DataFusion plan serialization is not stable.** The plan format changes between DataFusion releases. Apiary would be tightly coupled to a specific DataFusion version for plan wire format.
2. **SQL is debuggable.** You can read a SQL fragment, paste it into a shell, and test it. Serialized plans are opaque binary data.
3. **Workers are self-contained.** Each worker runs its own DataFusion instance with its own planning. SQL fragments make workers truly independent.

**The cost:** Re-parsing and re-planning on each worker, adding milliseconds per query. For v1's batch workloads, this is negligible compared to I/O time (the dominant cost).

## Why S3 for Shuffles, Not Arrow Flight?

**Decision:** Partial query results are exchanged via Arrow IPC files in S3, not via Arrow Flight gRPC.

**What Arrow Flight would enable:** Sub-millisecond data transfer between nodes on the same network. No storage round trip for intermediate results.

**Why S3 for v1:**

1. **Same NAT/firewall concerns** as direct communication above.
2. **S3 is already available.** Every Apiary deployment has a storage backend. Arrow Flight requires a separate gRPC service on every node.
3. **Simplicity.** S3 shuffles use the same storage backend API as everything else. One code path, one failure mode.
4. **Acceptable for batch.** A 200ms S3 round trip per partial result is negligible when the query itself takes seconds.

**v2 introduces Arrow Flight** as an optimization for nodes on the same network, with S3 as the fallback.

## Why Not a DataFusion CatalogProvider?

**Decision:** Apiary resolves table references by intercepting them in the query layer and constructing DataFusion table providers manually, rather than implementing DataFusion's `CatalogProvider` trait.

**Why:** The CatalogProvider trait assumes a static catalog that can be queried synchronously. Apiary's registry is in object storage and requires async reads. The v1 approach is simpler: read the registry once at query time, build a one-shot DataFusion session, and discard it. This avoids cache invalidation complexity.

**Future:** v2 may implement CatalogProvider with a registry cache and invalidation via heartbeat signals.
