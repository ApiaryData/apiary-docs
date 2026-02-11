---
title: Deploy on Raspberry Pi
sidebar_position: 3
description: "How to deploy Apiary on a Raspberry Pi for edge data processing."
---

# Deploy on Raspberry Pi

## Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Model | Raspberry Pi 3B+ | Raspberry Pi 4 (4 GB+) |
| Storage | 16 GB SD card | 64 GB+ SD card or USB SSD |
| Network | Ethernet or Wi-Fi | Ethernet (for multi-node) |
| OS | Raspberry Pi OS 64-bit | Raspberry Pi OS 64-bit (Bookworm) |

:::tip
Use a USB SSD instead of an SD card for the local cell cache. SD cards have limited write endurance and slower random I/O.
:::

## OS Setup

```bash
# Update the system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
  build-essential \
  python3-dev \
  python3-pip \
  python3-venv \
  pkg-config \
  libssl-dev \
  git

# Set up a Python virtual environment
python3 -m venv ~/apiary-env
source ~/apiary-env/bin/activate
```

## Install Rust and Build

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Clone and build
git clone https://github.com/ApiaryData/apiary.git
cd apiary
cargo build --workspace --release

# Install Python package
pip install maturin
maturin develop --release
```

## Configure Solo Mode

For a single Pi with local storage:

```python
from apiary import Apiary

ap = Apiary("edge_data")
ap.start()

print(ap.status())
# {"node_id": "...", "cores": 4, "memory_gb": 3.7, "state": "running"}
```

Data is stored at `~/.apiary/edge_data/`.

## Configure Multi-Node with MinIO

For multiple Pis sharing data through MinIO:

```bash
# On the MinIO server (can be one of the Pis or a separate machine)
docker run -d --name minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=apiary \
  -e MINIO_ROOT_PASSWORD=apiary123 \
  minio/minio server /data --console-address ":9001"

# Create the bucket
docker exec minio mc alias set local http://localhost:9000 apiary apiary123
docker exec minio mc mb local/apiary-data
```

On each Pi:

```bash
export AWS_ACCESS_KEY_ID=apiary
export AWS_SECRET_ACCESS_KEY=apiary123
export AWS_ENDPOINT_URL=http://minio-host:9000
```

```python
from apiary import Apiary

ap = Apiary("production", storage="s3://apiary-data/prod")
ap.start()

# Check that nodes see each other
swarm = ap.swarm_status()
print(f"Nodes alive: {swarm['alive']}")
```

## Run as a Systemd Service

Create the service file:

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
Environment=PATH=/home/pi/.cargo/bin:/home/pi/apiary-env/bin:/usr/bin
Environment=AWS_ACCESS_KEY_ID=apiary
Environment=AWS_SECRET_ACCESS_KEY=apiary123
Environment=AWS_ENDPOINT_URL=http://minio-host:9000
ExecStart=/home/pi/apiary-env/bin/python -c "from apiary import Apiary; ap = Apiary('production', storage='s3://apiary-data/prod'); ap.start(); import signal; signal.pause()"
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable apiary
sudo systemctl start apiary
sudo systemctl status apiary
```

## Performance Tuning

### Use a USB SSD for Cache

Mount a USB SSD and configure it as the cache directory:

```bash
# Mount the SSD
sudo mkdir -p /mnt/ssd
sudo mount /dev/sda1 /mnt/ssd
sudo chown pi:pi /mnt/ssd

# Add to /etc/fstab for persistence
echo '/dev/sda1 /mnt/ssd ext4 defaults,noatime 0 2' | sudo tee -a /etc/fstab
```

### Increase Swap (if needed)

The default 100 MB swap is too small for compilation. Increase it for builds:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=100/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### Disable Unnecessary Services

```bash
sudo systemctl disable bluetooth
sudo systemctl disable avahi-daemon
```

## Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| Build fails with OOM | Not enough RAM for Rust compilation | Increase swap to 2 GB, use `--jobs 1` flag |
| Slow queries | SD card I/O bottleneck | Use USB SSD for cell cache |
| Node not joining swarm | Wrong S3 credentials or endpoint | Check `AWS_*` environment variables |
| High temperature readings | Too many concurrent queries | Reduce concurrent writes, check `colony_status()` |
| Heartbeat timeout | Network instability | Check network connectivity to MinIO/S3 |

## Security Hardening

For production deployments:

```bash
# Enable firewall
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw enable

# Use non-default SSH port
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Disable password authentication
# (ensure SSH keys are set up first)
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
```
