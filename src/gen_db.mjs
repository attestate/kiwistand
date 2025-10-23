import { boot as crawl } from "@attestate/crawler";
import delegateCrawlPath from "./chainstate/delegate.config.crawler.mjs";

crawl(delegateCrawlPath);