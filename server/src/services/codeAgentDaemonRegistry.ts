import { CodeAgentRunnerProcess, CodeAgentSandboxHandle } from './codeAgentSandboxService';

interface TrackedDaemonProcess {
  realProcess: CodeAgentRunnerProcess;
  exposedProcess: CodeAgentRunnerProcess;
}

export interface EnsureCodeAgentDaemonProcessInput {
  handle: CodeAgentSandboxHandle;
  command: string;
  env: Record<string, string>;
  start: (env: Record<string, string>) => Promise<CodeAgentRunnerProcess>;
}

export class CodeAgentDaemonProcessRegistry {
  private readonly processes = new Map<string, TrackedDaemonProcess>();

  async ensure(input: EnsureCodeAgentDaemonProcessInput): Promise<CodeAgentRunnerProcess> {
    const existing = this.processes.get(input.handle.id);
    if (existing) {
      return existing.exposedProcess;
    }

    const realProcess = await input.start(baseDaemonEnv(input.env));
    const exposedProcess: CodeAgentRunnerProcess = {
      ...realProcess,
      command: input.command,
      stop: async () => {},
    };
    const tracked = { realProcess, exposedProcess };
    this.processes.set(input.handle.id, tracked);
    realProcess.completed?.finally(() => {
      if (this.processes.get(input.handle.id) === tracked) {
        this.processes.delete(input.handle.id);
      }
    });
    return exposedProcess;
  }

  async shutdown(handle: CodeAgentSandboxHandle): Promise<void> {
    const tracked = this.processes.get(handle.id);
    if (!tracked) {
      return;
    }
    this.processes.delete(handle.id);
    await tracked.realProcess.stop();
  }
}

const PER_TURN_ENV_KEYS = new Set([
  'MESSAGE_SYSTEM_CODEX_AUTH_JSON_PATH',
  'MESSAGE_SYSTEM_CODEX_REFRESHED_AUTH_JSON_PATH',
  'MESSAGE_SYSTEM_MODEL_GATEWAY_TOKEN',
  'MESSAGE_SYSTEM_STATIC_PUBLISH_TOKEN',
  'MESSAGE_SYSTEM_STATIC_PUBLISH_URL',
  'MESSAGE_SYSTEM_STATIC_PUBLISH_PUBLIC_BASE_URL',
  'MESSAGE_SYSTEM_STATIC_PUBLISH_PUBLIC_URL',
  'MESSAGE_SYSTEM_STATIC_PUBLISH_MODE',
]);

const baseDaemonEnv = (env: Record<string, string>) => Object.fromEntries(
  Object.entries(env).filter(([key]) => !PER_TURN_ENV_KEYS.has(key))
);
