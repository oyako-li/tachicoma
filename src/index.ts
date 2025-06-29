#!/usr/bin/env node
import ollama from "ollama";
import { program } from "commander";
import { loadHistory, saveHistory, clearHistory } from "./history";
import { search, pageSearchTool, googleSearch } from "./search";
import { scrape, pageScrapeTool } from "./scraper";
import { recall, recallTool } from "./archiver";
import { Agent, Conscious } from "./agent";
import message_broker from "./subscriber";
import { MQTT_TOPIC, MQTT_CLIENT_ID, MQTT_USER_ID, PROCESS_ID } from "./config";
import readline from "readline";

const avairableFunctions: Record<string, (...args: any[]) => any> = {
  search: googleSearch,
  scrape: scrape,
  recall: recall,
};

program
  .name("tachikoma")
  .description("Ollamaローカルモデルへプロンプトを送信するCLI")
  .version("1.0.0")
  .requiredOption("-m, --mode <string>", "モードを選択（user または agent）")
  .option("--model <string>", "使用するモデル名", "cogito:14b")
  .option("-s, --system <string>", "システムメッセージの定義")
  .option("-n, --name <string>", "名前", "tachikoma")
  .option("--clear", "履歴を削除");

program.parse();
const options: any = program.opts();

if (options.clear) {
  clearHistory();
  console.log("履歴を削除しました");
}

const name = options.mode === "user" ? options.name : options.name+ "-" + PROCESS_ID;

const history = loadHistory();
const messages = [
  { role: "system", content: `あなたは${name}です。${options.system || "日本語で返答してください"}` },
  ...history,
];


if (options.mode === "conscious") {
  const agent = new Conscious(options.model, options.system, messages, [
    pageSearchTool,
    pageScrapeTool,
    recallTool,
  ]);

  message_broker.on("connect", () => {
    const topics = [`a2a/${MQTT_TOPIC}/#`, `a2a/system/#`];
    message_broker.publish(
      `a2a/system/INFO/`,
      `"${name}"さんがチャットに参加しました。`
    );
    message_broker.subscribe(topics, () => {
      console.log(`Subscribe ${topics}`);
    });
  });
  message_broker.on("message", async (topic, payload) => {
    if (topic.split("/")[2] === name) return;
    const message = topic.split("/")[2] + ": " + payload.toString();
    console.log(message);
    try {
      await agent.abort();
      const response = await agent.run(message);
      message_broker.publish(`a2a/${MQTT_TOPIC}/${name}/INFO/`, response);
    } catch (error) {
      // AbortErrorだけ無視
      if (error && typeof error === "object" && "name" in error && (error as any).name === "AbortError") {
        // 何もしない（ログだけ出すならconsole.log(error);）
        console.log(error);
      } else {
        message_broker.publish(`a2a/${MQTT_TOPIC}/${name}/ERROR/`, (error as Error).toString());
      }
    }
  });
  process.on("SIGINT", async () => {
    await message_broker.publish(
      `a2a/system/INFO/`,
      `"${name}"さんがチャットを終了しました。`
    );
    console.log("Bye!");
    process.exit(0);
  });
} else if (options.mode === "agent") {
  const agent = new Agent(options.model, options.system, messages, [
    pageSearchTool,
    pageScrapeTool,
    recallTool,
  ]);

  message_broker.on("connect", () => {
    const topics = [`a2a/${MQTT_TOPIC}/#`, `a2a/system/#`];

    message_broker.publish(
      `a2a/system/INFO/`,
      `"${name}"さんがチャットに参加しました。`
    );
    message_broker.subscribe(topics, () => {
      console.log(`Subscribe ${topics}`);
    });
  });
  message_broker.on("message", async (topic, payload) => {
    if (topic.split("/")[2] === name) return;
    const message = topic.split("/")[2] + ": " + payload.toString();
    console.log(message);
    try {
      await agent.abort();
      const response = await agent.run(message);
      message_broker.publish(`a2a/${MQTT_TOPIC}/${name}/INFO/`, response);
    } catch (error) {
      // AbortErrorだけ無視
      if (error && typeof error === "object" && "name" in error && (error as any).name === "AbortError") {
        // 何もしない（ログだけ出すならconsole.log(error);）
        console.log(error);
      } else {
        message_broker.publish(`a2a/${MQTT_TOPIC}/${name}/ERROR/`, (error as Error).toString());
      }
    }
  });
  process.on("SIGINT", async () => {
    await message_broker.publish(
      `a2a/system/INFO/`,
      `"${name}"さんがチャットを終了しました。`
    );
    console.log("Bye!");
    process.exit(0);
  });
} else if (options.mode === "user") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${name} > `,
  });
  message_broker.on("connect", () => {
    message_broker.publish(
      `a2a/system/INFO/`,
      `"${name}"さんがチャットに参加しました。`
    );
    const topics = [`a2a/${MQTT_TOPIC}/ADMIN/`, `a2a/system/#`];
    message_broker.subscribe(topics, () => {
      console.log(`Subscribe ${topics}`);
      rl.prompt();
    });
  });
  message_broker.on("message", (topic, payload) => {
    if (topic.split("/")[2] !== name) {
      console.log(topic.split("/")[2], ":", payload.toString());
    }
    rl.prompt();
  });
  rl.on("line", (line) => {
    message_broker.publish(`a2a/${MQTT_TOPIC}/${name}/ADMIN/`, line);
    rl.prompt();
  });
  rl.on("close", async () => {
    await message_broker.publish(
      `a2a/system/INFO/`,
      `"${name}"さんが退出しました。`
    );
    console.log("Bye!");
    process.exit(0);
  });
} else {
  console.log("モードが指定されていません");
}
