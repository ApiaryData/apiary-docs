---
title: Configure Storage Backends
sidebar_position: 7
description: "How to configure local filesystem, MinIO, AWS S3, and GCS (via S3 compatibility) storage backends."
---

# Configure Storage Backends

## Local Filesystem (Default)

When no storage URI is provided, Apiary uses the local filesystem:

```python
from apiary import Apiary

ap = Apiary("my_project")  # Stores data at ~/.apiary/my_project/
```

This is suitable for solo mode on a single machine. Data lives at `~/.apiary/{name}/`.

## MinIO (Self-Hosted S3)

### Start MinIO

```bash
docker run -d --name minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=apiary \
  -e MINIO_ROOT_PASSWORD=apiary123 \
  -v minio-data:/data \
  minio/minio server /data --console-address ":9001"
```

### Create a Bucket

```bash
# Using the MinIO client
docker exec -it minio mc alias set local http://localhost:9000 apiary apiary123
docker exec -it minio mc mb local/apiary-data
```

Or use the MinIO Console at `http://localhost:9001`.

### Connect Apiary

```bash
export AWS_ACCESS_KEY_ID=apiary
export AWS_SECRET_ACCESS_KEY=apiary123
export AWS_ENDPOINT_URL=http://localhost:9000
```

```python
from apiary import Apiary

ap = Apiary("production", storage="s3://apiary-data/prod")
ap.start()
```

## AWS S3

### Create a Bucket

```bash
aws s3 mb s3://my-apiary-bucket --region us-east-1
```

### Configure Credentials

Option 1: Environment variables

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

Option 2: AWS credentials file (`~/.aws/credentials`)

```ini
[default]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
region = us-east-1
```

Option 3: IAM role (for EC2 instances or ECS tasks) -- no explicit credentials needed.

### Connect Apiary

```python
from apiary import Apiary

ap = Apiary("production", storage="s3://my-apiary-bucket/apiary")
ap.start()
```

### With a Specific Region

```python
ap = Apiary("production", storage="s3://my-apiary-bucket/apiary?region=eu-west-1")
```

## Google Cloud Storage (via S3 Compatibility)

Apiary does not natively support `gs://` URIs. However, GCS provides an [S3-compatible endpoint](https://cloud.google.com/storage/docs/interoperability) that works with Apiary's S3 backend.

### Create a Bucket

```bash
gsutil mb gs://my-apiary-bucket
```

### Generate HMAC Keys

Create S3-compatible HMAC credentials for your GCS bucket:

```bash
gsutil hmac create your-service-account@project.iam.gserviceaccount.com
```

This returns an access key and secret key.

### Configure Credentials

```bash
export AWS_ACCESS_KEY_ID=GOOG...        # HMAC access key
export AWS_SECRET_ACCESS_KEY=...         # HMAC secret key
export AWS_ENDPOINT_URL=https://storage.googleapis.com
```

### Connect Apiary

```python
from apiary import Apiary

ap = Apiary("production", storage="s3://my-apiary-bucket/apiary")
ap.start()
```

Note the `s3://` URI scheme -- this routes through the S3-compatible endpoint.

## Verify the Storage Backend

After connecting, verify with:

```python
ap.start()
print(ap.status())  # Confirms node started successfully

# Create test data
ap.create_hive("test")
print(ap.list_hives())  # ["test"]
```

## Storage Backend Comparison

| Backend | Best For | Latency | Durability | Multi-Node |
|---------|----------|---------|------------|------------|
| Local filesystem | Development, solo mode | < 1 ms | Depends on disk | No |
| MinIO | Self-hosted multi-node | 5-20 ms (LAN) | Depends on config | Yes |
| AWS S3 | Cloud production | 20-200 ms | 99.999999999% | Yes |
| GCS (via S3 compat) | Google Cloud production | 20-200 ms | 99.999999999% | Yes |
