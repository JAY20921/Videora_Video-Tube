import pino from "pino";
import { config } from "../config/index.js";

export const logger = pino({
  level: config.isProduction ? "info" : "debug",
  redact: {
    // Never log these fields — strip them silently
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "body.password",
      "body.oldPassword",
      "body.newPassword",
    ],
    censor: "[REDACTED]",
  },
  transport: config.isProduction
    ? undefined // JSON output in prod (for log aggregators)
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});
