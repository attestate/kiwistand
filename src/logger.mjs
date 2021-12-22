// @format
import pino from "pino";
import pretty from "pino-pretty";
import { env } from "process";

const { LOG_LEVEL, NODE_ENV } = env;

let stream;
if (NODE_ENV === "test") {
  stream = pretty({
    prettyPrint: { colorize: true }
  });
}

const logger = pino(
  {
    level: LOG_LEVEL || "info"
  },
  stream
);

export default logger;
