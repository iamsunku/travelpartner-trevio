import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info"),
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
