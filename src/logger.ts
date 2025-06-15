import axios from "axios";
import { client } from "./subscriber";
import { WEBHOOK_URL, MQTT_TOPIC } from "./config";
import * as os from "os";
import * as fs from "fs";

export function formatDate(date: Date) {
  let year = date.getFullYear();
  let month = (date.getMonth() + 1).toString().padStart(2, "0");
  let day = date.getDate().toString().padStart(2, "0");
  let hours = date.getHours().toString().padStart(2, "0");
  let minutes = date.getMinutes().toString().padStart(2, "0");
  let seconds = date.getSeconds().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function logger(file: string = "log") {
  return function (topic: string, ...params: any[]) {
    const date = new Date();
    const path = `./.logs/${file}/${date.getFullYear()}-${date.getMonth() + 1}`;
    const now = `${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}-${date.getMilliseconds()}`;
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
    }
    fs.appendFileSync(
      `${path}/${date.getDate()}.log`,
      `[${now}]:${topic}, ${Array.from(params).join(", ")}\r\n`
    );
  };
}

export function post_log(data: any, callback = () => {}) {
  axios
    .post(WEBHOOK_URL as string, JSON.stringify(data), {
      withCredentials: false,
      headers: {
        "Content-Type": "application/json",
      },
      transformRequest: [
        (requestData, requestHeaders) => {
          // 必要に応じてheaders.postを初期化
          requestHeaders.post = requestHeaders.post || {};
          // Content-Type ヘッダーを削除する
          delete requestHeaders.post["Content-Type"];
          return requestData;
        },
      ],
    })
    .then((res) => {
      callback();
    })
    .catch((error) => {
      console.error(error);
      post_log(data, callback);
    });
  // mqtt_publisher.publish(`/raspai/${os.hostname()}/INFO`, JSON.stringify(data));
}

export function publishLog(level?: string) {
  return function () {
    const date = new Date();
    const now = `${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}-${date.getMilliseconds()}`;
    client.publish(
      `${MQTT_TOPIC}/${os.hostname()}/${level}`,
      `${now}, ${Array.from(arguments).join(", ")}`
    );
  };
}

export default logger;
