// @format
import { start } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import {
  handleDiscovery,
  handleConnection,
  handleDisconnection,
} from "./sync.mjs";
import * as messages from "./topics/messages.mjs";
import * as server from "./http.mjs";

const handlers = {
  node: {
    "peer:discovery": handleDiscovery,
  },
  connection: {
    "peer:connect": handleConnection,
    "peer:disconnect": handleDisconnection,
  },
  protocol: {},
};

(async () => {
  global.libp2pnode = await start(
    config,
    handlers.node,
    handlers.connection,
    handlers.protocol,
    [messages]
  );

  await server.launch();
  libp2pnode.getMultiaddrs().forEach((addr) => {
    log(`listening: ${addr.toString()}`);
  });
})();
