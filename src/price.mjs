import { differenceInDays, differenceInHours, add, sub } from "date-fns";
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
export function getPrice(salesData, firstDayInSchedule, today = new Date()) {
  const firstPrice = BigNumber.from("1280000000000000"); // p0 in Wei

  const daysInSchedule = differenceInDays(today, firstDayInSchedule); // t
  const priceDecreasePercentage = 0.2; // k

  const mints = salesData
    .map((mint) => ({
      ...mint,
      timestamp: new Date(1000 * parseInt(mint.timestamp, 16)),
    }))
    .filter(
      ({ timestamp }) => timestamp > firstDayInSchedule && timestamp < today,
    );
  const dailyNFTSellTarget = 6;
  const numberOfSoldNFTs = mints.length; // n

  const exponent = daysInSchedule - numberOfSoldNFTs / dailyNFTSellTarget;
  const factor = Math.pow(1 - priceDecreasePercentage, exponent);

  // NOTE: If we're not scaling up the "factor" then we're losing all the
  // information contained in the decimals and so it can end up happening that
  // factor just becomes zero and so the price also becomes zero.
  const scaler = 100_000_000;
  const linear = firstPrice.mul(BigNumber.from(Math.floor(factor * scaler)));
  return linear.div(scaler);
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
  const firstDayInSchedule = sub(today, {
    months: 6,
  });
  const monthAgo = sub(today, {
    months: 1,
  });

  let pointer = add(firstDayInSchedule, { days: 1 });

  const dates = [];
  let prices = [];
  const mints = await registry.mints();
  while (differenceInDays(today, pointer) >= 0) {
    dates.push(pointer);
    prices.push(getPrice(mints, firstDayInSchedule, pointer));
    pointer = add(pointer, { days: 1 });
  }

  //console.log(dates);
  //console.log(JSON.stringify(prices.map((value) => value.toString())));
  prices = prices.map(
    (value) => parseFloat(ethers.utils.formatEther(value)) * 1000,
  );
  const dates1m = dates.filter((date) => date > monthAgo);
  const prices1m = prices.slice(dates1m.length * -1);

  options.yLabel.name = "Price in kilo ETH";
  options.xLabel.name = "";
  const priceChart6m = plot(html)(
    {
      x: dates,
      y: prices,
    },
    options,
  );
  const priceChart1m = plot(html)(
    {
      x: dates1m,
      y: prices1m,
    },
    options,
  );

  const salesData6m = mints
    .map((mint) => ({
      ...mint,
      parsedTimestamp: new Date(1000 * parseInt(mint.timestamp, 16)),
    }))
    .filter(
      ({ parsedTimestamp }) =>
        parsedTimestamp > firstDayInSchedule && parsedTimestamp < today,
    );
  const salesData1m = salesData6m.filter(
    ({ parsedTimestamp }) =>
      parsedTimestamp > monthAgo && parsedTimestamp < today,
  );
  const totalSalesValue = salesData6m.reduce(
    (total, sale) => total + parseInt(sale.value, 16),
    0,
  );

  // Calculate average sales price
  const averageSalesPrice = totalSalesValue / salesData6m.length;

  const mintersData6m = await calculateMintersPerDay(salesData6m);
  const mintersData1m = await calculateMintersPerDay(salesData1m);

  options.yLabel.name = "minters";
  options.xLabel.name = "";
  const mintersChart6m = plot(html)(
    {
      x: mintersData6m.dates.map((date) => new Date(date)),
      y: mintersData6m.minters,
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
                  <span>Total sales value (6m): </span>
                  ${ethers.utils.formatEther(totalSalesValue.toString())} ETH
                  <br />
                  <span>Average Sale Price (6m): </span>
                  ${ethers.utils.formatEther(averageSalesPrice.toString())} ETH
                  <br />
                  <span>Total Number of sales (6m): </span>
                  ${salesData6m.length} NFTs
                  <br />
                  <span>Average number of daily sales (6m) </span>
                  ${(salesData6m.length / 182).toFixed(2)} NFTs
                  <br />
                  <span>Price recommendation: </span>
                  ${prices.pop() / 1000} ETH
                  <br />
                  <p>
                    <b>NFT price simulation using VRGDA (6m)</b>
                    <br />
                    <br />
                  </p>
                  ${priceChart6m}
                  <p>
                    <b>NFT Minters (6m)</b>
                    <br />
                    <br />
                    <b>Definition: </b>Shows how many addresses mint the Kiwi
                    News Pass per day.
                  </p>
                  ${mintersChart6m}
                  <p>
                    <b>NFT price simulation using VRGDA (1m)</b>
                    <br />
                    <br />
                  </p>
                  ${priceChart1m}
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
