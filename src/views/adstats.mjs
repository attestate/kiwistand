//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { startOfDay, addDays } from "date-fns";
import { sub, add, format, isSameDay } from "date-fns";
import { URL } from "url";
import { plot } from "svg-line-chart";
import { ethers } from "ethers";
import { Alchemy, Network } from "alchemy-sdk";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import cache, {
  getHashesPerDateRange,
  countImpressions,
  countOutbounds,
  getImpressionsWithTimestamps,
  getOutboundsWithTimestamps,
} from "../cache.mjs";

const html = htm.bind(vhtml);

// Cache key for ad URLs
const AD_URLS_CACHE_KEY = "adstats-ad-urls";

// Get URLs from ad contract transactions with caching
async function getAdUrls() {
  try {
    // Check if we have cached data that's still valid (daily TTL)
    const cachedUrls = cache.get(AD_URLS_CACHE_KEY);
    if (cachedUrls) {
      console.log("Using cached ad URLs");
      return cachedUrls;
    }

    console.log("Cache miss for ad URLs, fetching from blockchain...");

    // Configure Alchemy SDK
    const config = {
      apiKey: env.ALCHEMY_API_KEY || "demo",
      network: Network.OPT_MAINNET, // Optimism Mainnet
    };
    const alchemy = new Alchemy(config);

    const contractAddress = "0xFfcC6b6c5C066B23992758A4fC408F09d6Cc4EDA";

    // Get transactions to the ad contract
    const transfers = await alchemy.core.getAssetTransfers({
      toAddress: contractAddress,
      category: ["external"],
      withMetadata: true,
      excludeZeroValue: true,
    });

    // We need to extract URLs from the transactions
    const adUrls = [];

    for (const transfer of transfers.transfers) {
      try {
        const txData = await alchemy.core.getTransaction(transfer.hash);

        // Check if this is a 'set' function call (0xe942b516 is the function signature)
        if (txData.data && txData.data.startsWith("0xe942b516")) {
          const provider = new ethers.providers.JsonRpcProvider(
            env.OPTIMISM_RPC_HTTP_HOST,
          );
          const iface = new ethers.utils.Interface([
            "function set(string _title, string _href) external payable",
          ]);

          try {
            const decodedData = iface.decodeFunctionData("set", txData.data);
            const url = decodedData._href;
            adUrls.push(url);
          } catch (decodeError) {
            console.error(
              "Error decoding transaction data:",
              decodeError.message,
            );
            console.error(
              "Transaction data:",
              txData.data.substring(0, 200) + "...",
            );
          }
        }
      } catch (txErr) {
        console.error("Error fetching transaction details:", txErr);
      }
    }

    // Cache the results with a TTL of 24 hours (86400 seconds)
    // Using the default TTL from the cache configuration
    cache.set(AD_URLS_CACHE_KEY, adUrls);

    return adUrls;
  } catch (err) {
    console.error("Error fetching ad URLs:", err);
    return [];
  }
}

// Get daily performance data for ad URLs
function getAdPerformanceData(adUrls, d30Ago, today) {
  // Setup date range array (same approach as in users.mjs)
  const dates = [];
  for (let day = new Date(d30Ago); day <= today; day = add(day, { days: 1 })) {
    dates.push(new Date(day));
  }

  // Get timestamp range
  const startTimestamp = Math.floor(d30Ago.getTime() / 1000);
  const endTimestamp = Math.floor(today.getTime() / 1000);

  // Get raw data
  const allImpressions = getImpressionsWithTimestamps(
    startTimestamp,
    endTimestamp,
  );
  const allOutbounds = getOutboundsWithTimestamps(startTimestamp, endTimestamp);

  console.log(`Found ${allImpressions.length} total impressions in time range`);
  console.log(`Found ${allOutbounds.length} total outbounds in time range`);

  // Function to check if URLs are effectively the same (ignoring some query params)
  const isSameBaseUrl = (url1, url2) => {
    try {
      // Parse the URLs
      const parsedUrl1 = new URL(url1);
      const parsedUrl2 = new URL(url2);

      // Compare domains and paths
      if (parsedUrl1.hostname !== parsedUrl2.hostname) return false;
      if (parsedUrl1.pathname !== parsedUrl2.pathname) return false;

      return true;
    } catch (e) {
      return false;
    }
  };

  // Filter to only include ad URLs with flexible matching
  const adImpressions = allImpressions.filter((imp) => {
    // Try exact match first
    if (adUrls.includes(imp.url)) {
      console.log(`Found impression for ad URL (exact): ${imp.url}`);
      return true;
    }

    // Try base URL match
    for (const adUrl of adUrls) {
      if (isSameBaseUrl(imp.url, adUrl)) {
        console.log(`Found impression for ad URL (base match): ${imp.url}`);
        return true;
      }
    }

    return false;
  });

  const adOutbounds = allOutbounds.filter((out) => {
    // Try exact match first
    if (adUrls.includes(out.url)) {
      console.log(`Found click for ad URL (exact): ${out.url}`);
      return true;
    }

    // Try base URL match
    for (const adUrl of adUrls) {
      if (isSameBaseUrl(out.url, adUrl)) {
        console.log(`Found click for ad URL (base match): ${out.url}`);
        return true;
      }
    }

    return false;
  });

  console.log(`Filtered to ${adImpressions.length} ad impressions`);
  console.log(`Filtered to ${adOutbounds.length} ad clicks`);

  // Create daily count maps
  const impressionCounts = new Array(dates.length).fill(0);
  const clickCounts = new Array(dates.length).fill(0);

  // Count impressions by day
  adImpressions.forEach((impression) => {
    const impDate = new Date(impression.timestamp * 1000);

    // Find matching date index
    for (let i = 0; i < dates.length; i++) {
      if (isSameDay(impDate, dates[i])) {
        impressionCounts[i]++;
        break;
      }
    }
  });

  // Count clicks by day
  adOutbounds.forEach((click) => {
    const clickDate = new Date(click.timestamp * 1000);

    // Find matching date index
    for (let i = 0; i < dates.length; i++) {
      if (isSameDay(clickDate, dates[i])) {
        clickCounts[i]++;
        break;
      }
    }
  });

  // Get unique URLs that were found in impressions/clicks
  const foundAdUrls = new Set();
  adImpressions.forEach((imp) => foundAdUrls.add(imp.url));
  adOutbounds.forEach((out) => foundAdUrls.add(out.url));

  return {
    impressions: {
      dates: dates,
      counts: impressionCounts,
    },
    clicks: {
      dates: dates,
      counts: clickCounts,
    },
    adImpressions: adImpressions,
    adOutbounds: adOutbounds,
    uniqueAdUrlsFound: Array.from(foundAdUrls),
  };
}

