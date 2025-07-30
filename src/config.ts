import dotenv from "dotenv";
dotenv.config();

export const WEBHOOK_URL = process.env.WEBHOOK_URL;
export const MODEL_NAME = process.env.MODEL_NAME || "llama3.2";
export const HOSTNAME = process.env.HOSTNAME;
export const ARCHIVER_PORT = process.env.ARCHIVER_PORT || 3000;
export const MQTT_HOSTNAME = process.env.MQTT_HOSTNAME || "localhost";
export const MQTT_PORT = process.env.MQTT_PORT || "1883";
export const MQTT_USER_ID = process.env.MQTT_USER_ID;
export const PROCESS_ID = process.pid;
export const MQTT_CLIENT_ID = `${process.env.MQTT_CLIENT_ID}-${PROCESS_ID}`;
export const MQTT_ENDPOINT = `mqtt://${MQTT_HOSTNAME}:${MQTT_PORT}`;
export const MQTT_USERNAME = process.env.MQTT_USERNAME;
export const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
export const MQTT_TOPIC = process.env.MQTT_TOPIC;
export const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || "a2a/";
export const ARCHIVE_DIR = process.env.ARCHIVE_DIR || ".";

export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
export const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID!;
