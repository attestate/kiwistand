// @format
import { createClient } from "wagmi";
import { getDefaultClient } from "connectkit";

const client = createClient(
  getDefaultClient({
    appName: "Kiwi News",
    alchemyId: "3ZBBnBhNn0nMmNcdgXFpqWqC981hd1Z2",
    walletConnectProjectId: "cd46d2fcf6d171fb7c017129868fa211",
  })
);
export default client;
