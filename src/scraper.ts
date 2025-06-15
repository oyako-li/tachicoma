import axios from "axios";
import { load } from "cheerio";

export async function scrape(url: string): Promise<string> {
  const res = await axios.get(url);
  const $ = load(res.data);
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000); // 長すぎるとOllamaがエラーに
}

export const pageScrapeTool = {
  type: "function",
  function: {
    name: "scrape",
    description: "Scrape the web page",
    parameters: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "The URL to scrape" },
      },
    },
  },
};
