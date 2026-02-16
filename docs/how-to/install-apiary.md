---
title: Install Apiary
sidebar_position: 1
description: "How to install Apiary on Linux, macOS, or Raspberry Pi."
---

# Install Apiary

## Pre-built Binaries (Recommended)

The fastest way to install Apiary on Linux or macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/ApiaryData/apiary/main/scripts/install.sh | bash
```

This downloads a pre-built binary from GitHub Releases, detects your platform (x86_64 or ARM64), and installs to `/usr/local/bin`.

You can customize the install:

```bash
# Specific version
APIARY_VERSION=0.1.0 curl -fsSL https://raw.githubusercontent.com/ApiaryData/apiary/main/scripts/install.sh | bash

# Custom install directory
INSTALL_DIR=~/.local/bin curl -fsSL https://raw.githubusercontent.com/ApiaryData/apiary/main/scripts/install.sh | bash
```

For Windows, see [Install on Windows](/docs/how-to/install-windows).

## Prerequisites (Building from Source)

- **Rust (stable)** -- Install from [rustup.rs](https://rustup.rs/)
- **Python 3.9+** -- System Python or a virtual environment
- **maturin** -- Python build tool for Rust extensions

## From Source (Linux / macOS)

```bash
# Clone the repository
git clone https://github.com/ApiaryData/apiary.git
cd apiary

# Build the Rust workspace
cargo build --workspace

# Install the Python build tool
pip install maturin

# Build and install the Python package
maturin develop
```

Verify the installation:

```python
from apiary import Apiary
ap = Apiary("test")
ap.start()
print(ap.status())
ap.shutdown()
```

## On Raspberry Pi

Raspberry Pi uses ARM64 architecture. Rust compiles natively on the Pi, but builds are slower than on x86.

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install system dependencies
sudo apt update
sudo apt install -y python3-dev python3-pip python3-venv pkg-config libssl-dev

# Clone and build
git clone https://github.com/ApiaryData/apiary.git
cd apiary

# Build (this takes 15-30 minutes on a Pi 4)
cargo build --workspace --release

# Install Python package
pip install maturin
maturin develop --release
```

:::tip
Use `--release` on Pi to get optimized binaries. Debug builds are significantly slower on ARM.
:::

## Cross-Compile for ARM64

Build on a faster x86 machine and deploy to the Pi:

```bash
# Add the ARM64 target
rustup target add aarch64-unknown-linux-gnu

# Install the cross-compilation linker
sudo apt install gcc-aarch64-linux-gnu

# Build for ARM64
cargo build --workspace --release --target aarch64-unknown-linux-gnu

# Copy the binary to the Pi
scp target/aarch64-unknown-linux-gnu/release/apiary-cli pi@raspberrypi.local:~/
```

For the Python package, build a wheel:

```bash
maturin build --release --target aarch64-unknown-linux-gnu
# Copy the .whl file to the Pi and install with pip
```

## Verify Installation

```bash
# Check Rust build
cargo test --workspace

# Check Python package
python -c "from apiary import Apiary; print('OK')"
```
