import mqtt from "mqtt";
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  MQTT_CLIENT_ID,
  MQTT_ENDPOINT,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC,
} from "./config";
import client from "./subscriber";
import { connect, Table } from "@lancedb/lancedb";
import ollama from "ollama";
import path from "path";
import { FixedSizeList, Field, Float32, Schema, Utf8, Timestamp, TimeUnit } from 'apache-arrow';

export function parseTopic(topic: string) {
  const levels = topic.split("/");
  const maxSafe = (i: number) => (levels.length > i ? levels[i] : "");
  // 例: a2a/{provider}/{agent_id}/{version}/{role}/{phase}/{context_id}
  return {
    topic: levels,
    protocol: maxSafe(0),
    provider: maxSafe(1),
    agent_id: maxSafe(2),
    status: maxSafe(3),
    role: maxSafe(4),
    phase: maxSafe(5),
    context_id: maxSafe(6),
  };
}

// Create schema
const schema = new Schema([
  new Field('topic', new Utf8(), true),
  new Field('protocol', new Utf8(), true),
  new Field('provider', new Utf8(), true),
  new Field('agent_id', new Utf8(), true),
  new Field('status', new Utf8(), true),
  new Field('role', new Utf8(), true),
  new Field('phase', new Utf8(), true),
  new Field('context_id', new Utf8(), true),
  new Field('payload', new Utf8(), true),
  new Field('timestamp', new Timestamp(TimeUnit.MILLISECOND, 'Asia/Tokyo'), true),
  new Field('embedding', new FixedSizeList(1024, new Field('item', new Float32())), true),
]);

class Archive {
  private table: Table|null = null;
  private table_name: string;

  constructor(table_name: string = "archive") {
    this.table_name = table_name;
  }

  async tbl(recreate: boolean = false) {
    if (!this.table) {
      const db = await connect(path.join(".lancedb", "archive"));
      if (recreate) {
        this.table = await db.createEmptyTable(this.table_name, schema, {
          mode: "overwrite",
        });
      }
      this.table = await db.openTable(this.table_name);
    }
    return this.table;
  }

  async embed(text: string) {
    const embedding = await ollama.embed({
      model: "mxbai-embed-large",
      input: text,
    });
    return embedding;
  }
}
const ar = new Archive("archive");

export async function recall({query, limit=10}: {query: string, limit: number}): Promise<any[]> {
  const tbl = await ar.tbl();
  const embedding = await ar.embed(query);
  const results = await tbl.search(embedding.embeddings[0]).select(["agent_id", "role", "status", "payload", "timestamp"]).limit(limit).toArray();
  return results;
}

export const recallTool = {
  type: "function",
  function: {
    name: "recall",
    description: "Search past messages from the archive",
    parameters: {
      type: "object",
      required: ["query", "limit"],
      properties: {
        query: { type: "string", description: "search query" },
        limit: { type: "number", description: "Maximum number of search results" },
      },
    },
  },
};

export default client;

if (require.main === module) {

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  // 静的ファイルの提供
  app.use(express.static('public'));
  // Socket.IO接続の処理
  io.on('connection', (socket) => {    
    // MQTTメッセージ送信リクエストの処理
    socket.on('send-mqtt-message', async (data) => {
      try {
        const { topic, payload, qos = 0 } = data;
        
        if (!topic || !payload) {
          socket.emit('mqtt-send-error', { error: 'トピックとペイロードは必須です' });
          return;
        }
        
        // MQTTメッセージを送信
        client.publish(topic, payload, { qos }, (error) => {
          if (error) {
            socket.emit('mqtt-send-error', { error: error.message });
          } else {
            socket.emit('mqtt-send-success', { topic, payload });
          }
        });
        
      } catch (error) {
        socket.emit('mqtt-send-error', { error: 'メッセージ送信に失敗しました' });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('disconnect', socket.id);
    });
  });

  const topics = [
    `a2a/${MQTT_TOPIC}/#`,
    `a2a/system/#`,
  ];
  client.on("connect", async() => {
    const tbl = await ar.tbl(true);
    client.subscribe(topics, () => {
      console.log(`Subscribe ${topics}`);
    });
    client.on("message", async (topic, payload) => {
      const topics = parseTopic(topic);
      const embedding = await ar.embed(payload.toString());
      const data = { 
        payload: payload.toString(),
        topic: topic,
        protocol: topics.protocol,
        provider: topics.provider,
        agent_id: topics.agent_id,
        status: topics.status,
        role: topics.role,
        phase: topics.phase,
        context_id: topics.context_id,
        timestamp: Date.now(),
        embedding: embedding.embeddings[0],
      }
      console.log(data);
      await tbl.add([data]);
      io.emit('mqtt-message', data);
    });
  });
  // サーバー起動
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
  });
}