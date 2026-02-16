---
title: SQL Reference
sidebar_position: 2
description: "SQL syntax reference for Apiary's DataFusion-based query engine."
---

# SQL Reference

Apiary uses [Apache DataFusion](https://datafusion.apache.org/) as its SQL engine. Queries run over Parquet cells with automatic pruning and projection pushdown.

## Supported Features

| Feature | Status | Notes |
|---------|--------|-------|
| SELECT | Supported | Full expression support |
| WHERE | Supported | Triggers cell and partition pruning |
| GROUP BY | Supported | With COUNT, SUM, AVG, MIN, MAX |
| HAVING | Supported | Filter on aggregate results |
| ORDER BY | Supported | ASC/DESC |
| LIMIT | Supported | |
| JOIN | Supported | Single-node; distributed joins planned for v2 |
| INSERT | Blocked | Use `write_to_frame()` in the Python SDK |
| UPDATE | Blocked | Use `overwrite_frame()` in the Python SDK |
| DELETE | Blocked | Use `overwrite_frame()` in the Python SDK |
| CREATE TABLE | Blocked | Use `create_frame()` in the Python SDK |
| DROP TABLE | Not yet supported | Planned for future release |
| ALTER TABLE | Not yet supported | Planned for future release |

---

## Table References

Tables use a three-part name: `hive.box.frame`.

```sql
SELECT * FROM warehouse.sales.orders;
```

Set context with `USE` to shorten references:

```sql
USE HIVE warehouse;
USE BOX sales;
SELECT * FROM orders;
```

Two-part names also work after `USE HIVE`:

```sql
USE HIVE warehouse;
SELECT * FROM sales.orders;
```

---

## SELECT

Standard SQL SELECT with full expression support.

```sql
SELECT order_id, customer, amount
FROM warehouse.sales.orders
WHERE amount > 100
ORDER BY amount DESC
LIMIT 10;
```

### WHERE

```sql
SELECT * FROM warehouse.sales.orders
WHERE region = 'us' AND amount >= 50.0;
```

WHERE predicates on partition columns trigger **cell pruning** -- only matching Parquet files are read. See [Query Execution](/docs/explanation/query-execution) for details.

### GROUP BY and Aggregates

Supported aggregate functions: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`.

```sql
SELECT customer, COUNT(*) AS order_count, SUM(amount) AS total
FROM warehouse.sales.orders
GROUP BY customer;
```

```sql
SELECT region, AVG(amount) AS avg_amount
FROM warehouse.sales.orders
GROUP BY region
HAVING AVG(amount) > 100;
```

### ORDER BY

```sql
SELECT * FROM warehouse.sales.orders
ORDER BY amount DESC, customer ASC;
```

### LIMIT

```sql
SELECT * FROM warehouse.sales.orders
LIMIT 25;
```

### JOIN

```sql
SELECT o.order_id, o.amount, c.name
FROM warehouse.sales.orders o
JOIN warehouse.sales.customers c ON o.customer_id = c.id;
```

:::note
JOINs currently execute on a single node. Distributed join support is planned for v2.
:::

---

## Custom Commands

### USE HIVE

Set the current hive context. Subsequent queries can omit the hive prefix.

```sql
USE HIVE warehouse;
```

### USE BOX

Set the current box context. Requires a hive to be set first.

```sql
USE HIVE warehouse;
USE BOX sales;
```

### SHOW HIVES

List all hives in the apiary.

```sql
SHOW HIVES;
-- Returns: name
--          warehouse
--          analytics
```

### SHOW BOXES

List all boxes in a hive.

```sql
SHOW BOXES IN warehouse;
```

If a hive context is set with `USE HIVE`, you can omit `IN`:

```sql
USE HIVE warehouse;
SHOW BOXES;
```

### SHOW FRAMES

List all frames in a box.

```sql
SHOW FRAMES IN warehouse.sales;
```

If both hive and box context are set, you can omit `IN`:

```sql
USE HIVE warehouse;
USE BOX sales;
SHOW FRAMES;
```

### DESCRIBE

Show metadata for a frame including schema, partitions, cell count, row count, and size.

```sql
DESCRIBE warehouse.sales.orders;
-- Returns a property/value table:
-- property     | value
-- schema       | {"order_id": "int64", "customer": "utf8", ...}
-- partition_by | ["region"]
-- cells        | 3
-- total_rows   | 1500
-- total_bytes  | 24576
```

---

## Blocked Operations

These SQL statements are intentionally blocked and return clear error messages directing you to the Python SDK:

| Statement | Error Message | Alternative |
|-----------|---------------|-------------|
| `INSERT` | "Use `write_to_frame()` in the Python SDK" | [`write_to_frame()`](/docs/reference/python-sdk#write) |
| `UPDATE` | "Use `overwrite_frame()` in the Python SDK" | [`overwrite_frame()`](/docs/reference/python-sdk#overwrite) |
| `DELETE` | "Use `overwrite_frame()` to replace data" | [`overwrite_frame()`](/docs/reference/python-sdk#overwrite) |
| `CREATE TABLE` | "Use `create_frame()` in the Python SDK" | [`create_frame()`](/docs/reference/python-sdk#create) |
| `DROP TABLE` | "DROP is not supported via SQL. Use the registry API for DDL operations." | -- |
| `ALTER TABLE` | "ALTER is not supported via SQL. Use the registry API for DDL operations." | -- |

---

## Query Execution Pipeline

1. **Parse** -- DataFusion parses the SQL statement.
2. **Resolve** -- Table names are resolved to `hive.box.frame` using the current USE context.
3. **Prune** -- WHERE predicates and partition filters identify which cells to read.
4. **Plan** -- DataFusion builds a physical plan with projection pushdown.
5. **Execute** -- Bees process cells in sealed chambers with memory budgets.
6. **Return** -- Results are serialized as Arrow IPC bytes.

For distributed queries across multiple nodes, the coordinator assigns cells to workers based on cache locality and capacity. See [Query Execution](/docs/explanation/query-execution) for the full discussion.

---

## Examples

```sql
-- Top 5 customers by revenue
USE HIVE warehouse;
USE BOX sales;
SELECT customer, SUM(amount) AS revenue
FROM orders
GROUP BY customer
ORDER BY revenue DESC
LIMIT 5;

-- Count orders per region
SELECT region, COUNT(*) AS cnt
FROM warehouse.sales.orders
GROUP BY region;

-- Inspect a frame
DESCRIBE warehouse.sales.orders;

-- Browse the namespace
SHOW HIVES;
SHOW BOXES IN warehouse;
SHOW FRAMES IN warehouse.sales;
```
