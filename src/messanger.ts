import { program } from "commander";
import mqtt from "mqtt";
import {
  MQTT_CLIENT_ID,
  MQTT_ENDPOINT,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC_PREFIX,
} from "./config";
import { ChatMessage } from "./types";

export const client = mqtt.connect(MQTT_ENDPOINT, {
  clientId: MQTT_CLIENT_ID,
  clean: true,
  connectTimeout: 4000,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  reconnectPeriod: 1000,
});

export const topic_parser = (topic: string) => {
  const template = MQTT_TOPIC_PREFIX.replace(/\/$/, ""); // 最後のスラッシュ除去
  const keys = template.split("/").map(part =>
    part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : null
  );

  const values = topic.split("/");

  const result: Record<string, string> = {};
  keys.forEach((key, index) => {
    if (key) {
      result[key] = values[index];
    }
  });

  return result;
};

export const payload_parser = (payload: string) => {
  const parsed = JSON.parse(payload);
  
  // context_idsが文字列として送信されている場合、string[]に戻す
  if (parsed.context_ids && typeof parsed.context_ids === 'string') {
    try {
      parsed.context_ids = JSON.parse(parsed.context_ids) as string[];
    } catch (error) {
      console.warn('Failed to parse context_ids string:', error);
      parsed.context_ids = [];
    }
  }
  
  return parsed as ChatMessage;
};

export async function publish({topic, payload}: {topic: string, payload: string}): Promise<{status: string, message: string}> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, (error) => {
      if (error) {
        reject({
          status: "error",
          message: `Failed to publish message to ${topic}: ${error.message}`,
        });
      } else {
        resolve({
          status: "success",
          message: `Message published to ${topic}: ${payload}`,
        });
      }
    });
  });
}

export const publishTool = {
  type: "function",
  function: {
    name: "publish",
    description: `Publish a message and ask the other agent to do something via MQTT broker. The topic is the topic of the message and the payload is the message. The topic should be in the format “${MQTT_TOPIC_PREFIX}”.`,
    parameters: {
      type: "object",
      required: ["topic", "payload"],
      properties: {
        topic: { type: "string", description: "topic" },
        payload: { type: "string", description: "payload" },
      },
    },
  },
};

export default client;

if (require.main === module) {
  program
    .name("tachicoma-messanger")
    .description("Messanger for Tachicoma")
    .version("1.0.0")
    .requiredOption("-m, --mode <string>", "モードを選択（publish または subscribe）")
    .option("-t, --topic <string>", "トピック", MQTT_TOPIC_PREFIX)
    .option("-p, --payload <string>", "ペイロード", "{}");

  program.parse();
  const options: any = program.opts();
  if (options.mode === "publish") {
    client.publish(options.topic, options.payload, (error) => {
      if (error) {
        console.error("Failed to publish message", error);
      } else {
        console.log("Message published");
      }
      client.end();
    });
  } else if (options.mode === "subscribe") {
    client.subscribe(options.topic, (topic, payload) => {
      console.log(topic, payload);
    });
  }
}