---
title: Benchmarks
sidebar_position: 8
description: "Reference for the Apiary benchmark framework, suites, and execution methodology."
---

# Benchmarks

Apiary includes a benchmark framework for measuring query performance across different hardware profiles. The framework supports both direct DataFusion execution and full Apiary Docker stack testing.

## Benchmark Suites

### Tier 1 -- Baseline Credibility

These are industry-standard benchmarks for establishing baseline comparability:

| Suite | Tables | Queries | Purpose |
|-------|--------|---------|---------|
| **SSB** (Star Schema Benchmark) | 5 | 13 | Star schema analytics, primary baseline |
| **TPC-H** | 8 | 22 | Industry-standard decision support benchmark |

Both suites support multiple scale factors:

| Scale Factor | Approximate Size | Use Case |
|-------------|------------------|----------|
| SF1 | ~1 GB | Quick smoke tests, Pi development |
| SF10 | ~10 GB | Full Pi benchmarks, baseline measurements |
| SF100 | ~100 GB | Cloud/desktop benchmarks, stress testing |

### Tier 2 -- Apiary-Specific

| Suite | What It Tests | Requirements |
|-------|---------------|-------------|
| `apiary_format` | Query across Parquet, CSV, and Arrow simultaneously | Single node |
| `apiary_heterogeneous` | Mixed Pi 4/Pi 5/x86 coordination | Multi-node |
| `apiary_acid` | Concurrent reads + writes (0, 1, 2, 4 concurrent writers) | Single node |
| `apiary_elasticity` | Dynamic node join/leave during queries | Multi-node |

### Tier 3 -- Stretch Goals

| Suite | Size | Purpose |
|-------|------|---------|
| **JOB** (Join Order Benchmark) | ~3.6 GB (IMDB) | Complex join optimization |
| **ClickBench** (subset) | ~14 GB (Yandex) | Wide-table analytical patterns |

## Execution Engines

### DataFusion Direct

Runs queries through DataFusion via the Apiary Python bindings, bypassing the full Apiary stack. Useful for measuring raw query engine performance.

```bash
python bench_runner.py --suite ssb --data-dir ./data/ssb/sf1/parquet --output ./results
```

### Apiary Docker

Runs the full Apiary stack in Docker containers with optional resource constraints matched to specific hardware profiles (see [Pi Deploy Profiles](/docs/how-to/deploy-pi-profiles)).

```bash
python bench_runner.py --suite ssb --engine apiary-docker --image apiary:latest --profile pi4-4gb
```

Multi-node execution:

```bash
python bench_runner.py --suite ssb --engine apiary-docker --image apiary:latest --nodes 3
```

## Execution Protocol

Each benchmark run follows this protocol:

| Parameter | Value |
|-----------|-------|
| Runs per query | 3 |
| Warmup runs | 1 (discarded) |
| Reported metric | Median of 3 runs |
| Timeout per query | 600 seconds |
| Metrics collected | Wall-clock ms, peak RSS, rows/sec, bytes/sec, partitions pruned |

## Running Benchmarks

### Setup

```bash
cd benchmarks
pip install -r requirements.txt
```

### Generate Test Data

```bash
# Generate SSB data at scale factor 1 (~1 GB)
python generate_datasets.py --scale-factor 1 --output ./data

# Generate TPC-H data at scale factor 1
python generate_datasets.py --suite tpc-h --scale-factor 1 --output ./data
```

### Run Locally (DataFusion Direct)

```bash
python bench_runner.py --suite ssb --data-dir ./data/ssb/sf1/parquet --output ./results
```

### Run with Docker (Full Stack)

```bash
# Build the Apiary image first
docker build -t apiary:latest ..

# Single node
python bench_runner.py --suite ssb --engine apiary-docker --image apiary:latest --output ./results

# Multi-node (3 nodes)
python bench_runner.py --suite ssb --engine apiary-docker --image apiary:latest --nodes 3 --output ./results

# With hardware profile constraints
python bench_runner.py --suite ssb --engine apiary-docker --image apiary:latest --profile pi4-4gb --output ./results
```

### Generate Reports

```bash
python ../scripts/generate_benchmark_report.py --input ./results --output ./results/report.html
```

## Results Format

Benchmark results are written as JSON files in the output directory. Each result includes:

```json
{
  "suite": "ssb",
  "query": "q1.1",
  "engine": "datafusion",
  "scale_factor": 1,
  "runs": [
    {"wall_clock_ms": 142, "peak_rss_bytes": 52428800, "rows": 100}
  ],
  "median_ms": 142,
  "system_info": {
    "cpu": "...",
    "cores": 4,
    "memory_gb": 3.7,
    "os": "Linux",
    "arch": "aarch64"
  }
}
```

## Hardware Profiles

The benchmark framework supports Docker Compose profiles that constrain resources to match specific Raspberry Pi models. See [Pi Deploy Profiles](/docs/how-to/deploy-pi-profiles) for the full comparison table.
