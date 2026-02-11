---
title: "Sensor Data Pipeline"
sidebar_position: 2
description: "Build a temperature monitoring pipeline with partitioning, aggregations, and partition pruning."
---

# Sensor Data Pipeline

In this tutorial, you will build a realistic data pipeline: a temperature monitoring system for rooms in a building. You will learn how partitioning works, how to use aggregation queries, and how Apiary prunes unnecessary data.

**What you will learn:**
- How partitioning affects data storage and query performance
- How to write multiple batches of data over time
- How to use GROUP BY with aggregate functions
- How DESCRIBE and SHOW commands help you inspect data
- How partition pruning skips irrelevant data

**Prerequisites:**
- Completed [Your First Apiary](/docs/tutorials/your-first-apiary)
- Apiary installed and working

---

## Step 1: Set Up the Schema

Create a namespace for sensor data, partitioned by room:

```python
from apiary import Apiary
import pyarrow as pa

ap = Apiary("sensor_tutorial")
ap.start()

# Create the namespace
ap.create_hive("building")
ap.create_box("building", "sensors")
ap.create_frame("building", "sensors", "temperature", {
    "timestamp": "timestamp",
    "room": "utf8",
    "temp_celsius": "float64",
    "humidity": "float64",
}, partition_by=["room"])
```

The `partition_by=["room"]` means Apiary will store data for each room in a separate directory. Queries that filter by room will only read the relevant partition.

## Step 2: Generate Sample Data

Create a helper function that simulates sensor readings:

```python
import random
from datetime import datetime, timedelta

def generate_readings(start_time, rooms, readings_per_room):
    """Generate simulated temperature and humidity readings."""
    timestamps = []
    room_list = []
    temps = []
    humidities = []

    for room in rooms:
        # Each room has a base temperature
        base_temp = {"kitchen": 22.0, "bedroom": 19.0, "office": 21.0, "garage": 15.0}[room]
        base_humidity = {"kitchen": 65.0, "bedroom": 50.0, "office": 45.0, "garage": 55.0}[room]

        for i in range(readings_per_room):
            timestamps.append(start_time + timedelta(minutes=i * 5))
            room_list.append(room)
            temps.append(round(base_temp + random.uniform(-3, 3), 1))
            humidities.append(round(base_humidity + random.uniform(-10, 10), 1))

    return pa.table({
        "timestamp": timestamps,
        "room": room_list,
        "temp_celsius": temps,
        "humidity": humidities,
    })

rooms = ["kitchen", "bedroom", "office", "garage"]
```

## Step 3: Write Multiple Batches

Simulate data arriving over time by writing three batches:

```python
def write_batch(ap, table):
    """Serialize and write a PyArrow table to Apiary."""
    sink = pa.BufferOutputStream()
    writer = pa.ipc.new_stream_writer(sink, table.schema)
    writer.write_table(table)
    writer.close()
    return ap.write_to_frame("building", "sensors", "temperature", sink.getvalue().to_pybytes())

# Morning readings
morning = generate_readings(datetime(2026, 2, 10, 8, 0), rooms, 12)
result = write_batch(ap, morning)
print(f"Morning: {result['rows_written']} rows, {result['cells_written']} cells")

# Afternoon readings
afternoon = generate_readings(datetime(2026, 2, 10, 13, 0), rooms, 12)
result = write_batch(ap, afternoon)
print(f"Afternoon: {result['rows_written']} rows, {result['cells_written']} cells")

# Evening readings
evening = generate_readings(datetime(2026, 2, 10, 18, 0), rooms, 12)
result = write_batch(ap, evening)
print(f"Evening: {result['rows_written']} rows, {result['cells_written']} cells")
```

Each batch writes 4 cells (one per room partition). After three batches, the frame has 12 cells total.

## Step 4: Inspect the Data

Use DESCRIBE to see the frame's current state:

```python
result_bytes = ap.sql("DESCRIBE building.sensors.temperature")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

This shows the schema, which columns are partitions, and statistics about the stored data.

Use SHOW and frame metadata:

```python
# Frame metadata
info = ap.get_frame("building", "sensors", "temperature")
print(f"Cell count: {info['cell_count']}")
print(f"Row count: {info['row_count']}")
print(f"Total bytes: {info['total_bytes']}")
```

## Step 5: Aggregation Queries

Find the average temperature and humidity per room:

```python
result_bytes = ap.sql("""
    SELECT
        room,
        ROUND(AVG(temp_celsius), 1) AS avg_temp,
        ROUND(MIN(temp_celsius), 1) AS min_temp,
        ROUND(MAX(temp_celsius), 1) AS max_temp,
        ROUND(AVG(humidity), 1) AS avg_humidity
    FROM building.sensors.temperature
    GROUP BY room
    ORDER BY avg_temp DESC
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

Count readings per room:

```python
result_bytes = ap.sql("""
    SELECT room, COUNT(*) AS reading_count
    FROM building.sensors.temperature
    GROUP BY room
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

## Step 6: Partition Pruning in Action

When you filter by the partition column (`room`), Apiary skips partitions entirely:

```python
# This only reads cells from the kitchen partition
# The bedroom, office, and garage cells are never touched
result_bytes = ap.sql("""
    SELECT timestamp, temp_celsius, humidity
    FROM building.sensors.temperature
    WHERE room = 'kitchen'
    ORDER BY timestamp
""")
reader = pa.ipc.open_stream(result_bytes)
df = reader.read_all().to_pandas()
print(f"Kitchen readings: {len(df)} rows")
print(df.head(10))
```

Use EXPLAIN to see the pruning:

```python
result_bytes = ap.sql("""
    EXPLAIN SELECT * FROM building.sensors.temperature WHERE room = 'kitchen'
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

The plan shows that only cells in the `room=kitchen` partition are scanned.

## Step 7: Combine Filters

Partition pruning combined with cell statistics skips even more data:

```python
# Only reads kitchen cells where temp might exceed 23
result_bytes = ap.sql("""
    SELECT timestamp, temp_celsius
    FROM building.sensors.temperature
    WHERE room = 'kitchen' AND temp_celsius > 23.0
    ORDER BY temp_celsius DESC
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

## Step 8: Clean Up

```python
ap.shutdown()
print("Tutorial complete!")
```

## What You Learned

- **Partitioning** stores data by column value, enabling efficient queries on that column
- **Multiple writes** create additional cells within each partition
- **Aggregation queries** (AVG, MIN, MAX, COUNT) work with GROUP BY
- **DESCRIBE** shows frame schema, partition columns, and statistics
- **Partition pruning** skips entire directories of data that don't match the WHERE clause
- **Cell statistics** enable further pruning within a partition based on min/max values

## Next Steps

- [Multi-Node Swarm](/docs/tutorials/multi-node-swarm) -- Distribute queries across multiple nodes
- [Configuration Reference](/docs/reference/configuration) -- Tune cell sizing, cache, and thresholds
- [Storage Engine](/docs/explanation/storage-engine) -- Understand how cells and partitions work at a deeper level
