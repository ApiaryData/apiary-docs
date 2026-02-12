---
title: Deploy on Kubernetes
sidebar_position: 5
description: "How to deploy Apiary on Kubernetes with S3-compatible storage."
---

# Deploy on Kubernetes

## Prerequisites

- A Kubernetes cluster (any provider)
- `kubectl` configured for your cluster
- An S3-compatible storage endpoint (AWS S3, MinIO, GCS)
- The Apiary Docker image pushed to a container registry

## Namespace and ConfigMap

```yaml
# apiary-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: apiary
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: apiary-config
  namespace: apiary
data:
  APIARY_STORAGE: "s3://apiary-data/prod"
  AWS_REGION: "us-east-1"
  RUST_LOG: "info"
```

## Secrets

```yaml
# apiary-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: apiary-credentials
  namespace: apiary
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: "your-access-key"
  AWS_SECRET_ACCESS_KEY: "your-secret-key"
  AWS_ENDPOINT_URL: "https://s3.amazonaws.com"  # or your MinIO endpoint
```

## Deployment

```yaml
# apiary-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apiary
  namespace: apiary
spec:
  replicas: 3
  selector:
    matchLabels:
      app: apiary
  template:
    metadata:
      labels:
        app: apiary
    spec:
      containers:
        - name: apiary
          image: your-registry/apiary:latest
          envFrom:
            - configMapRef:
                name: apiary-config
            - secretRef:
                name: apiary-credentials
          resources:
            requests:
              cpu: "2"
              memory: "4Gi"
            limits:
              cpu: "4"
              memory: "8Gi"
          volumeMounts:
            - name: cache
              mountPath: /cache
      volumes:
        - name: cache
          emptyDir:
            sizeLimit: 10Gi
```

## Deploy

```bash
kubectl apply -f apiary-namespace.yaml
kubectl apply -f apiary-secrets.yaml
kubectl apply -f apiary-deployment.yaml
```

## Scale

```bash
# Scale to 5 replicas
kubectl scale deployment apiary -n apiary --replicas=5
```

Nodes discover each other automatically through the shared S3 bucket. No additional service discovery or mesh configuration is needed.

## Optional: MinIO in Kubernetes

If you prefer self-hosted S3-compatible storage within the cluster:

```yaml
# minio-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: apiary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
        - name: minio
          image: minio/minio
          args: ["server", "/data", "--console-address", ":9001"]
          env:
            - name: MINIO_ROOT_USER
              value: "apiary"
            - name: MINIO_ROOT_PASSWORD
              value: "apiary123"
          ports:
            - containerPort: 9000
            - containerPort: 9001
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: minio-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: apiary
spec:
  selector:
    app: minio
  ports:
    - name: api
      port: 9000
    - name: console
      port: 9001
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-pvc
  namespace: apiary
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 100Gi
```

Update `apiary-secrets.yaml` to point to the in-cluster MinIO:

```yaml
stringData:
  AWS_ACCESS_KEY_ID: "apiary"
  AWS_SECRET_ACCESS_KEY: "apiary123"
  AWS_ENDPOINT_URL: "http://minio.apiary.svc.cluster.local:9000"
```

## Cloud-Specific Notes

### AWS ECS

Use the same Docker image with ECS task definitions. Set S3 credentials via IAM task roles instead of environment variables.

### Azure Container Apps

Use Azure Blob Storage with the S3-compatible endpoint, or GCS-compatible storage URIs.

### Google Cloud Run

Use GCS as the storage backend via its S3-compatible endpoint. Set `AWS_ENDPOINT_URL=https://storage.googleapis.com` and use GCS HMAC credentials with `s3://` URIs. See [Configure Storage Backends](/docs/how-to/configure-storage-backends#google-cloud-storage-via-s3-compatibility) for details.

## Verify

```bash
# Check pods are running
kubectl get pods -n apiary

# Check logs
kubectl logs -n apiary deployment/apiary
```
