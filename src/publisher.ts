import {
  MQTT_TOPIC,
} from "./config";
import client from "./subscriber";

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
    description: `Publish a message and ask the other agent to do something via MQTT broker. The topic is the topic of the message and the payload is the message. The topic should be in the format “a2a/${MQTT_TOPIC}/{agent_id}/{version}/{role}/{phase}/{context_id}”.`,
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