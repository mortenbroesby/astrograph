import process from "node:process";

import pino, { type Bindings, type Logger } from "pino";

const configuredLevel = process.env.AI_CONTEXT_ENGINE_LOG_LEVEL?.trim() || "silent";

const rootLogger = pino(
  {
    name: "astrograph",
    level: configuredLevel,
    base: undefined,
  },
  pino.destination({
    dest: 2,
    sync: true,
  }),
);

export function getLogger(bindings?: Bindings): Logger {
  return bindings ? rootLogger.child(bindings) : rootLogger;
}

export function isStructuredLoggingEnabled(): boolean {
  return configuredLevel !== "silent";
}
