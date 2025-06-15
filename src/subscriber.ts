import mqtt from "mqtt";
import {
  MQTT_CLIENT_ID,
  MQTT_ENDPOINT,
  MQTT_USERNAME,
  MQTT_PASSWORD,
} from "./config";

export const client = mqtt.connect(MQTT_ENDPOINT, {
  clientId: MQTT_CLIENT_ID,
  clean: true,
  connectTimeout: 4000,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  reconnectPeriod: 1000,
});

export default client;
