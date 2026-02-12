---
title: Monitor Swarm Health
sidebar_position: 8
description: "How to monitor node status, swarm membership, and colony health."
---

# Monitor Swarm Health

Apiary provides four status APIs for monitoring: node status, bee status, swarm status, and colony status.

## Check Node Status

```python
s = ap.status()
print(f"Node: {s['node_id']}")
print(f"Cores: {s['cores']}")
print(f"Memory: {s['memory_gb']:.1f} GB")
print(f"State: {s['state']}")
```

## Check Bee Status

See per-core utilization:

```python
bees = ap.bee_status()
for bee in bees:
    print(f"Bee {bee['bee_id']}: {bee['state']} — "
          f"{bee['memory_used_mb']:.0f}/{bee['memory_budget_mb']:.0f} MB")
```

Bee states:
- **idle** -- Available for tasks
- **busy** -- Executing a task
- **draining** -- Finishing current task before shutdown

## Check Swarm Status

See all nodes in the swarm:

```python
swarm = ap.swarm_status()
print(f"Nodes alive: {swarm['alive']}")
print(f"Total bees: {swarm['total_bees']}")

for node in swarm['nodes']:
    print(f"  {node['node_id']}: {node['state']} "
          f"({node['cores']} cores, {node['memory_gb']:.1f} GB)")
```

Node states:
- **alive** -- Heartbeat updated within the last 15 seconds
- **suspect** -- Heartbeat is 15-30 seconds old
- **dead** -- Heartbeat is older than 30 seconds

## Check Colony Status

Monitor the behavioral model:

```python
colony = ap.colony_status()
print(f"Temperature: {colony['temperature']:.2f}")
print(f"Regulation: {colony['regulation']}")
print(f"Abandoned tasks: {colony['abandoned_tasks']}")
```

Temperature ranges:
- **Cold** (0.0-0.3) -- System underutilized
- **Ideal** (0.3-0.7) -- Normal operating range
- **Warm** (0.7-0.85) -- Approaching capacity
- **Hot** (0.85-0.95) -- Consider reducing write load (v2: automatic backpressure)
- **Critical** (0.95-1.0) -- Investigate immediately (v2: query admission control)

## Create a Monitoring Script

Poll status at regular intervals:

```python
import time
from apiary import Apiary

ap = Apiary("production", storage="s3://apiary-data/prod")
ap.start()

while True:
    # Node health
    colony = ap.colony_status()
    swarm = ap.swarm_status()

    print(f"[{time.strftime('%H:%M:%S')}] "
          f"Temp: {colony['temperature']:.2f} ({colony['regulation']}) | "
          f"Nodes: {swarm['alive']} alive | "
          f"Bees: {swarm['total_bees']} | "
          f"Abandoned: {colony['abandoned_tasks']}")

    # Alert on high temperature
    if colony['temperature'] > 0.85:
        print("  WARNING: Colony temperature is HOT — consider reducing write load")

    # Alert on dead nodes
    dead_nodes = [n for n in swarm['nodes'] if n['state'] == 'dead']
    if dead_nodes:
        for n in dead_nodes:
            print(f"  ALERT: Node {n['node_id']} is DEAD")

    time.sleep(10)
```

## Check Logs (Systemd)

If running as a systemd service:

```bash
# Recent logs
journalctl -u apiary --since "5 minutes ago"

# Follow logs in real time
journalctl -u apiary -f

# Filter by log level
journalctl -u apiary | grep -i error
```

## Adjust Log Verbosity

Set the `RUST_LOG` environment variable:

```bash
# Default: info level
RUST_LOG=info

# Debug query execution
RUST_LOG=info,apiary_query=debug

# Trace storage operations
RUST_LOG=info,apiary_storage=trace

# Debug everything
RUST_LOG=debug
```
