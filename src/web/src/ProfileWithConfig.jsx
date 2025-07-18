import { WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { client, chains } from "./client.mjs";
import ProfileDisplay from "./ProfileDisplay.jsx";

const ProfileWithConfig = () => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <ProfileDisplay />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default ProfileWithConfig;