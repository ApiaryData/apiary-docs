---
title: Behavioral Model
sidebar_position: 6
description: "The four v1 bee-inspired behaviors that govern Apiary's resource management."
---

# Behavioral Model

Apiary's resource management is governed by bee-inspired behavioral algorithms. These are not metaphors -- they are runtime mechanisms that make concrete decisions about memory allocation, task sizing, failure recovery, and system health.

v1 implements four behaviors. An additional sixteen are planned for v2 and beyond.

## v1 Behaviors

### 1. Mason Bee Sealed Chambers

**Biological basis:** Mason bees (Osmia) build individual sealed chambers for each offspring. Each chamber is self-contained with its own food supply and protective walls. A parasite or failure in one chamber does not affect neighboring chambers.

**Apiary implementation:** Each CPU core runs as an isolated bee within a sealed chamber. A chamber enforces:

- **Memory budget.** Hard limit on memory allocated to this bee. On a 4 GB Pi with 4 cores, each bee gets ~1 GB. Exceeding the budget fails the task, not the node.
- **Scratch directory isolation.** Each bee has its own temporary directory for spill files. One bee's disk usage does not interfere with others.
- **Task timeout.** Each task has a maximum execution time (default: 30 seconds). A runaway query is terminated without affecting other bees.

The key property is **blast-radius containment**. A malformed query that causes an out-of-memory condition kills one bee's task. The other bees continue operating, and the failed task is retried (possibly on a different node).

```
Node with 4 cores:
┌─────────────────────────────────────────────┐
│ BeePool                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Bee 0    │ │ Bee 1    │ │ Bee 2    │ │ Bee 3    │ │
│ │ 1GB mem  │ │ 1GB mem  │ │ 1GB mem  │ │ 1GB mem  │ │
│ │ /tmp/b0  │ │ /tmp/b1  │ │ /tmp/b2  │ │ /tmp/b3  │ │
│ │ timeout  │ │ timeout  │ │ timeout  │ │ timeout  │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────┘
```

### 2. Leafcutter Bee Precise Cutting

**Biological basis:** Leafcutter bees (Megachile) cut leaf pieces to precisely fit their nest chambers. Each piece is measured and trimmed to the exact size needed -- not too large (won't fit), not too small (wasted trips).

**Apiary implementation:** Cell sizes are calculated to match the scanning node's memory budget:

```
target_cell_size = memory_per_bee / 4
max_cell_size    = target * 2
min_cell_size    = 16 MB (S3 overhead floor)
```

**Why `/4`?** A bee needs to hold the input cell in memory, intermediate computation state, and the output. With a factor of 4, a bee can hold one cell plus working memory comfortably. This is a conservative heuristic appropriate for resource-constrained hardware.

**Why the 16 MB floor?** Object storage has per-request overhead (20-200ms per GET). Very small cells (< 1 MB) spend more time on request overhead than on actual data transfer. The 16 MB floor ensures that I/O cost is amortized over enough data.

**Practical sizes:**

| Hardware | Memory/Bee | Target Cell | Min Cell |
|----------|-----------|-------------|----------|
| Raspberry Pi 4 (4 GB) | 1 GB | 256 MB | 16 MB |
| NUC (16 GB, 4 cores) | 4 GB | 1 GB | 16 MB |
| Cloud VM (64 GB, 16 cores) | 4 GB | 1 GB | 16 MB |

### 3. Task Abandonment

**Biological basis:** Honey bees abandon unprofitable food sources after repeated visits that yield no nectar. This frees foragers to search for productive alternatives instead of wasting energy on depleted sources.

**Apiary implementation:** When a task fails, it is retried up to 3 times (configurable). After the maximum retries, the task is permanently abandoned and diagnostics are recorded.

The abandonment tracker records:

- Task ID and type
- Number of attempts
- Error from each attempt
- Final abandonment timestamp

This prevents poison-pill tasks -- queries that trigger OOM, deadlock, or corruption on every attempt -- from consuming resources indefinitely. The diagnostics provide debugging information for operators.

### 4. Colony Temperature

**Biological basis:** Honey bee colonies maintain hive temperature within a narrow optimal range (34-36°C). When the hive overheats, bees fan their wings to circulate air. When it cools, they cluster and vibrate to generate heat. The temperature is a collective signal that drives individual behavior.

**Apiary implementation:** Colony temperature is a composite metric from 0.0 (cold) to 1.0 (critical):

```
temperature = weighted_average(
    cpu_utilization,     # per-bee average
    memory_pressure,     # allocated / budget
    queue_depth          # pending tasks / bee count
)
```

The temperature drives system behavior:

| Range | Classification | System Response |
|-------|---------------|-----------------|
| 0.0 -- 0.3 | Cold | System underutilized; no restrictions |
| 0.3 -- 0.7 | Ideal | Normal operating range |
| 0.7 -- 0.85 | Warm | Approaching capacity; maintenance may be deferred |
| > 0.85 -- 0.95 | Hot | Temperature reported to clients via `colony_status()` and `WriteResult` |
| > 0.95 | Critical | Temperature reported to clients; operators should investigate |

In v1, colony temperature is an **observability signal**. It is measured and reported to clients in `colony_status()` and in every `WriteResult`, allowing applications and operators to make informed decisions. Active enforcement (write backpressure and query admission control) is planned for v2.

:::info Planned for v2
In v2, the Hot and Critical states will actively enforce backpressure:
- **Hot (0.85--0.95):** New writes will block until temperature drops or a timeout is reached.
- **Critical (0.95--1.0):** Query admission will be restricted.
:::

## Behavior Interactions

The four v1 behaviors form an interconnected system:

```
Colony Temperature → Temperature reporting → Informs ingest decisions
       ↑                                         │
       │                                         ↓
  Mason Chambers → Memory isolation → Prevents cascading OOM
       ↑                                         │
       │                                         ↓
  Leafcutter Sizing → Right-sized cells → Fits in chamber budget
       ↑                                         │
       │                                         ↓
  Abandonment → Failed task cleanup → Frees bee capacity
       │                                         │
       └─────────── Lowers temperature ←─────────┘
```

Temperature rises when bees are busy. If a task fails repeatedly and is abandoned, it frees the bee, which lowers temperature. Leafcutter sizing ensures cells fit within mason chambers. Temperature reporting enables applications to implement their own backpressure logic in v1; active enforcement is planned for v2.

## v2 and Beyond

v2 will expand the behavioral model to 20 behaviors, including:

- **Waggle Dance** -- Quality-weighted task distribution based on data locality and worker performance
- **Three-Tier Workers** -- Employed (cached data), Onlooker (available capacity), Scout (new data discovery) roles
- **Pheromone Signalling** -- Distributed backpressure via gossip
- **Nectar Ripening** -- Streaming ingestion pipeline (raw data → validated → committed)
- **Queen Substance** -- Configuration propagation across the swarm
- **Drone Assembly** -- Dedicated high-memory bees for large aggregations
- **Robber Detection** -- Anomalous access pattern detection
- **Hibernation** -- Power-saving mode for idle nodes

These behaviors are documented in the architecture design but not yet implemented. See [Roadmap](/docs/explanation/roadmap).