export default async function (trie, theme, req, res) {
  // Add cache control headers for browsers
  if (res) {
    // Cache for 8 hours in browsers, but allow revalidation
    res.setHeader(
      "Cache-Control",
      "public, max-age=28800, stale-while-revalidate=86400",
    );
  }

  // Set up date ranges for the charts
  const today = new Date();
  const d30Ago = sub(today, { days: 30 });

  // Get URLs from ad contract transactions (with caching)
  const adUrls = await getAdUrls();
  console.log("Ad URLs from contract:", adUrls);

  // Get daily performance data for these URLs
  const performanceData = getAdPerformanceData(adUrls, d30Ago, today);

  // Configure chart options
  const options = {
    props: {
      style: "display:block;margin:0 auto;",
    },
    margin: 3,
    width: 70,
    height: 30,
    polygon: {
      fill: "none",
      style: "fill:url(#polygrad);",
      strokeWidth: 0.01,
      stroke: "white",
    },
    line: {
      fill: "none",
      strokeWidth: 0.1,
      stroke: "black",
    },
    polygonGradient: {
      offSet1: "0%",
      stopColor1: "#ffffff00",
      offSet2: "100%",
      stopColor2: "#ffffff00",
    },
    xAxis: {
      strokeWidth: 0.1,
      stroke: "black",
    },
    yAxis: {
      strokeWidth: 0.1,
      stroke: "black",
    },
    xLabel: {
      fontSize: 1,
    },
    yLabel: {
      fontSize: 1,
    },
    xGrid: {
      strokeWidth: 0.05,
      stroke: "lightgrey",
    },
    yGrid: {
      strokeWidth: 0.05,
      stroke: "lightgrey",
    },
    yNumLabels: 10,
  };

  // Create impression chart - simple version without trying to modify SVG
  options.yLabel.name = "Daily Ad Impressions";
  options.xLabel.name = "Last 30 days";
  const impressionChartData = {
    x: performanceData.impressions.dates,
    y: performanceData.impressions.counts,
  };
  const impressionChart = plot(html)(impressionChartData, options);

  // Create click chart
  options.yLabel.name = "Daily Ad Clicks";
  options.xLabel.name = "Last 30 days";
  const clickChartData = {
    x: performanceData.clicks.dates,
    y: performanceData.clicks.counts,
  };
  const clickChart = plot(html)(clickChartData, options);
  console.log(impressionChartData, clickChartData);

  // Calculate totals for summary
  const totalImpressions = performanceData.impressions.counts.reduce(
    (sum, count) => sum + count,
    0,
  );
  const totalClicks = performanceData.clicks.counts.reduce(
    (sum, count) => sum + count,
    0,
  );

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 20px;">
                  <h2>AD PERFORMANCE STATISTICS</h2>

                  <div style="margin-bottom: 25px;">
                    <h3>
                      Ad Spot Performance Summary (${format(d30Ago, "MMM d")} -
                      ${format(today, "MMM d, yyyy")})
                    </h3>
                    <div
                      style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 15px;"
                    >
                      <div
                        style="background: #f8f8f8; padding: 15px; border: 1px solid #e5e5e5; border-radius: 2px;"
                      >
                        <div style="font-size: 24px; font-weight: bold;">
                          ${totalImpressions}
                        </div>
                        <div>30-Day Total Impressions</div>
                      </div>
                      <div
                        style="background: #f8f8f8; padding: 15px; border: 1px solid #e5e5e5; border-radius: 2px;"
                      >
                        <div style="font-size: 24px; font-weight: bold;">
                          ${totalClicks}
                        </div>
                        <div>30-Day Total Clicks</div>
                      </div>
                    </div>
                  </div>

                  <p>
                    <b>Daily Ad Impressions</b>
                    <br />
                    <br />
                    <b>Definition:</b> The number of times the ad spot (position
                    #4) was shown to visitors each day over the last 30 days
                    (${format(d30Ago, "MMM d")}<span> to </span>
                    ${format(today, "MMM d, yyyy")}).
                  </p>
                  ${impressionChart}

                  <p>
                    <b>Daily Ad Clicks</b>
                    <br />
                    <br />
                    <b>Definition:</b> The number of times visitors clicked on
                    ads in this spot each day over the last 30 days
                    (${format(d30Ago, "MMM d")}<span> to </span>
                    ${format(today, "MMM d, yyyy")}).
                  </p>
                  ${clickChart}

                  <!-- No additional content after click chart -->
                </td>
              </tr>
            </table>
            ${Footer(theme)}
          </div>
        </div>
      </body>
    </html>
  `;
}
