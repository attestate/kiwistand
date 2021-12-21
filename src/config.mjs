import dotenv from "dotenv";
dotenv.config();
import { env } from "process";

const { BIND_ADDRESS_V4 } = env;

const config = {
  addresses: {
    listen: [`/ip4/${BIND_ADDRESS_V4}/tcp/0`]
  }
};
export default config;
