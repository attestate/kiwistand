import { env } from "process";
import path from "path";

import {
  startOfWeek,
  getISOWeek,
  parseISO,
  differenceInDays,
  differenceInSeconds,
  add,
  sub,
  format,
} from "date-fns";
import { plot } from "svg-line-chart";
import htm from "htm";
import vhtml from "vhtml";
import ethers from "ethers";
import { fetchBuilder, FileSystemCache } from "node-fetch-cache";

import Header from "./views/components/header.mjs";
import Footer from "./views/components/footer.mjs";
import Sidebar from "./views/components/sidebar.mjs";
import Head from "./views/components/head.mjs";
import * as registry from "./chainstate/registry.mjs";
import * as ens from "./ens.mjs";

const { BigNumber } = ethers;
const html = htm.bind(vhtml);
const fetch = fetchBuilder.withCache(
  new FileSystemCache({
    cacheDirectory: path.resolve(env.CACHE_DIR),
    ttl: 86400000, // 24 hours
  }),
);

function takeMedian(incomeData) {
  const incomes = incomeData.map(({ income }) => income).sort((a, b) => a - b);
  const mid = Math.floor(incomes.length / 2);
  return incomes.length % 2 !== 0
    ? incomes[mid]
    : (incomes[mid - 1] + incomes[mid]) / 2;
}

function calcMonthlyIncome(transactions) {
  const incomeByMonth = transactions.reduce((acc, { timestamp, valueEUR }) => {
    const month = format(new Date(timestamp), "MMMM yyyy");
    if (!acc[month]) {
      acc[month] = { month, income: 0, nftSold: 0, averagePrice: 0 };
    }
    acc[month].income += valueEUR;
    acc[month].nftSold += 1;
    acc[month].averagePrice = acc[month].income / acc[month].nftSold;
    return acc;
  }, {});

  return Object.values(incomeByMonth);
}

export function extractDateAndOpen(csvData) {
  const lines = csvData.split("\n");
  const dataObject = lines.slice(1).reduce((acc, line) => {
    const [date, open] = line.split(",");
    if (open && open !== "null") {
      acc[date] = parseFloat(open);
    }
    return acc;
  }, {});
  return dataObject;
}

export async function fetchEURPrice(date) {
  const url =
    "https://raw.githubusercontent.com/attestate/eth-eur-historical-price-data/main/data.csv";

  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch data");
  return response.text();
}

// NOTE: Inspired by: https://www.paradigm.xyz/2022/08/vrgda
export function getPrice(salesData, today = new Date()) {
  const firstDayInScheduleUnixTime = 1709247600; // 2024-03-01
  const firstDayInSchedule = new Date(
    1000 * parseInt(firstDayInScheduleUnixTime),
  );
  const mints = salesData
    .map((mint) => {
      const timestamp = new Date(1000 * parseInt(mint.timestamp, 16));
      return {
        ...mint,
        timestamp,
        day: differenceInDays(timestamp, today),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((elem) => elem.timestamp > firstDayInSchedule);
  const daysInSchedule = differenceInDays(today, firstDayInSchedule); // t

  const dailyNFTSellTarget = 2.09;
  const numberOfSoldNFTs = mints.length; // n

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
    price: BigNumber.from("3000000000000"),
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

export async function getOnchainPrice() {
  const address = "0x66747bdc903d17c586fa09ee5d6b54cc85bbea45";
  const abi = [
    {
      inputs: [],
      name: "saleDetails",
      outputs: [
        {
          components: [
            { internalType: "bool", name: "publicSaleActive", type: "bool" },
            { internalType: "bool", name: "presaleActive", type: "bool" },
            {
              internalType: "uint256",
              name: "publicSalePrice",
              type: "uint256",
            },
            { internalType: "uint64", name: "publicSaleStart", type: "uint64" },
            { internalType: "uint64", name: "publicSaleEnd", type: "uint64" },
            { internalType: "uint64", name: "presaleStart", type: "uint64" },
            { internalType: "uint64", name: "presaleEnd", type: "uint64" },
            {
              internalType: "bytes32",
              name: "presaleMerkleRoot",
              type: "bytes32",
            },
            {
              internalType: "uint256",
              name: "maxSalePurchasePerAddress",
              type: "uint256",
            },
            { internalType: "uint256", name: "totalMinted", type: "uint256" },
            { internalType: "uint256", name: "maxSupply", type: "uint256" },
          ],
          internalType: "struct IERC721Drop.SaleDetails",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];
  const provider = new ethers.providers.JsonRpcProvider(
    env.OPTIMISM_RPC_HTTP_HOST,
  );

  const contract = new ethers.Contract(address, abi, provider);
  const saleDetails = await contract.saleDetails();
  return saleDetails.publicSalePrice;
}

export async function getReferralReward(mints) {
  const website = await getPrice(mints);
  const onchain = await getOnchainPrice();
  const referralReward = (website.price - onchain) / 2;
  const referralRewardEth = parseFloat(
    ethers.utils.formatEther(referralReward.toString()),
  ).toFixed(4);

  const percentageOff = BigNumber.from(referralReward)
    .mul(100)
    .div(website.price);
  return {
    reward: referralRewardEth,
    percentageOff,
  };
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

  const prices = await fetchEURPrice(today);
  const opensPerDay = extractDateAndOpen(prices);

  const saleData = mints.map(({ timestamp, value }) => {
    const parsedTimestamp = new Date(1000 * parseInt(timestamp, 16));
    const valueETH = ethers.utils.formatEther(value);
    const ETHEUR = opensPerDay[format(parsedTimestamp, "MM/dd/yyyy")];

    return {
      timestamp: parsedTimestamp,
      valueETH,
      valueEUR: valueETH * ETHEUR,
    };
  });
  const monthlyIncome = calcMonthlyIncome(saleData);
  const medianMonthlyIncome = takeMedian(monthlyIncome);

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
                  <br />
                  <span>Average number of daily sales (30 days): </span>
                  ${data.averages.day30.toFixed(2)}
                  <span> NFTs</span>
                  <br />
                  <span>Server's price recommendation: </span>
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
                  <p>
                    <b>EUR income from NFT mints</b>
                    <br />
                    <br />
                    <b>Definition:</b> Calculates the EUR income from all mints
                    over the last year and shows it on a monthly basis.
                  </p>
                  <table>
                    <thead>
                      <tr style="text-align: left;">
                        <th>Month</th>
                        <th>Income (EUR)</th>
                        <th>NFTs Sold</th>
                        <th>Average Price (EUR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${monthlyIncome.map(
                        ({ month, income, nftSold, averagePrice }) => html`
                          <tr>
                            <td>${month}</td>
                            <td>${income.toFixed(2)}</td>
                            <td>${nftSold}</td>
                            <td>${averagePrice.toFixed(2)}</td>
                          </tr>
                        `,
                      )}
                    </tbody>
                  </table>
                  <p>Median income (EUR): ${medianMonthlyIncome.toFixed(2)}</p>
                  <p>
                    <span>Yearly income (EUR): </span>
                    ${monthlyIncome
                      .reduce((sum, value) => sum + value.income, 0)
                      .toFixed(2)}
                  </p>
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
