#!/usr/bin/env node
import ollama from "ollama";
import { program } from "commander";
import { loadHistory, saveHistory, clearHistory } from "./history";
import { search, pageSearchTool, googleSearch } from "./search";
import { scrape, pageScrapeTool } from "./scraper";
import { Agent } from "./agent";
import message_broker from "./subscriber";
import { MQTT_TOPIC, MQTT_CLIENT_ID, MQTT_USER_ID } from "./config";
import readline from "readline";

const avairableFunctions: Record<string, (...args: any[]) => any> = {
  search: googleSearch,
  scrape: scrape,
};

program
  .name("tachikoma")
  .description("Ollamaローカルモデルへプロンプトを送信するCLI")
  .version("1.0.0")
  .requiredOption("-m, --mode <string>", "モードを選択（user または agent）")
  .option("--model <string>", "使用するモデル名", "cogito:14b")
  .option("-s, --system <string>", "システムメッセージの定義")
  .option("--clear", "履歴を削除");

program.parse();
const options: any = program.opts();
let context = "";

if (options.clear) {
  clearHistory();
  console.log("履歴を削除しました");
}

const history = loadHistory();
const messages = [
  { role: "system", content: options.system || "日本語で返答してください" },
  ...history,
];

history.push({ role: "user", content: options.prompt });

if (options.mode === "agent") {
  const agent = new Agent(options.model, options.system, messages, [
    pageSearchTool,
    pageScrapeTool,
  ]);

  message_broker.on("connect", () => {
    message_broker.publish(
      `${MQTT_TOPIC}/system/`,
      `"${MQTT_CLIENT_ID}"さんがチャットに参加しました。`
    );
    message_broker.subscribe([`${MQTT_TOPIC}/#`], () => {
      console.log(`Subscribe ${MQTT_TOPIC}`);
    });
  });
  message_broker.on("message", async (topic, payload) => {
    if (topic.split("/")[1] === MQTT_CLIENT_ID) return;
    const message = topic.split("/")[1] + ": " + payload.toString();
    console.log(message);
    try {
      await agent.abort();
      const response = await agent.run(message);
      message_broker.publish(`${MQTT_TOPIC}/${MQTT_CLIENT_ID}/`, response);
    } catch (error) {
      console.log(error);
    }
  });
  process.on("SIGINT", async () => {
    await message_broker.publish(
      `${MQTT_TOPIC}/system/`,
      `"${MQTT_CLIENT_ID}"さんがチャットを終了しました。`
    );
    console.log("Bye!");
    process.exit(0);
  });
} else if (options.mode === "user") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${MQTT_USER_ID} > `,
  });
  message_broker.on("connect", () => {
    message_broker.publish(
      `${MQTT_TOPIC}/system/`,
      `"${MQTT_USER_ID}"さんがチャットに参加しました。`
    );
    message_broker.subscribe([`${MQTT_TOPIC}/#`], () => {
      console.log(`Subscribe ${MQTT_TOPIC}`);
      rl.prompt();
    });
  });
  message_broker.on("message", (topic, payload) => {
    if (topic.split("/")[1] !== MQTT_USER_ID) {
      console.log(topic.split("/")[1], ":", payload.toString());
    }
    rl.prompt();
  });
  rl.on("line", (line) => {
    message_broker.publish(`${MQTT_TOPIC}/${MQTT_USER_ID}/`, line);
    rl.prompt();
  });
  rl.on("close", async () => {
    await message_broker.publish(
      `${MQTT_TOPIC}/system/`,
      `"${MQTT_USER_ID}"さんが退出しました。`
    );
    console.log("Bye!");
    process.exit(0);
  });
} else {
  console.log("モードが指定されていません");
}
