import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getBalance } from "@wagmi/core";
import { optimism } from "wagmi/chains";
import { client } from "./client.mjs";

const ProfileDisplay = () => {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!address || !isConnected) {
        setProfile(null);
        return;
      }

      setLoading(true);
      try {
        // Use the existing ENS data endpoint
        const response = await fetch(`https://api.ensdata.net/${address}?farcaster=true`);
        let ensData = null;
        
        if (response.ok) {
          ensData = await response.json();
        }

        const truncatedAddress = address.slice(0, 6) + "..." + address.slice(-4);
        
        // Extract avatar URL - prioritize different sources
        let avatar = null;
        if (ensData?.avatar_small) {
          avatar = ensData.avatar_small;
        } else if (ensData?.avatar) {
          avatar = ensData.avatar;
        } else if (ensData?.avatar_url) {
          avatar = ensData.avatar_url;
        } else if (ensData?.farcaster?.pfp_url) {
          avatar = ensData.farcaster.pfp_url;
        } else if (ensData?.farcaster?.avatar) {
          avatar = ensData.farcaster.avatar;
        }

        // Ensure avatar URL is valid
        if (avatar && !avatar.startsWith("https://")) {
          avatar = null;
        }
        
        setProfile({
          address: address,
          truncatedAddress: truncatedAddress,
          displayName: ensData?.ens || ensData?.farcaster?.username || truncatedAddress,
          avatar: avatar,
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
        const truncatedAddress = address.slice(0, 6) + "..." + address.slice(-4);
        setProfile({
          address: address,
          truncatedAddress: truncatedAddress,
          displayName: truncatedAddress,
          avatar: null,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [address, isConnected]);

  if (!isConnected || !address) {
    return (
      <>
        <div className="profile-avatar-placeholder" style={{ margin: "0 auto" }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ color: "var(--text-white)" }}
          >
            <path
              d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ marginTop: "20px" }}>
          <h2
            style={{
              fontWeight: 600,
              fontSize: "24px",
              color: "var(--text-primary)",
              margin: "0 0 8px 0",
            }}
          >
            Connect your wallet
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: "16px", margin: 0 }}>
            to get your Kiwi Pass
          </p>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <div className="profile-avatar-placeholder" style={{ margin: "0 auto" }}>
          <div style={{ color: "var(--text-white)" }}>...</div>
        </div>
        <div style={{ marginTop: "20px" }}>
          <h2
            style={{
              fontWeight: 600,
              fontSize: "24px",
              color: "var(--text-primary)",
              margin: "0 0 8px 0",
            }}
          >
            Loading...
          </h2>
        </div>
      </>
    );
  }

  return (
    <>
      {profile?.avatar ? (
        <img
          src={profile.avatar}
          alt={profile.displayName}
          className="profile-avatar"
          style={{ margin: "0 auto" }}
        />
      ) : (
        <div className="profile-avatar-placeholder" style={{ margin: "0 auto" }}>
          <span style={{ color: "var(--text-white)", fontSize: "24px", fontWeight: 600 }}>
            {profile?.displayName?.slice(0, 2).toUpperCase() || "??"}
          </span>
        </div>
      )}
      <div style={{ marginTop: "20px" }}>
        <h2
          style={{
            fontWeight: 600,
            fontSize: "24px",
            color: "var(--text-primary)",
            margin: "0 0 8px 0",
          }}
        >
          {profile?.displayName || profile?.truncatedAddress}
        </h2>
        <p style={{ color: "var(--text-tertiary)", fontSize: "16px", margin: 0 }}>
          Ready to join Kiwi
        </p>
      </div>
    </>
  );
};

export default ProfileDisplay;