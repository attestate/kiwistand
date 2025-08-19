import React, { useEffect, useState } from "react";
import { WagmiConfig, useAccount, useWalletClient } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { Wallet } from "@ethersproject/wallet";
import { client, chains, getProvider } from "./client.mjs";
import { fetchStoryAnalytics } from "./API.mjs";
import { getLocalAccount } from "./session.mjs";

// Format numbers to abbreviated form (1234 -> 1.2k)
function formatCompactNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

const AnalyticsInner = (props) => {
  const [analyticsData, setAnalyticsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { address: wagmiAddress, isConnected } = useAccount();
  const { data: result } = useWalletClient();
  
  // Get local account and provider - same as Vote.jsx
  const provider = getProvider();
  const localAccount = getLocalAccount(wagmiAddress, props.allowlist);
  
  // Determine address - same logic as Vote.jsx
  let address = localAccount ? localAccount.identity : wagmiAddress;
  
  // Determine signer - exact same logic as Vote.jsx
  let signer, isLocal;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
    isLocal = true;
  } else {
    signer = result;
  }

  useEffect(() => {
    // Find all story analytics placeholders on the page
    const analyticsElements = document.querySelectorAll(".story-analytics");
    if (!analyticsElements.length) return;

    // Check if user has an address
    if (!address) return;

    // Check if we have a signer
    if (!signer) {
      console.log("No signer available for analytics");
      return;
    }

    // Collect all elements for the current user's stories
    const userStoryElements = [];
    const hrefs = new Set();
    
    analyticsElements.forEach(elem => {
      const submitter = elem.dataset.submitter;
      const href = elem.dataset.href;
      
      // Check if current user is the submitter
      if (submitter && address && address.toLowerCase() === submitter.toLowerCase()) {
        userStoryElements.push(elem);
        hrefs.add(href);
      } else {
        // Hide analytics for stories that don't belong to the user
        elem.style.display = 'none';
      }
    });

    // If no stories belong to the user, exit
    if (userStoryElements.length === 0) return;

    // Fetch analytics for all user's stories
    const fetchAllAnalytics = async () => {
      // Prevent multiple requests
      if (loading || hasError || Object.keys(analyticsData).length > 0) {
        return;
      }
      
      setLoading(true);

      // Fetch analytics for each story
      for (const href of hrefs) {
        try {
          const data = await fetchStoryAnalytics(href, signer);
          
          if (data) {
            console.log(`Analytics data received for ${href}:`, data);
            setAnalyticsData(prev => ({
              ...prev,
              [href]: data
            }));

            // Update only elements where the user is the submitter
            userStoryElements.forEach(elem => {
              const elemSubmitter = elem.dataset.submitter;
              // Double-check that this element belongs to the current user
              if (elem.dataset.href === href && elemSubmitter && address && address.toLowerCase() === elemSubmitter.toLowerCase()) {
                const impressionsElem = elem.querySelector(".analytics-impressions");
                const clicksElem = elem.querySelector(".analytics-clicks");
                
                if (impressionsElem) {
                  impressionsElem.textContent = formatCompactNumber(data.impressions);
                }
                if (clicksElem) {
                  clicksElem.textContent = formatCompactNumber(data.clicks);
                }
                
                console.log(`Showing analytics for ${href}`);
                // Show the analytics span
                elem.style.display = "inline";
                
                // Hide domain text on mobile to prevent overflow
                if (window.innerWidth <= 768) {
                  const subtitle = elem.closest('.story-subtitle');
                  if (subtitle) {
                    const domainText = subtitle.querySelector('.domain-text');
                    if (domainText) {
                      domainText.style.display = 'none';
                    }
                  }
                }
                
                // Mark the parent subtitle as having analytics
                const subtitleParent = elem.closest('.story-subtitle');
                if (subtitleParent) {
                  subtitleParent.classList.add('has-analytics');
                }
              }
            });
          }
        } catch (err) {
          console.error(`Error fetching analytics for ${href}:`, err);
          // Continue with other stories even if one fails
        }
      }

      setLoading(false);
    };

    fetchAllAnalytics();
  }, [address, signer]);

  // This component doesn't render anything itself
  return null;
};

const Analytics = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <AnalyticsInner {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Analytics;