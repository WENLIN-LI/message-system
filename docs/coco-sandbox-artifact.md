# Coco Sandbox Artifact

## Purpose

Message System runs the existing Coco coding assistant inside a file/process sandbox. The production sandbox must use a pinned artifact rather than the developer workstation path.

This artifact contains:

- the pinned Coco source checkout
- the `message-system_coco_runner` JSONL adapter
- hash-verified Python runtime dependencies installed into the image
- the startup command `python -m message-system_coco_runner`

## Locked Version

The current lock file is:

```text
ops/coco-sandbox/artifact.lock.json
```

Pinned values:

```text
artifactVersion: message-system-coco-2026-05-22-4f4ecc9
cocoSourceRef: 4f4ecc99589c68cffcb150b6a2df9f55144cc2d1
cocoPackageVersion: 0.1.3a0
runnerPackageVersion: 0.1.0
pythonVersion: 3.12
baseImage: python:3.12-slim-bookworm@sha256:c1b74bdacbd4903bcfbf73f5b8683478c83435cfa8e293068efaa102ecc56ea8
requirementsLock: ops/coco-sandbox/requirements.lock
```

## Build Context

Prepare a clean Docker/E2B build context from the pinned local Coco checkout:

```bash
node scripts/coco/prepare-sandbox-context.mjs --output /tmp/message-system-coco-sandbox-context
```

The script verifies that the Coco checkout is exactly at the pinned Coco commit before exporting it. By default it uses `/Users/sky/projects/coco`, but another checkout can be supplied with `--coco-repo <path>` or `COCO_LOCAL_PATH=<path>`.

The output directory is intentionally restricted to `/tmp` or `/private/tmp` unless `MESSAGE_SYSTEM_ALLOW_ARTIFACT_OUTPUT_OUTSIDE_TMP=true` is set. This prevents accidental recursive deletion of a project directory.

The context contains:

```text
Dockerfile
artifact.lock.json
BUILD-METADATA.json
requirements.lock
coco/
message-system_coco_runner/
```

Build the container image from that context:

```bash
docker build -t message-system-coco:message-system-coco-2026-05-22-4f4ecc9 /tmp/message-system-coco-sandbox-context
```

Publish that image as the E2B template named by `COCO_E2B_TEMPLATE_ID`.

The Dockerfile installs Python dependencies from `requirements.lock` with `--require-hashes`, then loads the pinned Coco and `message-system_coco_runner` source trees through `PYTHONPATH`. This avoids implicit build-isolation downloads for local source packages. The base image is pinned by digest and the container runs as the non-root `message-system` user.

## Production Config

Production E2B JSONL mode must use the pinned artifact and must not pass `COCO_SOURCE_DIR`:

```bash
COCO_ENABLED=true
COCO_SANDBOX_PROVIDER=e2b
COCO_RUNNER_CLIENT=jsonl
COCO_MODE=plan
COCO_E2B_TEMPLATE_ID=message-system-coco-2026-05-22-4f4ecc9
COCO_ARTIFACT_MODE=production
COCO_ARTIFACT_VERSION=message-system-coco-2026-05-22-4f4ecc9
COCO_SOURCE_REF=4f4ecc99589c68cffcb150b6a2df9f55144cc2d1
```

Message System validates these values at startup. If production E2B JSONL mode is enabled without `COCO_ARTIFACT_VERSION` and `COCO_SOURCE_REF`, or if it tries to use `COCO_SOURCE_DIR`, startup fails.

## Development Config

Local smoke work may mount the developer Coco checkout, but only in development artifact mode:

```bash
COCO_ENABLED=true
COCO_SANDBOX_PROVIDER=e2b
COCO_RUNNER_CLIENT=jsonl
COCO_MODE=plan
COCO_ARTIFACT_MODE=development
COCO_E2B_TEMPLATE_ID=message-system-coco-dev
COCO_SOURCE_DIR=/Users/sky/projects/coco/src
```

This is intentionally not accepted as production config.

## Acceptance

- Artifact build instructions are documented here.
- Artifact version and Coco source commit are pinned in `ops/coco-sandbox/artifact.lock.json`.
- Python dependencies are pinned and hash-verified in `ops/coco-sandbox/requirements.lock`.
- `server/message-system_coco_runner` has package metadata and is loaded from a fixed source tree in the artifact.
- Production E2B JSONL startup requires pinned artifact metadata.
- Development mode is the only mode allowed to use the local Coco source path.
