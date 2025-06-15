import { google } from "googleapis";
import { GOOGLE_API_KEY, GOOGLE_CSE_ID } from "./config";
import axios from "axios";

interface SearchArgs {
  query: string;
}

interface SearchResult {
  title: string;
  url: string;
}

/**
 * Google Custom Search APIを使ってクエリを検索する
 * @param query 検索クエリ
 * @returns 検索結果（items[]）
 */
export async function googleSearch(args: SearchArgs): Promise<any[]> {
  const customsearch = google.customsearch("v1");

  const res = await customsearch.cse.list({
    auth: GOOGLE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q: args.query,
  });
  console.log(`[search] ${args.query}`, res.data);

  if (!res.data.items) return [];
  return res.data.items;
}

export async function search(args: SearchArgs): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${args.query}&format=json&no_redirect=1`;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "ja,en;q=0.9",
  };

  const res = await axios.get(url, { headers });
  const results = res.data.RelatedTopics?.slice(0, 5).map((t: any) => ({
    title: t.Text,
    url: t.FirstURL,
  }));
  console.log(`[search] ${args.query}`, res.data);
  return results;
}

export const pageSearchTool = {
  type: "function",
  function: {
    name: "search",
    description: "Search the web for information",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "The query to search for" },
      },
    },
  },
};
