import { differenceInDays, differenceInSeconds, add, sub } from "date-fns";
import { plot } from "svg-line-chart";
import htm from "htm";
import vhtml from "vhtml";
import ethers from "ethers";

import Header from "./views/components/header.mjs";
import Footer from "./views/components/footer.mjs";
import Sidebar from "./views/components/sidebar.mjs";
import Head from "./views/components/head.mjs";
import * as registry from "./chainstate/registry.mjs";
import * as ens from "./ens.mjs";

const { BigNumber } = ethers;
const html = htm.bind(vhtml);
const address = "0x66747bdc903d17c586fa09ee5d6b54cc85bbea45";

// NOTE: Inspired by: https://www.paradigm.xyz/2022/08/vrgda
export function getPrice(salesData, today = new Date()) {
  const firstPrice = BigNumber.from("1280000000000000"); // p0 in Wei

  const priceDecreasePercentage = 0.15; // k

  const mints = salesData
    .map((mint) => {
      const timestamp = new Date(1000 * parseInt(mint.timestamp, 16));
      return {
        ...mint,
        timestamp,
        day: differenceInDays(timestamp, today),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  const firstDayInSchedule = mints[0].timestamp;
  const daysInSchedule = differenceInDays(today, firstDayInSchedule); // t
  const secondsInSchedule = differenceInSeconds(today, firstDayInSchedule); // t

  const dailyNFTSellTarget = 4.58;
  const NFTSellTargetPerSecond = dailyNFTSellTarget / (60 * 60 * 24);
  const numberOfSoldNFTs = mints.length; // n

  const exponent =
    secondsInSchedule - numberOfSoldNFTs / NFTSellTargetPerSecond;
  const factor = Math.pow(
    1 - priceDecreasePercentage,
    // NOTE: We have to divide throught the scaling factor that is basically
    // the number of seconds that a day has to make the price update on a
    // per-second basis.
    exponent / (60 * 60 * 24),
  );

  // NOTE: If we're not scaling up the "factor" then we're losing all the
  // information contained in the decimals and so it can end up happening that
  // factor just becomes zero and so the price also becomes zero.
  const scaler = 100_000_000;
  const linear = firstPrice.mul(
    BigNumber.from(`${Math.floor(factor * scaler)}`),
  );

  const lastMints = mints.filter(({ day }) => day > -31);
  const average30DayMints = lastMints.length / 30;
  return {
    information: {
      daysInSchedule,
      numberOfSoldNFTs,
      dailyNFTSellTarget,
    },
    averages: {
      day30: average30DayMints,
    },
    price: linear.div(scaler),
  };
}

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

function timestampToDate(ts) {
  const date = new Date(ts * 1000);
  return date.toISOString().split("T")[0];
}

function generateDateRange(start, end) {
  const dates = [];
  let currentDate = new Date(start);

  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

async function calculateMintersPerDay(mints) {
  const mintMap = new Map();

  for (const mint of mints) {
    const date = timestampToDate(parseInt(mint.timestamp, 16));

    if (!mintMap.has(date)) {
      mintMap.set(date, 0);
    }

    mintMap.set(date, mintMap.get(date) + 1);
  }

  const dates = generateDateRange(
    Math.min(...Array.from(mintMap.keys(), (key) => new Date(key))),
    Math.max(...Array.from(mintMap.keys(), (key) => new Date(key))),
  );

  const sortedDates = dates.sort();
  for (const date of dates) {
    if (!mintMap.has(date)) {
      mintMap.set(date, 0);
    }
  }

  const minters = sortedDates.map((date) => mintMap.get(date));

  return { dates: sortedDates, minters };
}

export async function chart(theme) {
  const today = new Date();
  const monthAgo = sub(today, {
    months: 1,
  });

  const mints = await registry.mints();
  const data = getPrice(mints);
  const sales = mints
    .map(({ value, timestamp }) => {
      return {
        price: parseFloat(ethers.utils.formatEther(value)) * 1000,
        timestamp: new Date(1000 * parseInt(timestamp, 16)),
      };
    })
    .filter(({ timestamp }) => timestamp > monthAgo && timestamp < today);

  options.yLabel.name = "Price in kilo ETH";
  options.xLabel.name = "";
  const salesChart1m = plot(html)(
    {
      x: sales.map(({ timestamp }) => timestamp),
      y: sales.map(({ price }) => price),
    },
    options,
  );

  const salesDataAll = mints.map((mint) => ({
    ...mint,
    parsedTimestamp: new Date(1000 * parseInt(mint.timestamp, 16)),
  }));
  const salesData1m = salesDataAll.filter(
    ({ parsedTimestamp }) =>
      parsedTimestamp > monthAgo && parsedTimestamp < today,
  );
  const totalSalesValue = salesDataAll.reduce(
    (total, sale) => total + parseInt(sale.value, 16),
    0,
  );

  // Calculate average sales price
  const averageSalesPrice = Math.floor(totalSalesValue / salesDataAll.length);

  const mintersDataAll = await calculateMintersPerDay(salesDataAll);
  const mintersData1m = await calculateMintersPerDay(salesData1m);

  options.yLabel.name = "minters";
  options.xLabel.name = "";
  const mintersChartAll = plot(html)(
    {
      x: mintersDataAll.dates.map((date) => new Date(date)),
      y: mintersDataAll.minters,
    },
    options,
  );
  const mintersChart1m = plot(html)(
    {
      x: mintersData1m.dates.map((date) => new Date(date)),
      y: mintersData1m.minters,
    },
    options,
  );

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 20px;">
                  <span>Total sales value (all): </span>
                  ${ethers.utils.formatEther(totalSalesValue.toString())} ETH
                  <br />
                  <span>Average Sale Price (all): </span>
                  ${ethers.utils.formatEther(averageSalesPrice.toString())} ETH
                  <br />
                  <span>Total Number of sales (all): </span>
                  ${data.information.numberOfSoldNFTs} NFTs
                  <br />
                  <span>Target of NFT sales per day: </span>
                  ${data.information.dailyNFTSellTarget} NFTs
                  <br />
                  <span>Average number of daily sales (all): </span>
                  ${(
                    data.information.numberOfSoldNFTs /
                    data.information.daysInSchedule
                  ).toFixed(2)}
                  <span> NFTs</span>
                  <span>Average number of daily sales (30 days): </span>
                  ${data.averages.day30.toFixed(2)}
                  <span> NFTs</span>
                  <br />
                  <span>Price recommendation: </span>
                  ${ethers.utils.formatEther(data.price)} ETH
                  <br />
                  <p>
                    <b>Real prices from sales (1m)</b>
                    <br />
                    <br />
                  </p>
                  ${salesChart1m}
                  <br />
                  <p>
                    <b>NFT Minters (all)</b>
                    <br />
                    <br />
                    <b>Definition: </b>Shows how many addresses mint the Kiwi
                    News Pass per day.
                  </p>
                  ${mintersChartAll}
                  <p>
                    <b>NFT Minters (1m)</b>
                    <br />
                    <br />
                    <b>Definition: </b>Shows how many addresses mint the Kiwi
                    News Pass per day.
                  </p>
                  ${mintersChart1m}
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
