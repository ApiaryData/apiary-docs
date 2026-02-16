---
title: Install on Windows
sidebar_position: 2
description: "How to install and run Apiary on Windows."
---

# Install on Windows

## Pre-built Binary (Recommended)

Install Apiary using the PowerShell one-liner:

```powershell
irm https://raw.githubusercontent.com/ApiaryData/apiary/main/scripts/install.ps1 | iex
```

This downloads a pre-built binary from GitHub Releases and installs it to `$env:USERPROFILE\.apiary\bin`. The install directory is automatically added to your user PATH.

### Customization

```powershell
# Specific version
$env:APIARY_VERSION = "0.1.0"
irm https://raw.githubusercontent.com/ApiaryData/apiary/main/scripts/install.ps1 | iex

# Custom install directory
$env:INSTALL_DIR = "C:\tools\apiary"
irm https://raw.githubusercontent.com/ApiaryData/apiary/main/scripts/install.ps1 | iex
```

:::note
Only 64-bit Windows (x86_64) is supported. ARM-based Windows is not supported.
:::

## Build from Source

### Prerequisites

- **Rust (stable)** -- Install from [rustup.rs](https://rustup.rs/)
- **Python 3.9+** -- Install from [python.org](https://www.python.org/downloads/) or the Microsoft Store
- **Visual Studio Build Tools** -- Install from [Visual Studio downloads](https://visualstudio.microsoft.com/downloads/) (select "Desktop development with C++")
- **maturin** -- `pip install maturin`

### Steps

```powershell
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

## Running Apiary on Windows

### Solo Mode (Local Storage)

```python
from apiary import Apiary

ap = Apiary("my_project")
ap.start()

# Data is stored at %USERPROFILE%\.apiary\data\my_project\
print(ap.status())
```

### With MinIO (Docker Desktop)

You can run MinIO via Docker Desktop for Windows:

```powershell
docker run -d --name minio -p 9000:9000 -p 9001:9001 `
  -e MINIO_ROOT_USER=minioadmin `
  -e MINIO_ROOT_PASSWORD=minioadmin `
  minio/minio server /data --console-address ":9001"
```

Create a bucket and connect:

```python
import os
os.environ["AWS_ACCESS_KEY_ID"] = "minioadmin"
os.environ["AWS_SECRET_ACCESS_KEY"] = "minioadmin"
os.environ["AWS_ENDPOINT_URL"] = "http://localhost:9000"

from apiary import Apiary
ap = Apiary("production", storage="s3://apiary/data")
ap.start()
```

## Known Limitations

- **ARM Windows not supported.** Only x86_64 Windows binaries are built.
- **Benchmark cache clearing.** The benchmark framework's OS cache clearing (`/proc/sys/vm/drop_caches`) is Linux-only and silently skips on Windows.
- **Hardware detection.** Raspberry Pi model detection via `/proc/device-tree/model` is Linux-only. On Windows, generic hardware detection is used.
- **Systemd service.** The [systemd service guide](/docs/how-to/run-as-systemd-service) is Linux-only. On Windows, use Task Scheduler or run as a Windows Service with [NSSM](https://nssm.cc/).

## Docker on Windows

If you prefer running Apiary in Docker (which uses Linux containers), follow the [Deploy with Docker](/docs/how-to/deploy-docker) guide. Docker Desktop for Windows runs Linux containers through WSL 2.
