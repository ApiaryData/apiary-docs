---
title: Write and Query Data
sidebar_position: 2
description: "How to create namespaces, write data, and query with SQL."
---

# Write and Query Data

## Create the Namespace

Before writing data, create the namespace hierarchy: hive, box, and frame.

```python
from apiary import Apiary

ap = Apiary("my_project")
ap.start()

# Create namespace
ap.create_hive("warehouse")
ap.create_box("warehouse", "sales")
ap.create_frame("warehouse", "sales", "orders", {
    "order_id": "int64",
    "customer": "utf8",
    "amount": "float64",
    "region": "utf8",
}, partition_by=["region"])
```

## Write Data

Data is written as Arrow IPC bytes. Use PyArrow to create tables and serialize them:

```python
import pyarrow as pa

table = pa.table({
    "order_id": [1, 2, 3, 4, 5],
    "customer": ["alice", "bob", "alice", "charlie", "bob"],
    "amount": [100.0, 250.0, 75.0, 300.0, 150.0],
    "region": ["us", "eu", "us", "eu", "us"],
})

# Serialize to Arrow IPC
sink = pa.BufferOutputStream()
writer = pa.ipc.new_stream_writer(sink, table.schema)
writer.write_table(table)
writer.close()

# Write to Apiary
result = ap.write_to_frame("warehouse", "sales", "orders", sink.getvalue().to_pybytes())
print(result)  # {"cells_written": 2, "rows_written": 5}
```

## Query with SQL

```python
import pyarrow as pa

# Simple query
result_bytes = ap.sql("SELECT * FROM warehouse.sales.orders LIMIT 10")
reader = pa.ipc.open_stream(result_bytes)
table = reader.read_all()
print(table.to_pandas())
```

### Use Context to Shorten Table Names

```python
ap.sql("USE HIVE warehouse")
ap.sql("USE BOX sales")
result = ap.sql("SELECT * FROM orders LIMIT 10")
```

### Aggregations

```python
result_bytes = ap.sql("""
    SELECT customer, COUNT(*) AS order_count, SUM(amount) AS total
    FROM warehouse.sales.orders
    GROUP BY customer
    ORDER BY total DESC
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

### Filter with WHERE

```python
# Partition pruning: only reads cells in region=us
result_bytes = ap.sql("SELECT * FROM warehouse.sales.orders WHERE region = 'us'")
```

## Read Data via SDK

For programmatic access without SQL:

```python
# Read all data
data = ap.read_from_frame("warehouse", "sales", "orders")
reader = pa.ipc.open_stream(data)
table = reader.read_all()

# Read with partition filter
data = ap.read_from_frame("warehouse", "sales", "orders", partition_filter={"region": "us"})
```

## Overwrite Data

Replace all data in a frame atomically:

```python
new_table = pa.table({
    "order_id": [10, 11],
    "customer": ["dave", "eve"],
    "amount": [500.0, 600.0],
    "region": ["us", "eu"],
})

sink = pa.BufferOutputStream()
writer = pa.ipc.new_stream_writer(sink, new_table.schema)
writer.write_table(new_table)
writer.close()

result = ap.overwrite_frame("warehouse", "sales", "orders", sink.getvalue().to_pybytes())
```

## Inspect the Namespace

```python
# List what exists
ap.list_hives()                        # ["warehouse"]
ap.list_boxes("warehouse")             # ["sales"]
ap.list_frames("warehouse", "sales")   # ["orders"]

# Get frame metadata
info = ap.get_frame("warehouse", "sales", "orders")
print(info)  # schema, partition_by, cell_count, row_count, total_bytes

# Via SQL
ap.sql("SHOW HIVES")
ap.sql("SHOW BOXES IN warehouse")
ap.sql("SHOW FRAMES IN warehouse.sales")
ap.sql("DESCRIBE warehouse.sales.orders")
```

## Clean Up

```python
ap.shutdown()
```
