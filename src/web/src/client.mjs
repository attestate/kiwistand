// @format
import { createClient } from "wagmi";
import { getDefaultClient } from "connectkit";

const client = createClient(
  getDefaultClient({
    appName: "Kiwi News",
    alchemyId: "3ZBBnBhNn0nMmNcdgXFpqWqC981hd1Z2",
    // NOTE: https://github.com/wagmi-dev/wagmi/discussions/2240#discussioncomment-6051864
    //walletConnectProjectId: "cd46d2fcf6d171fb7c017129868fa211",
  })
);
export default client;
