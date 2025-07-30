#!/usr/bin/env node
import { program } from "commander";
import { pageSearchTool } from "./search";
import { pageScrapeTool } from "./scraper";
import { Agent } from "./agent";
import { PROCESS_ID, MODEL_NAME, MQTT_TOPIC } from "./config";
import { User } from "./user";
import fs from "fs";
import { ChatMessage } from "./types";
import { Archive } from "./archiver";
import { message_schema, agent_master_schema } from "./schema";
import { client, topic_parser, payload_parser } from "./messanger";
import { SystemMessage, ArchiveMessage } from "./types";
import { io, server } from "./server";

program
  .name("tachikoma")
  .description("Agent Prompt")
  .version("1.1.0")
  .requiredOption("-m, --mode <string>", "モードを選択（user または agent）")
  .option("--model <string>", "使用するモデル名", MODEL_NAME)
  .option("-s, --system <string>", "システムメッセージの定義")
  .option("-p, --system_prompt <path>", "システムメッセージのパス")
  .option("-n, --name <string>", "名前", "tachikoma")
  .option("--clear", "履歴を削除")
  .option("--topic <string>", "トピック", MQTT_TOPIC)
  .option("--message <string>", "メッセージ");

program.parse();
const options: any = program.opts();

if (options.system_prompt) {
  const system_prompt = fs.readFileSync(options.system_prompt, "utf-8");
  options.system = system_prompt;
}

const name = options.mode === "user" ? options.name : options.name+ "-" + PROCESS_ID;
const messages: ChatMessage[] = [];
const mode = options.mode;

switch (mode) {
  case "agent":
    const topics_agent = [
      `a2a/${MQTT_TOPIC}/#`,
      `a2a/system/#`,
    ];
    const agent = new Agent(name, options.model, `あなたは${name}です。${options.system || "日本語で返答してください"}`, messages, [
      pageSearchTool,
      pageScrapeTool,
      // recallTool,
    ]);
    agent.listen(topics_agent);
    process.on("SIGINT", async () => {
      agent.close();
    });
    break;
  case "user":
    const user = new User(name);
    user.listen([`a2a/${MQTT_TOPIC}/#`]);
    process.on("SIGINT", async () => {
      user.close();
    });
    break;
  case "archive":
    const ar = new Archive("archive", message_schema);
    const am = new Archive("agent_master", agent_master_schema);
  
    const topics = [
      `a2a/${MQTT_TOPIC}/#`,
      `a2a/system/#`,
    ];
    client.on("connect", async() => {
      client.subscribe(topics, () => {
        console.log(`Subscribe ${topics}`);
      });
      client.on("message", async (topic, payload) => {
        if (topic.startsWith("a2a/system/")) {
          const tbl = await am.tbl();
          try {
            const data: SystemMessage = JSON.parse(payload.toString());
            console.log(topic, data);
            if (data.action === "join") {
              const roleToAdd = data.role;
              const speakerData = {
                speaker_id: data.speaker_id,
                model_name: data.model_name,
                status: "online",
                roles: [roleToAdd],
                score: 0.0,
                system_prompt: data.system_prompt,
                result: "",
                review: "",
                last_heartbeat: Date.now(),
              };
              
              // 既存のレコードを確認
              const existing = await tbl.query().where(`speaker_id = '${data.speaker_id}'`).limit(1).toArray();
              
              if (existing.length > 0) {
                // 既存のレコードがある場合、rolesに新しいroleを追加
                const existingRoles = existing[0].roles || [];
                const updatedRoles = [...existingRoles, roleToAdd];
                await tbl.update({
                  where: `speaker_id = '${data.speaker_id}'`,
                  values: { roles: updatedRoles, status: "online" }
                });
              } else {
                // 新しいレコードの場合、rolesを配列として作成
                await tbl.mergeInsert("speaker_id").whenNotMatchedInsertAll().execute([speakerData]);
              }
            } else if (data.action === "leave") {
              delete data.action;
              delete data.content;
              await tbl.update({
                where: `speaker_id = '${data.speaker_id}'`,
                values: {status: "offline"}
              });
              console.log(`${data.speaker_id} left`);
            }
          } catch (error) {
            console.error(error);
          }
          return;
        } else if (topic.startsWith(`a2a/${MQTT_TOPIC}/`)) {
          const topics = topic_parser(topic);
          const parsedPayload = payload_parser(payload.toString());
          const data: ArchiveMessage = {
            payload: parsedPayload.content,
            topic: topic,
            protocol: topics?.protocol,
            provider: topics?.provider,
            speaker_id: topics?.speaker_id,
            status: topics?.status || "online",
            role: topics?.role,
            phase: topics?.phase,
            context_id: parsedPayload?.id,
            context_ids: parsedPayload?.context_ids || [],
            timestamp: Date.now(),
          }
          console.log(topic, data);
          const tbl = await ar.tbl();
          await tbl.add([data]);
          io.emit('mqtt-message', data);
        }
      });
    });
    // // サーバー起動
    // const PORT = process.env.PORT || 3000;
    // server.listen(PORT, () => {
    //   console.log(`monitoring server http://localhost:${PORT}/`);

    //   // Socket.IO接続の処理
    //   io.on('connection', (socket) => {    
    //     // MQTTメッセージ送信リクエストの処理
    //     socket.on('send-mqtt-message', async (data) => {
    //       try {
    //         const { topic, payload, qos = 0 } = data;
            
    //         if (!topic || !payload) {
    //           socket.emit('mqtt-send-error', { error: 'トピックとペイロードは必須です' });
    //           return;
    //         }
            
    //         // MQTTメッセージを送信
    //         client.publish(topic, payload, { qos }, (error) => {
    //           console.log(topic, payload, qos, error);
    //           if (error) {
    //             socket.emit('mqtt-send-error', { error: error.message });
    //           } else {
    //             socket.emit('mqtt-send-success', { topic, payload });
    //           }
    //         });
            
    //       } catch (error) {
    //         socket.emit('mqtt-send-error', { error: 'メッセージ送信に失敗しました' });
    //       }
    //     });
        
    //     socket.on('disconnect', () => {
    //       console.log('disconnect', socket.id);
    //     });
    //   });
    // });
    break;
  case "admin":
    const parsedPayload = payload_parser(options.message);
    client.publish(options.topic, JSON.stringify({
      ...parsedPayload,
      speaker_id: name,
    }), { qos: 2 }, () => {
      process.exit(0);
    });
    break;
  default:
    console.log("モードが指定されていません");
    break;
}