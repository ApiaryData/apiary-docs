---
title: "Multi-Node Swarm"
sidebar_position: 3
description: "Set up a distributed Apiary cluster with Docker Compose, MinIO, and multiple nodes."
---

# Multi-Node Swarm

In this tutorial, you will set up a distributed Apiary cluster using Docker Compose with MinIO as the shared storage backend. You will write data, observe distributed query execution across multiple nodes, and add a new node to the swarm.

**What you will learn:**
- How to set up MinIO as a shared storage backend
- How multiple Apiary nodes form a swarm automatically
- How distributed queries work
- How to add a new node to the swarm
- How to monitor swarm health

**Prerequisites:**
- Docker and Docker Compose installed
- Completed [Your First Apiary](/docs/tutorials/your-first-apiary)
- Apiary installed locally (for the client)

---

## Step 1: Create the Docker Compose File

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: apiary
      MINIO_ROOT_PASSWORD: apiary123
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio-init:
    image: minio/mc
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 apiary apiary123;
      mc mb --ignore-existing local/apiary-data;
      echo 'Bucket created';
      "

  apiary-node-1:
    image: apiary:latest
    depends_on:
      minio-init:
        condition: service_completed_successfully
    environment:
      AWS_ACCESS_KEY_ID: apiary
      AWS_SECRET_ACCESS_KEY: apiary123
      AWS_ENDPOINT_URL: http://minio:9000
      APIARY_STORAGE: s3://apiary-data/swarm

  apiary-node-2:
    image: apiary:latest
    depends_on:
      minio-init:
        condition: service_completed_successfully
    environment:
      AWS_ACCESS_KEY_ID: apiary
      AWS_SECRET_ACCESS_KEY: apiary123
      AWS_ENDPOINT_URL: http://minio:9000
      APIARY_STORAGE: s3://apiary-data/swarm

  apiary-node-3:
    image: apiary:latest
    depends_on:
      minio-init:
        condition: service_completed_successfully
    environment:
      AWS_ACCESS_KEY_ID: apiary
      AWS_SECRET_ACCESS_KEY: apiary123
      AWS_ENDPOINT_URL: http://minio:9000
      APIARY_STORAGE: s3://apiary-data/swarm

volumes:
  minio-data:
```

## Step 2: Start the Cluster

```bash
docker compose up -d
```

Wait about 10 seconds for the nodes to start and discover each other.

You can check the MinIO Console at `http://localhost:9001` (user: `apiary`, password: `apiary123`) to see the bucket and files being created.

## Step 3: Connect a Client

From your local machine, set up the S3 credentials and connect:

```python
import os
os.environ["AWS_ACCESS_KEY_ID"] = "apiary"
os.environ["AWS_SECRET_ACCESS_KEY"] = "apiary123"
os.environ["AWS_ENDPOINT_URL"] = "http://localhost:9000"

from apiary import Apiary

ap = Apiary("swarm", storage="s3://apiary-data/swarm")
ap.start()
```

## Step 4: Check the Swarm

Verify that all three nodes are visible:

```python
import time
time.sleep(10)  # Wait for heartbeats to propagate

swarm = ap.swarm_status()
print(f"Nodes alive: {swarm['alive']}")
print(f"Total bees: {swarm['total_bees']}")

for node in swarm['nodes']:
    print(f"  {node['node_id']}: {node['state']} "
          f"({node['cores']} cores, {node['memory_gb']:.1f} GB)")
```

You should see 3 (or 4, including your local client) nodes in the swarm.

## Step 5: Write Data

Create a frame and write a larger dataset so that distributed queries have something to work with:

```python
import pyarrow as pa

ap.create_hive("analytics")
ap.create_box("analytics", "events")
ap.create_frame("analytics", "events", "clicks", {
    "event_id": "int64",
    "user_id": "utf8",
    "page": "utf8",
    "duration_ms": "int64",
    "country": "utf8",
}, partition_by=["country"])

# Generate data across multiple countries
countries = ["us", "uk", "de", "fr", "jp", "br", "au", "ca"]
all_rows = {
    "event_id": [],
    "user_id": [],
    "page": [],
    "duration_ms": [],
    "country": [],
}

import random
pages = ["/home", "/products", "/about", "/pricing", "/docs", "/blog"]

for i in range(10000):
    all_rows["event_id"].append(i)
    all_rows["user_id"].append(f"user_{random.randint(1, 500)}")
    all_rows["page"].append(random.choice(pages))
    all_rows["duration_ms"].append(random.randint(100, 30000))
    all_rows["country"].append(random.choice(countries))

table = pa.table(all_rows)

sink = pa.BufferOutputStream()
writer = pa.ipc.new_stream_writer(sink, table.schema)
writer.write_table(table)
writer.close()

result = ap.write_to_frame("analytics", "events", "clicks", sink.getvalue().to_pybytes())
print(f"Cells written: {result['cells_written']}")
print(f"Rows written: {result['rows_written']}")
```

## Step 6: Run Distributed Queries

With multiple nodes and multiple cells, queries can distribute across the swarm:

```python
# Top pages by visit count
result_bytes = ap.sql("""
    SELECT page, COUNT(*) AS visits, AVG(duration_ms) AS avg_duration
    FROM analytics.events.clicks
    GROUP BY page
    ORDER BY visits DESC
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

```python
# Country breakdown
result_bytes = ap.sql("""
    SELECT country, COUNT(*) AS events, AVG(duration_ms) AS avg_duration
    FROM analytics.events.clicks
    GROUP BY country
    ORDER BY events DESC
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

The query planner distributes cells across available nodes based on cache locality and capacity. Use EXPLAIN ANALYZE to see how cells were distributed:

```python
result_bytes = ap.sql("""
    EXPLAIN ANALYZE
    SELECT country, COUNT(*)
    FROM analytics.events.clicks
    GROUP BY country
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

## Step 7: Add a Fourth Node

Add a new node by starting another container:

```bash
docker compose up -d --scale apiary-node-1=2
```

Or add a new service entry in `docker-compose.yml` and run `docker compose up -d`.

Wait 10 seconds, then check the swarm again:

```python
time.sleep(10)
swarm = ap.swarm_status()
print(f"Nodes alive: {swarm['alive']}")
for node in swarm['nodes']:
    print(f"  {node['node_id']}: {node['state']}")
```

The new node appears automatically. Future queries will include it in the distribution plan.

## Step 8: Monitor the Swarm

Check colony health across the swarm:

```python
colony = ap.colony_status()
print(f"Temperature: {colony['temperature']:.2f}")
print(f"Regulation: {colony['regulation']}")
print(f"Abandoned tasks: {colony['abandoned_tasks']}")
```

## Step 9: Clean Up

```python
ap.shutdown()
```

```bash
docker compose down -v
```

## What You Learned

- **Nodes form a swarm automatically** by connecting to the same S3 bucket
- **Heartbeats** in storage enable node discovery without gossip or seed nodes
- **Distributed queries** assign cells to nodes based on cache locality and capacity
- **Scaling** is done by starting new nodes -- no reconfiguration needed
- **Colony status** provides a health overview of the entire swarm

## Next Steps

- [Add Nodes to the Swarm](/docs/how-to/add-nodes-to-swarm) -- Add Raspberry Pis, Docker containers, or Kubernetes pods
- [Swarm Coordination](/docs/explanation/swarm-coordination) -- Understand the heartbeat and world view mechanism
- [Query Execution](/docs/explanation/query-execution) -- Deep dive into how distributed queries work
- [Deploy on Kubernetes](/docs/how-to/deploy-kubernetes) -- Production deployment with Kubernetes
