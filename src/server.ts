import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mqtt from 'mqtt';
import { logger } from './logger';
import {
  MQTT_CLIENT_ID,
  MQTT_ENDPOINT,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC,
} from './config';
import { parseTopic } from './archiver';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// MQTTクライアントの設定
const mqttClient = mqtt.connect(MQTT_ENDPOINT, {
  clientId: MQTT_CLIENT_ID + "-server",
  clean: true,
  connectTimeout: 4000,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  reconnectPeriod: 1000,
});

// 静的ファイルの提供
app.use(express.static('public'));

// Socket.IO接続の処理
io.on('connection', (socket) => {
  logger()('INFO', 'クライアントが接続しました:', socket.id);
  
  // MQTTメッセージ送信リクエストの処理
  socket.on('send-mqtt-message', async (data) => {
    try {
      const { topic, payload, qos = 0 } = data;
      
      if (!topic || !payload) {
        socket.emit('mqtt-send-error', { error: 'トピックとペイロードは必須です' });
        return;
      }
      
      // MQTTメッセージを送信
      mqttClient.publish(topic, payload, { qos }, (error) => {
        if (error) {
          logger()('ERROR', 'MQTTメッセージ送信エラー:', error);
          socket.emit('mqtt-send-error', { error: error.message });
        } else {
          logger()('INFO', 'MQTTメッセージ送信成功:', { topic, payload });
          socket.emit('mqtt-send-success', { topic, payload });
        }
      });
      
    } catch (error) {
      logger()('ERROR', 'メッセージ送信処理エラー:', error);
      socket.emit('mqtt-send-error', { error: 'メッセージ送信に失敗しました' });
    }
  });
  
  socket.on('disconnect', () => {
    logger()('INFO', 'クライアントが切断されました:', socket.id);
  });
});

// MQTT接続とメッセージ処理
mqttClient.on('connect', () => {
  logger()('INFO', 'MQTTサーバーに接続しました');
  const topic = `a2a/${MQTT_TOPIC}/#`;
  mqttClient.subscribe([topic], () => {
    logger()('INFO', `トピック ${topic} を購読開始`);
  });
});

mqttClient.on('message', (topic, payload) => {
  try {
    const topics = parseTopic(topic);
    const messageData = {
      topic: topic,
      protocol: topics.protocol,
      provider: topics.provider,
      agent_id: topics.agent_id,
      status: topics.status,
      role: topics.role,
      phase: topics.phase,
      context_id: topics.context_id,
      payload: payload.toString(),
      timestamp: new Date().toISOString(),
    };
    
    logger()('INFO', 'MQTTメッセージを受信:', messageData);
    
    // フロントエンドにプッシュ通知を送信
    io.emit('mqtt-message', messageData);
    
  } catch (error) {
    logger()('ERROR', 'MQTTメッセージ処理エラー:', error);
  }
});

mqttClient.on('error', (error) => {
  logger()('ERROR', 'MQTT接続エラー:', error);
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger()('INFO', `サーバーがポート ${PORT} で起動しました`);
});

export { app, io, mqttClient }; 