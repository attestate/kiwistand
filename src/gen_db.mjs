import { boot as crawl } from "@attestate/crawler";
import mintCrawlPath from "./chainstate/mint.config.crawler.mjs";
import delegateCrawlPath from "./chainstate/delegate.config.crawler.mjs";

crawl(mintCrawlPath);
crawl(delegateCrawlPath);