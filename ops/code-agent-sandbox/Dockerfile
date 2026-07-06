FROM python:3.12-slim-bookworm@sha256:42ada43c4265e1ed6db62ad8df62af99a4abb9a9d49622032522ac76efb0bcef

ARG CODEX_CLI_NPM_VERSION=0.142.5
ARG PLAYWRIGHT_NPM_VERSION=1.61.1
ARG PNPM_NPM_VERSION=11.10.0
ARG YARN_NPM_VERSION=1.22.22
ARG TYPESCRIPT_NPM_VERSION=6.0.3
ARG TSX_NPM_VERSION=4.23.0

ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV MESSAGE_SYSTEM_CODE_AGENT_ARTIFACT_VERSION=message-system-code-agent-2026-07-06-sandbox-daemon-v1
ENV MESSAGE_SYSTEM_CODE_AGENT_SOURCE_REF=a4e70e674e46d59a63874371276f5fec0fcd3f41
ENV MESSAGE_SYSTEM_CODEX_CLI_VERSION=${CODEX_CLI_NPM_VERSION}
ENV MESSAGE_SYSTEM_PLAYWRIGHT_VERSION=${PLAYWRIGHT_NPM_VERSION}
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_PATH=/usr/lib/node_modules
ENV PYTHONPATH=/opt/code-agent-engine/src:/opt/message-system_code_agent_runner

WORKDIR /workspace

COPY code-agent-engine /opt/code-agent-engine
COPY message-system_code_agent_runner /opt/message-system_code_agent_runner
COPY artifact.lock.json /opt/message-system-code-agent-artifact.lock.json
COPY requirements.lock /opt/message-system-code-agent-requirements.lock
COPY codex-sdk.requirements.lock /opt/message-system-codex-sdk-requirements.lock

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    bubblewrap \
    build-essential \
    ca-certificates \
    cargo \
    cmake \
    composer \
    curl \
    dnsutils \
    fd-find \
    file \
    git \
    git-lfs \
    gnupg \
    golang-go \
    iproute2 \
    iputils-ping \
    jq \
    less \
    lsof \
    maven \
    netcat-openbsd \
    ninja-build \
    openjdk-17-jdk-headless \
    openssh-client \
    php-cli \
    pkg-config \
    postgresql-client \
    procps \
    psmisc \
    redis-tools \
    ripgrep \
    rsync \
    ruby-full \
    shellcheck \
    sqlite3 \
    tree \
    unzip \
    wget \
    xz-utils \
    zip \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && npm install -g \
    @openai/codex@${CODEX_CLI_NPM_VERSION} \
    playwright@${PLAYWRIGHT_NPM_VERSION} \
    pnpm@${PNPM_NPM_VERSION} \
    yarn@${YARN_NPM_VERSION} \
    typescript@${TYPESCRIPT_NPM_VERSION} \
    tsx@${TSX_NPM_VERSION} \
  && npm cache clean --force \
  && mkdir -p "${PLAYWRIGHT_BROWSERS_PATH}" \
  && playwright install --with-deps chromium \
  && ln -sf /usr/bin/fdfind /usr/local/bin/fd \
  && git lfs install --system \
  && { echo '#!/bin/sh'; echo 'exec python -m message-system_code_agent_runner.platform_tools "$@"'; } > /usr/local/bin/message-system \
  && chmod 755 /usr/local/bin/message-system \
  && CODEX_NATIVE_BIN="$(find "$(npm root -g)/@openai/codex" -path '*/vendor/x86_64-unknown-linux-musl/bin/codex' -type f -perm /111 | head -n 1)" \
  && test -n "${CODEX_NATIVE_BIN}" \
  && ln -sf "${CODEX_NATIVE_BIN}" /usr/local/bin/codex-linux-sandbox \
  && codex --version \
  && codex-linux-sandbox --help >/dev/null \
  && playwright --version >/dev/null \
  && node -e 'const { chromium } = require("playwright"); const fs = require("fs"); const executable = chromium.executablePath(); if (!fs.existsSync(executable)) { console.error(`missing Chromium executable: ${executable}`); process.exit(1); }' \
  && curl --version >/dev/null \
  && wget --version >/dev/null \
  && jq --version >/dev/null \
  && rg --version >/dev/null \
  && fd --version >/dev/null \
  && git --version >/dev/null \
  && git lfs version >/dev/null \
  && python --version >/dev/null \
  && pip --version >/dev/null \
  && node --version >/dev/null \
  && npm --version >/dev/null \
  && pnpm --version >/dev/null \
  && yarn --version >/dev/null \
  && tsc --version >/dev/null \
  && tsx --version >/dev/null \
  && gcc --version >/dev/null \
  && g++ --version >/dev/null \
  && make --version >/dev/null \
  && cmake --version >/dev/null \
  && ninja --version >/dev/null \
  && go version >/dev/null \
  && rustc --version >/dev/null \
  && cargo --version >/dev/null \
  && java -version >/dev/null 2>&1 \
  && javac -version >/dev/null 2>&1 \
  && mvn --version >/dev/null \
  && ruby --version >/dev/null \
  && php --version >/dev/null \
  && composer --version >/dev/null \
  && psql --version >/dev/null \
  && redis-cli --version >/dev/null \
  && shellcheck --version >/dev/null \
  && message-system --help >/dev/null \
  && python -m pip install --no-cache-dir --require-hashes -r /opt/message-system-code-agent-requirements.lock \
  && python -m pip install --no-cache-dir --no-deps --require-hashes -r /opt/message-system-codex-sdk-requirements.lock \
  && python -c 'import importlib; importlib.import_module("core.engine"); importlib.import_module("message-system_code_agent_runner.runner"); importlib.import_module("message-system_code_agent_runner.codex_cli"); importlib.import_module("message-system_code_agent_runner.codex_app_server"); importlib.import_module("message-system_code_agent_runner.codex_sdk_app_server"); importlib.import_module("openai_codex")' \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 message-system \
  && mkdir -p /tmp/message-system-codex \
  && chown -R message-system:message-system /workspace /tmp/message-system-codex "${PLAYWRIGHT_BROWSERS_PATH}" \
  && chmod 700 /tmp/message-system-codex

USER message-system
CMD ["python", "-m", "message-system_code_agent_runner"]
