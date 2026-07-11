FROM python:3.12-slim-bookworm@sha256:42ada43c4265e1ed6db62ad8df62af99a4abb9a9d49622032522ac76efb0bcef

ARG CODEX_CLI_NPM_VERSION=0.144.1
ARG PLAYWRIGHT_NPM_VERSION=1.61.1
ARG PNPM_NPM_VERSION=11.10.0
ARG YARN_NPM_VERSION=1.22.22
ARG TYPESCRIPT_NPM_VERSION=6.0.3
ARG TSX_NPM_VERSION=4.23.0
ARG GH_CLI_VERSION=2.94.0
ARG GH_CLI_AMD64_SHA256=a757f1ba6db18f4de8cbadb244843a5f89bc75b5e7c6fc127d2bd77fbd12ed62
ARG GH_CLI_ARM64_SHA256=705a23b70b0f1b7ba4c302fdcef392ce3edaacfa7ce8e85e4d93d72ea800a538
ARG OH_MY_ZSH_REF=677a4592b18c08ddea737f8aca70bac0e9fc9313
ARG POWERLEVEL10K_REF=9253fb1c5034410c43a0c681ff8294181c54016c

ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV MESSAGE_SYSTEM_CODE_AGENT_ARTIFACT_VERSION=message-system-code-agent-2026-07-11-github-pat-v1
ENV MESSAGE_SYSTEM_CODE_AGENT_SOURCE_REF=d2335368c88329daf24bcf84970cd1d710b950fe
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
    zsh \
    zip \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && GH_ARCH="$(dpkg --print-architecture)" \
  && case "${GH_ARCH}" in \
    amd64) GH_SHA256="${GH_CLI_AMD64_SHA256}" ;; \
    arm64) GH_SHA256="${GH_CLI_ARM64_SHA256}" ;; \
    *) echo "unsupported GitHub CLI architecture: ${GH_ARCH}" >&2; exit 1 ;; \
  esac \
  && curl -fsSLo /tmp/gh.tar.gz "https://github.com/cli/cli/releases/download/v${GH_CLI_VERSION}/gh_${GH_CLI_VERSION}_linux_${GH_ARCH}.tar.gz" \
  && echo "${GH_SHA256}  /tmp/gh.tar.gz" | sha256sum -c - \
  && tar -xzf /tmp/gh.tar.gz -C /tmp \
  && install -D -m 755 "/tmp/gh_${GH_CLI_VERSION}_linux_${GH_ARCH}/bin/gh" /usr/local/lib/message-system/gh-real \
  && rm -rf /tmp/gh.tar.gz "/tmp/gh_${GH_CLI_VERSION}_linux_${GH_ARCH}" \
  && { \
    echo '#!/bin/sh'; \
    echo 'token_path=${MESSAGE_SYSTEM_GITHUB_TOKEN_PATH:-}'; \
    echo 'if [ -n "$token_path" ] && [ -r "$token_path" ]; then'; \
    echo '  GH_TOKEN="$(cat "$token_path")"'; \
    echo '  export GH_TOKEN'; \
    echo 'fi'; \
    echo 'exec /usr/local/lib/message-system/gh-real "$@"'; \
  } > /usr/local/bin/gh \
  && chmod 755 /usr/local/bin/gh \
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
  && gh --version >/dev/null \
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
  && zsh --version >/dev/null \
  && message-system --help >/dev/null \
  && python -m pip install --no-cache-dir --require-hashes -r /opt/message-system-code-agent-requirements.lock \
  && python -m pip install --no-cache-dir --no-deps --require-hashes -r /opt/message-system-codex-sdk-requirements.lock \
  && python -c 'import importlib; importlib.import_module("core.engine"); importlib.import_module("message-system_code_agent_runner.runner"); importlib.import_module("message-system_code_agent_runner.codex_cli"); importlib.import_module("message-system_code_agent_runner.codex_app_server"); importlib.import_module("message-system_code_agent_runner.codex_sdk_app_server"); importlib.import_module("openai_codex")' \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 message-system \
  && mkdir -p /tmp/message-system-codex \
  && git init -q /home/message-system/.oh-my-zsh \
  && git -C /home/message-system/.oh-my-zsh remote add origin https://github.com/ohmyzsh/ohmyzsh.git \
  && git -C /home/message-system/.oh-my-zsh fetch --depth=1 origin "${OH_MY_ZSH_REF}" \
  && git -C /home/message-system/.oh-my-zsh checkout --detach FETCH_HEAD \
  && mkdir -p /home/message-system/.oh-my-zsh/custom/themes/powerlevel10k \
  && git init -q /home/message-system/.oh-my-zsh/custom/themes/powerlevel10k \
  && git -C /home/message-system/.oh-my-zsh/custom/themes/powerlevel10k remote add origin https://github.com/romkatv/powerlevel10k.git \
  && git -C /home/message-system/.oh-my-zsh/custom/themes/powerlevel10k fetch --depth=1 origin "${POWERLEVEL10K_REF}" \
  && git -C /home/message-system/.oh-my-zsh/custom/themes/powerlevel10k checkout --detach FETCH_HEAD \
  && { \
    echo 'if [ -t 0 ] && [ -z "${MESSAGE_SYSTEM_TERMINAL_STAY_IN_BASH:-}" ] && command -v zsh >/dev/null 2>&1; then'; \
    echo '  export SHELL="$(command -v zsh)"'; \
    echo '  exec "$SHELL" -l'; \
    echo 'fi'; \
  } > /home/message-system/.bash_profile \
  && { \
    echo 'export ZSH="$HOME/.oh-my-zsh"'; \
    echo 'ZSH_THEME="powerlevel10k/powerlevel10k"'; \
    echo 'POWERLEVEL9K_DISABLE_CONFIGURATION_WIZARD=true'; \
    echo 'plugins=(git)'; \
    echo 'source "$ZSH/oh-my-zsh.sh"'; \
    echo '[[ ! -f "$HOME/.p10k.zsh" ]] || source "$HOME/.p10k.zsh"'; \
  } > /home/message-system/.zshrc \
  && { \
    echo 'typeset -g POWERLEVEL9K_DISABLE_CONFIGURATION_WIZARD=true'; \
    echo 'typeset -g POWERLEVEL9K_INSTANT_PROMPT=off'; \
    echo 'typeset -g POWERLEVEL9K_MODE=ascii'; \
    echo 'typeset -g POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(dir vcs prompt_char)'; \
    echo 'typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(status command_execution_time background_jobs time)'; \
    echo 'typeset -g POWERLEVEL9K_PROMPT_ADD_NEWLINE=true'; \
    echo 'typeset -g POWERLEVEL9K_PROMPT_CHAR_OK_VIINS_CONTENT_EXPANSION=">"'; \
    echo 'typeset -g POWERLEVEL9K_PROMPT_CHAR_ERROR_VIINS_CONTENT_EXPANSION=">"'; \
    echo 'typeset -g POWERLEVEL9K_TIME_FORMAT="%D{%H:%M}"'; \
    echo 'typeset -g POWERLEVEL9K_DIR_MAX_LENGTH=48'; \
    echo 'typeset -g POWERLEVEL9K_SHORTEN_STRATEGY=truncate_to_unique'; \
  } > /home/message-system/.p10k.zsh \
  && chown -R message-system:message-system /workspace /tmp/message-system-codex "${PLAYWRIGHT_BROWSERS_PATH}" \
  && chown -R message-system:message-system /home/message-system/.oh-my-zsh /home/message-system/.bash_profile /home/message-system/.zshrc /home/message-system/.p10k.zsh \
  && test -f /home/message-system/.oh-my-zsh/oh-my-zsh.sh \
  && test -f /home/message-system/.oh-my-zsh/custom/themes/powerlevel10k/powerlevel10k.zsh-theme \
  && chmod 700 /tmp/message-system-codex

USER message-system
CMD ["python", "-m", "message-system_code_agent_runner"]
