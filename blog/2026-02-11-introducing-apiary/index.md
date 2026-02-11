---
slug: introducing-apiary
title: "Introducing Apiary: A Lakehouse for Small Compute"
authors: [apiarydata]
tags: [announcement, architecture]
---

We are excited to introduce **Apiary**, a distributed data processing framework designed from the ground up for small compute hardware. Apiary runs on Raspberry Pis, NUCs, old laptops, and similar devices -- while scaling to cloud compute when needed.

<!-- truncate -->

## The Problem

Most distributed data systems are designed for the cloud. They assume abundant memory, fast SSDs, and reliable high-bandwidth networks. When you try to run them on a Raspberry Pi with 4 GB of RAM and an SD card, they struggle or fail entirely.

But there is a growing need for data processing on small, inexpensive hardware. Edge analytics, home automation, educational environments, and cost-conscious organizations all benefit from running data workloads on hardware that costs tens of dollars, not thousands.

## Our Approach

Apiary solves this by inverting the usual design: instead of building for the cloud and squeezing down to a Pi, we build for the Pi and scale up to the cloud.

The key design decisions:

**Object storage as the sole coordination layer.** All committed data, metadata, and coordination state lives in S3, MinIO, GCS, or the local filesystem. Nodes never communicate directly. This eliminates the NAT traversal, firewall configuration, and mesh networking complexity that plagues distributed systems on home networks.

**One core equals one bee.** Each CPU core is an isolated execution unit (a "bee") with its own memory budget. On a 4 GB Raspberry Pi, four bees each get roughly 1 GB. Memory limits are hard -- a runaway query kills one bee's task, not the entire node.

**Biology-driven resource management.** Memory budgets, data cell sizing, backpressure, and failure recovery are governed by algorithms inspired by real bee colony behaviors. Mason bee sealed chambers provide execution isolation. Leafcutter bee sizing ensures data cells fit within bee memory budgets. Colony temperature drives write backpressure.

**Zero-configuration multi-node.** A second node joins the swarm by connecting to the same storage bucket. No seed nodes, no tokens, no mesh network setup. Nodes discover each other through heartbeat files in storage.

## What v1 Delivers

Apiary v1 is a complete data platform:

- **Python SDK** for data operations with zero-copy Arrow interop
- **SQL queries** via Apache DataFusion over Parquet files
- **ACID transactions** using conditional writes (no Raft, no consensus protocol)
- **Distributed query execution** with cache-aware planning across multiple nodes
- **Four behavioral algorithms** for resource management: mason bee chambers, leafcutter sizing, task abandonment, and colony temperature

## Getting Started

The fastest way to try Apiary is the [Your First Apiary](/docs/tutorials/your-first-apiary) tutorial. In about 10 minutes, you will install Apiary, write data, and run SQL queries.

For multi-node deployments, see the [Multi-Node Swarm](/docs/tutorials/multi-node-swarm) tutorial, which walks through setting up a Docker Compose cluster.

## What Comes Next

v2 will add direct communication between nodes (SWIM gossip, Arrow Flight) for workloads that require low latency, while maintaining S3-based coordination as a fallback. The behavioral model expands to 20 behaviors, and we add streaming ingestion, time travel queries, and schema evolution.

See the [Roadmap](/docs/explanation/roadmap) for the full plan.

## Open Source

Apiary is open source under the Apache License 2.0. We value simplicity over features, correctness over speed, and documentation as a product.

[View on GitHub](https://github.com/ApiaryData/apiary)
