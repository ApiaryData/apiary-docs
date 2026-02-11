---
title: "Your First Apiary"
sidebar_position: 1
description: "A step-by-step tutorial to install Apiary, create data, and run your first SQL query."
---

# Your First Apiary

In this tutorial, you will install Apiary, create a namespace, write data, and query it with SQL. By the end, you will have a working local Apiary instance with data you can explore.

**What you will learn:**
- How to install Apiary from source
- How to create hives, boxes, and frames (Apiary's namespace hierarchy)
- How to write data using PyArrow
- How to query data with SQL
- How to check node status

**Prerequisites:**
- Rust 1.75+ ([install from rustup.rs](https://rustup.rs/))
- Python 3.9+
- pip

**Time:** About 10 minutes (excluding build time).

---

## Step 1: Install Apiary

Clone the repository and build:

```bash
git clone https://github.com/ApiaryData/apiary.git
cd apiary

# Build the Rust workspace
cargo build --workspace

# Install the Python build tool and package
pip install maturin
maturin develop
```

Verify the installation:

```python
python -c "from apiary import Apiary; print('Apiary installed successfully')"
```

## Step 2: Create an Apiary Instance

Open a Python interpreter or create a new `.py` file:

```python
from apiary import Apiary

# Create a local Apiary instance
ap = Apiary("my_first_apiary")
ap.start()

# Check what we're working with
status = ap.status()
print(f"Node ID: {status['node_id']}")
print(f"Cores: {status['cores']}")
print(f"Memory: {status['memory_gb']:.1f} GB")
print(f"State: {status['state']}")
```

This creates a local Apiary instance. Data is stored at `~/.apiary/my_first_apiary/` on your filesystem.

## Step 3: Create the Namespace

Apiary organizes data in a three-level hierarchy: **Hive** (database) > **Box** (schema) > **Frame** (table). Create one of each:

```python
# Create a hive (like a database)
ap.create_hive("shop")

# Create a box inside the hive (like a schema)
ap.create_box("shop", "inventory")

# Create a frame inside the box (like a table)
# Define the schema and an optional partition column
ap.create_frame("shop", "inventory", "products", {
    "product_id": "int64",
    "name": "utf8",
    "price": "float64",
    "category": "utf8",
}, partition_by=["category"])
```

Verify the namespace:

```python
print(ap.list_hives())                          # ["shop"]
print(ap.list_boxes("shop"))                    # ["inventory"]
print(ap.list_frames("shop", "inventory"))      # ["products"]
```

## Step 4: Write Data

Apiary accepts data as Arrow IPC bytes. Use PyArrow to create a table and serialize it:

```python
import pyarrow as pa

# Create sample data
table = pa.table({
    "product_id": [1, 2, 3, 4, 5, 6],
    "name": ["Laptop", "Mouse", "Keyboard", "Monitor", "Headphones", "Webcam"],
    "price": [999.99, 29.99, 79.99, 449.99, 149.99, 69.99],
    "category": ["electronics", "accessories", "accessories", "electronics", "accessories", "electronics"],
})

# Serialize to Arrow IPC format
sink = pa.BufferOutputStream()
writer = pa.ipc.new_stream_writer(sink, table.schema)
writer.write_table(table)
writer.close()

# Write to the frame
result = ap.write_to_frame("shop", "inventory", "products", sink.getvalue().to_pybytes())
print(f"Cells written: {result['cells_written']}")
print(f"Rows written: {result['rows_written']}")
```

Notice that `cells_written` is 2, not 1. Apiary partitioned the data by the `category` column, creating one cell (Parquet file) for `electronics` and one for `accessories`.

## Step 5: Query with SQL

Now query the data using SQL:

```python
import pyarrow as pa

# Simple SELECT
result_bytes = ap.sql("SELECT * FROM shop.inventory.products ORDER BY price DESC")
reader = pa.ipc.open_stream(result_bytes)
table = reader.read_all()
print(table.to_pandas())
```

Try an aggregation:

```python
# Average price by category
result_bytes = ap.sql("""
    SELECT category, COUNT(*) AS count, AVG(price) AS avg_price
    FROM shop.inventory.products
    GROUP BY category
    ORDER BY avg_price DESC
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

Try filtering -- this uses partition pruning, reading only the `electronics` cells:

```python
result_bytes = ap.sql("""
    SELECT name, price
    FROM shop.inventory.products
    WHERE category = 'electronics'
    ORDER BY price DESC
""")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

## Step 6: Use Custom SQL Commands

Apiary adds custom commands on top of standard SQL:

```python
# Set context to avoid repeating hive.box.frame
ap.sql("USE HIVE shop")
ap.sql("USE BOX inventory")

# Now you can use short names
result_bytes = ap.sql("SELECT * FROM products LIMIT 3")

# Inspect the namespace
ap.sql("SHOW HIVES")
ap.sql("SHOW BOXES IN shop")
ap.sql("SHOW FRAMES IN shop.inventory")

# Describe a frame's schema
result_bytes = ap.sql("DESCRIBE shop.inventory.products")
reader = pa.ipc.open_stream(result_bytes)
print(reader.read_all().to_pandas())
```

## Step 7: Check Status and Shut Down

```python
# See per-bee (per-core) status
bees = ap.bee_status()
for bee in bees:
    print(f"Bee {bee['bee_id']}: {bee['state']}")

# Check colony health
colony = ap.colony_status()
print(f"Temperature: {colony['temperature']:.2f} ({colony['regulation']})")

# Clean shutdown
ap.shutdown()
print("Done!")
```

## What You Learned

- Apiary uses a three-level namespace: **Hive** > **Box** > **Frame**
- Data is written as Arrow IPC bytes and stored as Parquet files
- SQL queries run via Apache DataFusion with automatic partition pruning
- Each CPU core is a "bee" with its own memory budget
- Colony temperature tracks overall system health

## Next Steps

- [Sensor Data Pipeline](/docs/tutorials/sensor-data-pipeline) -- Build a more realistic data pipeline with partitioning and aggregations
- [Multi-Node Swarm](/docs/tutorials/multi-node-swarm) -- Set up a distributed cluster with Docker Compose
- [Python SDK Reference](/docs/reference/python-sdk) -- Full API documentation
- [SQL Reference](/docs/reference/sql-reference) -- Complete SQL syntax
