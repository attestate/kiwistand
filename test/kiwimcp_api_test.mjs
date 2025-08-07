import test from "ava";
import fetch from "node-fetch";
import { spawn } from "child_process";
import { promisify } from "util";

const sleep = promisify(setTimeout);

const API_URL = "https://news.kiwistand.com";

async function callAPI(endpoint, params = {}, options = {}) {
  const { method = "GET", body = null } = options;
  const url = new URL(`${API_URL}${endpoint}`);
  
  if (method === "GET") {
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
  }
  
  const fetchOptions = {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "kiwimcp-test/1.0.0"
    }
  };
  
  if (body) {
    fetchOptions.body = JSON.stringify(body || params);
  }
  
  const response = await fetch(url.toString(), fetchOptions);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return data;
}

test("search-content endpoint works", async (t) => {
  const query = "ethereum";
  const result = await callAPI("/api/v1/search", {}, {
    method: "POST",
    body: { query, sort: "new" }
  });
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    t.true(Array.isArray(result.data.stories || result.data));
  } else {
    t.true(Array.isArray(result.stories || result));
  }
});

test("get-feed endpoint returns hot feed", async (t) => {
  const result = await callAPI("/api/v1/feeds/hot", { page: 0 });
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    t.true(Array.isArray(result.data.stories || result.data));
  } else {
    t.true(Array.isArray(result.stories || result));
  }
});

test("get-feed endpoint returns new feed", async (t) => {
  const result = await callAPI("/api/v1/feeds/new", { page: 0 });
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    t.true(Array.isArray(result.data.stories || result.data));
  } else {
    t.true(Array.isArray(result.stories || result));
  }
});

test("get-feed endpoint returns best feed with period", async (t) => {
  const result = await callAPI("/api/v1/feeds/best", { 
    page: 0,
    period: "week"
  });
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    t.true(Array.isArray(result.data.stories || result.data));
  } else {
    t.true(Array.isArray(result.stories || result));
  }
});

test("get-story endpoint returns story details", async (t) => {
  // First get a story from the feed
  const feedResult = await callAPI("/api/v1/feeds/hot", { page: 0 });
  let stories;
  
  if (feedResult.status === "success") {
    stories = feedResult.data.stories || feedResult.data;
  } else {
    stories = feedResult.stories || feedResult;
  }
  
  if (stories && stories.length > 0 && stories[0].index) {
    const storyIndex = stories[0].index;
    const result = await callAPI("/api/v1/stories", { index: storyIndex });
    
    t.truthy(result);
    if (result.status === "success") {
      t.is(result.status, "success");
      t.truthy(result.data);
      const story = result.data.story || result.data;
      t.truthy(story);
      t.truthy(story.index);
    } else {
      const story = result.story || result;
      t.truthy(story);
    }
  } else {
    t.pass("No stories available to test");
  }
});

test("get-url-metadata endpoint extracts metadata", async (t) => {
  const testUrl = "https://ethereum.org";
  const result = await callAPI("/api/v1/metadata", { 
    url: testUrl,
    generateTitle: false 
  });
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    const metadata = result.data;
    t.truthy(metadata.title || metadata.ogTitle || metadata.twitterTitle);
  } else {
    t.truthy(result.title || result.ogTitle || result.twitterTitle);
  }
});

test("parse-url endpoint creates embed", async (t) => {
  const testUrl = "https://twitter.com/VitalikButerin/status/1737133819626913857";
  const result = await callAPI("/api/v1/parse", { url: testUrl });
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    const embed = result.data.embed || result.data;
    t.truthy(embed);
  } else {
    const embed = result.embed || result;
    t.truthy(embed);
  }
});

test("get-user-profile endpoint returns profile data", async (t) => {
  // Use a known address (Vitalik's address)
  const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const result = await callAPI(`/api/v1/profile/${address}`);
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    const profile = result.data;
    t.truthy(profile.address || profile.identity);
  } else {
    t.truthy(result.address || result.identity || result.ens);
  }
});

test("get-user-activity endpoint returns activity feed", async (t) => {
  // Use a test address
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const result = await callAPI("/api/v1/activity", { address });
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    t.true(Array.isArray(result.data.notifications || result.data));
  } else {
    t.true(Array.isArray(result.notifications || result) || typeof result === "object");
  }
});

test("get-kiwi-price endpoint returns price info", async (t) => {
  const result = await callAPI("/api/v1/price");
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    const price = result.data;
    t.truthy(price.price !== undefined || price.usd !== undefined || price.eth !== undefined);
  } else {
    t.truthy(result.price !== undefined || result.usd !== undefined || result.eth !== undefined);
  }
});

test("get-top-karma-holders endpoint returns karma rankings", async (t) => {
  const result = await callAPI("/api/v1/karma/top", { limit: 5, offset: 0 });
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    t.true(Array.isArray(result.data.holders));
    t.truthy(result.data.total);
    if (result.data.holders.length > 0) {
      const holder = result.data.holders[0];
      t.truthy(holder.identity);
      t.truthy(holder.karma !== undefined);
      t.truthy(holder.rank !== undefined);
    }
  } else {
    t.fail("Expected success response for karma endpoint");
  }
});

test("get-user-karma endpoint returns specific user karma", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const result = await callAPI(`/api/v1/karma/${address}`);
  
  t.truthy(result);
  if (result.status === "success") {
    t.is(result.status, "success");
    t.truthy(result.data);
    t.truthy(result.data.address);
    t.truthy(result.data.karma !== undefined);
  } else {
    t.fail("Expected success response for user karma endpoint");
  }
});