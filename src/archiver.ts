import mqtt from "mqtt";
import { logger } from "./logger";
import {
  MQTT_CLIENT_ID,
  MQTT_ENDPOINT,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC,
} from "./config";

export const subscribe_client = mqtt.connect(MQTT_ENDPOINT, {
  clientId: MQTT_CLIENT_ID + "-archiver",
  clean: true,
  connectTimeout: 4000,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  reconnectPeriod: 1000,
});
if (require.main === module) {
  const logging = logger("log");
  const datalog = logger("data");
  const topic = `${MQTT_TOPIC}/#`;
  subscribe_client.on("connect", () => {
    subscribe_client.subscribe([topic], () => {
      console.log(`Subscribe ${topic}`);
    });
  });
  subscribe_client.on("message", (topic, payload) => {
    if (topic.startsWith(`${MQTT_TOPIC}/DATA/`)) {
      datalog(topic, payload);
    } else {
      logging(topic, payload);
    }
  });
}
export default subscribe_client;