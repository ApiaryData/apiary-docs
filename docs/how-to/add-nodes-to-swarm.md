---
title: Add Nodes to the Swarm
sidebar_position: 6
description: "How to add Raspberry Pi, Docker, or Kubernetes nodes to an existing Apiary swarm."
---

# Add Nodes to the Swarm

Adding a node to an Apiary swarm requires one thing: connect the new node to the same storage backend as the existing nodes. There is no registration step, no token exchange, and no seed node configuration.

## Add a Raspberry Pi

On the new Pi, install Apiary (see [Install Apiary](/docs/how-to/install-apiary)) and configure the same S3 credentials:

```bash
export AWS_ACCESS_KEY_ID=apiary
export AWS_SECRET_ACCESS_KEY=apiary123
export AWS_ENDPOINT_URL=http://minio-host:9000
```

Start the node with the same storage URI as the existing swarm:

```python
from apiary import Apiary

ap = Apiary("production", storage="s3://apiary-data/prod")
ap.start()

# Verify it joined the swarm
swarm = ap.swarm_status()
print(f"Nodes alive: {swarm['alive']}")
for node in swarm['nodes']:
    print(f"  {node['node_id']}: {node['state']}")
```

The new node writes its first heartbeat within 5 seconds. Other nodes see it within 10 seconds (one heartbeat read cycle).

## Add a Docker Container

Start a new container with the same environment variables:

```bash
docker run -d --name apiary-node-new \
  --network apiary-network \
  -e AWS_ACCESS_KEY_ID=apiary \
  -e AWS_SECRET_ACCESS_KEY=apiary123 \
  -e AWS_ENDPOINT_URL=http://minio:9000 \
  -e APIARY_STORAGE=s3://apiary-data/prod \
  apiary:latest
```

Or with Docker Compose, add a new service entry and run:

```bash
docker compose up -d
```

## Add a Kubernetes Pod

Scale the existing deployment:

```bash
kubectl scale deployment apiary -n apiary --replicas=4
```

The new pod automatically joins the swarm through the shared S3 bucket configured in the deployment's environment variables.

## Verify the New Node

From any connected client:

```python
swarm = ap.swarm_status()
print(f"Total nodes alive: {swarm['alive']}")
print(f"Total bees: {swarm['total_bees']}")
for node in swarm['nodes']:
    print(f"  {node['node_id']}: {node['state']} ({node['cores']} cores, {node['memory_gb']:.1f} GB)")
```

Or via SQL:

```python
# Queries now distribute across all available nodes automatically
result = ap.sql("SELECT region, COUNT(*) FROM warehouse.sales.orders GROUP BY region")
```

## How Discovery Works

1. The new node writes a heartbeat file to `_heartbeats/node_{id}.json` in shared storage
2. Existing nodes read all heartbeat files during their next poll cycle (every 5 seconds)
3. The new node appears as "alive" in the world view
4. The query planner includes the new node in distributed query planning

No configuration changes are needed on existing nodes.
