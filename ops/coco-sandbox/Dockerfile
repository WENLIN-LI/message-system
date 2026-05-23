FROM python:3.12-slim-bookworm@sha256:c1b74bdacbd4903bcfbf73f5b8683478c83435cfa8e293068efaa102ecc56ea8

ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV MESSAGE_SYSTEM_COCO_ARTIFACT_VERSION=message-system-coco-2026-05-22-4f4ecc9
ENV MESSAGE_SYSTEM_COCO_SOURCE_REF=4f4ecc99589c68cffcb150b6a2df9f55144cc2d1
ENV PYTHONPATH=/opt/coco/src:/opt/message-system_coco_runner

WORKDIR /workspace

COPY coco /opt/coco
COPY message-system_coco_runner /opt/message-system_coco_runner
COPY artifact.lock.json /opt/message-system-coco-artifact.lock.json
COPY requirements.lock /opt/message-system-coco-requirements.lock

RUN python -m pip install --no-cache-dir --require-hashes -r /opt/message-system-coco-requirements.lock \
  && python - <<'PY'
import importlib

importlib.import_module("core.engine")
importlib.import_module("message-system_coco_runner.runner")
PY

RUN useradd --create-home --uid 10001 message-system \
  && chown -R message-system:message-system /workspace

USER message-system
CMD ["python", "-m", "message-system_coco_runner"]
