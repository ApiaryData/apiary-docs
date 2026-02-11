---
title: Run as a Systemd Service
sidebar_position: 9
description: "How to run Apiary as a systemd service on Linux."
---

# Run as a Systemd Service

## Create the Service File

```bash
sudo tee /etc/systemd/system/apiary.service > /dev/null << 'EOF'
[Unit]
Description=Apiary Data Node
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi

# Adjust these paths to match your installation
Environment=PATH=/home/pi/.cargo/bin:/home/pi/apiary-env/bin:/usr/bin

# Storage credentials (adjust for your backend)
Environment=AWS_ACCESS_KEY_ID=apiary
Environment=AWS_SECRET_ACCESS_KEY=apiary123
Environment=AWS_ENDPOINT_URL=http://minio-host:9000

# Log level
Environment=RUST_LOG=info

ExecStart=/home/pi/apiary-env/bin/python -c "\
from apiary import Apiary; \
ap = Apiary('production', storage='s3://apiary-data/prod'); \
ap.start(); \
import signal; signal.pause()"

Restart=on-failure
RestartSec=10
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
```

## For Solo Mode (Local Storage)

If running without S3, remove the `AWS_*` environment variables and adjust the ExecStart:

```ini
ExecStart=/home/pi/apiary-env/bin/python -c "\
from apiary import Apiary; \
ap = Apiary('local_data'); \
ap.start(); \
import signal; signal.pause()"
```

## Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable apiary
sudo systemctl start apiary
```

## Manage the Service

```bash
# Check status
sudo systemctl status apiary

# View logs
journalctl -u apiary -f

# Stop
sudo systemctl stop apiary

# Restart
sudo systemctl restart apiary

# Disable auto-start
sudo systemctl disable apiary
```

## Use an Environment File

For cleaner credential management, use an environment file:

```bash
sudo tee /etc/apiary/env > /dev/null << 'EOF'
AWS_ACCESS_KEY_ID=apiary
AWS_SECRET_ACCESS_KEY=apiary123
AWS_ENDPOINT_URL=http://minio-host:9000
RUST_LOG=info
EOF

sudo chmod 600 /etc/apiary/env
```

Reference it in the service file:

```ini
[Service]
EnvironmentFile=/etc/apiary/env
```

## Verify After Reboot

```bash
sudo reboot

# After reboot, check the service started automatically
sudo systemctl status apiary
journalctl -u apiary --since "boot"
```
