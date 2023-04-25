// @format
import { createClient } from "wagmi";
import { getDefaultClient } from "connectkit";

const client = createClient(
  getDefaultClient({
    appName: "Kiwi News",
    alchemyId: "3ZBBnBhNn0nMmNcdgXFpqWqC981hd1Z2",
  })
);
export default client;
