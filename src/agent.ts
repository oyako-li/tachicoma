import ollama, { Message } from "ollama";
import { googleSearch } from "./search";
import { scrape } from "./scraper";
import messanger, { topic_parser, publish, publishTool, payload_parser } from "./messanger";
import { SystemMessage, ChatMessage } from "./types";
import { MQTT_TOPIC, MODEL_NAME, MQTT_TOPIC_PREFIX } from "./config";
// import { recall } from "./archiver";

export const avairableFunctions: Record<string, (...args: any[]) => any> = {
  search: googleSearch,
  scrape: scrape,
  publish: publish,
  // recall: recall,
};

const sleep = (time: number) => new Promise((r) => setTimeout(r, time));//timeはミリ秒



export class Agent {
  /**
   * Agent 作ったら、その Agent のメモリを Archiver に保存する
   */
  private speaker_id: string;
  private model: string;
  private system_prompt: string;
  private tools: any[];
  public assistant_reply: string;
  private messages: ChatMessage[];
  private watch_list: string[];
  public thinking: any;
  public topic: string;
  private id: number;
  private isProcessing: boolean = false;
  private currentAbortController: AbortController | null = null;
  private shouldAbort: boolean = false;
  constructor(
    speaker_id: string,
    model: string,
    system_prompt: string,
    history: ChatMessage[] = [],
    tools: any[] = [],
    watch: string[] = []
  ) {
    const messages = [
      {
        id: this.generate_id(),
        role: "system",
        content: system_prompt,
        speaker_id: speaker_id,
        timestamp: Date.now(),
      },
      ...history,
    ];
    this.speaker_id = speaker_id;
    this.messages = messages;
    this.model = model;
    this.system_prompt = system_prompt;
    this.tools = tools;
    this.assistant_reply = "";
    this.shouldAbort = false;
    this.watch_list = []
    this.thinking = null;
    this.topic = MQTT_TOPIC_PREFIX.replace(
      "{command}", "INFO"
    ).replace(
      "{speaker_id}", this.speaker_id
    ).replace(
      "{role}", "assistant"
    ).replace(
      "{provider}", MQTT_TOPIC as string
    ).replace(
      "{protocol}", "a2a"
    );
    this.id = 0;
  }

  async listen(watch: string[] = []) {
    this.watch_list = watch;
    const messageHandler = async (topic: string, payload: Buffer) => {
      const parsedTopic = topic_parser(topic);
      const parsedPayload = payload_parser(payload.toString());
      
      if (parsedTopic.provider === MQTT_TOPIC) {
        if (parsedTopic.speaker_id !== this.speaker_id) {
          await this.run({
            id: parsedPayload.id, 
            role: "user", 
            content: parsedPayload.content, 
            speaker_id: parsedTopic.speaker_id, 
            timestamp: Date.now()
          });
        }
      } else if (parsedTopic.provider === "system") {
        switch (parsedTopic.command) {
          case "ABORT":
            await this.abort();
            break;
          case "KILL":
            await this.run({
              id: parsedPayload.id || this.generate_id(true), 
              role: "system", 
              content: parsedPayload.content, 
              speaker_id: "system", 
              timestamp: Date.now()
            });
            break;
          default:
            await this.run({
              id: parsedPayload.id || this.generate_id(true), 
              role: "system", 
              content: parsedPayload.content, 
              speaker_id: "system", 
              timestamp: Date.now()
            });
            break;
        }
      } else {
        console.log(topic, parsedPayload.id, parsedPayload.context_ids);
      }
    };

    messanger.on("connect", () => {
      console.log("Connect ", this.speaker_id);
      messanger.subscribe(this.watch_list, () => {
        console.log(`Subscribe ${this.watch_list}`);
        messanger.on("message", messageHandler);
      });
      const system_message: SystemMessage = {
        id: this.generate_id(true),
        speaker_id: this.speaker_id,
        model_name: this.model,
        action: "join",
        role: "agent",
        topic: MQTT_TOPIC || "default",
        system_prompt: this.system_prompt,
        content: `"${this.speaker_id}"さんがチャットに参加しました。`,
      };
      messanger.publish("a2a/system/INFO", JSON.stringify(system_message), { qos: 2 });
    });
  }
  generate_id(is_system: boolean = false) {
    return `${is_system ? "system" : this.speaker_id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async run(message?: ChatMessage): Promise<void> {
    if (this.thinking) {
      await this.thinking.abort();
      this.assistant_reply = "";
    }
    if (message && message.content.trim() !== "") {
      console.log(message);
      this.messages.push(message);
    }
    // Ollamaに送信する前にcontext_idsプロパティを除外
    const messagesForOllama = this.messages.map(msg => {
      const { context_ids, ...msgWithoutContext } = msg;
      return msgWithoutContext;
    });
    const context_ids = this.messages.map(msg => msg.id || '').filter(id => id !== '').reverse();
    this.thinking = await ollama.chat({
      model: this.model,
      messages: messagesForOllama,
      stream: true,
      tools: this.tools,
    });
    try {
      for await (const part of this.thinking) {
        // 中断チェック
        if (this.thinking?.signal?.aborted || this.messages.length !== context_ids.length) {
          await this.thinking.abort();
          // アシスタントメッセージにIDを生成し、context_idsを設定
          const new_message: ChatMessage = { 
            id: this.generate_id(),
            role: "assistant", 
            content: this.assistant_reply, 
            context_ids: context_ids,
            speaker_id: this.speaker_id, 
            timestamp: Date.now(),
          };
          // this.messages.push(new_message);
          const display_message = {
            timestamp: new_message.timestamp,
            id: new_message.id,
            context_ids: new_message.context_ids,
          };
          console.warn("Run aborted");
          console.log(display_message);
          this.assistant_reply = "";
          return;
        }
        if (part.message.tool_calls) {
          // for (const tool of part.message.tool_calls) {
          //   const toolName = tool.function.name;
          //   const toolArgs = tool.function.arguments;
          //   const toolFunction = avairableFunctions[toolName];
          //   if (toolFunction) {
          //     const result = await toolFunction(toolArgs);
          //     const toolMessage: ChatMessage = {
          //       id: this.generate_id(),
          //       role: "tool",
          //       content: JSON.stringify(result),
          //       speaker_id: this.speaker_id,
          //       timestamp: Date.now(),
          //       context_ids: this.messages.map(msg => msg.id || '').filter(id => id !== '').reverse(),
          //     };
          //     this.messages.push(part.message);
          //     this.messages.push(toolMessage);
          //     // context_idsを含めて安全にJSONシリアライゼーション
          //     messanger.publish(
          //       this.topic.replace("assistant", "tool"), 
          //       JSON.stringify(toolMessage),
          //     );
          //   }
          // }
          return await this.run();
        } else if (part.message.content) {
          process.stdout.write(part.message.content);
          this.assistant_reply += part.message.content;
        } else if (part.done) {
          process.stdout.write("\n");          
          // アシスタントメッセージにIDを生成し、context_idsを設定
          const new_message: ChatMessage = { 
            id: this.generate_id(),
            role: "assistant", 
            content: `${this.speaker_id}: `+this.assistant_reply, 
            context_ids: context_ids,
            speaker_id: this.speaker_id, 
            timestamp: Date.now(),
          };
          
          messanger.publish(
            this.topic, 
            JSON.stringify(new_message),
            { qos: 0 },
            (error) => {
              if (!error) {
                this.messages.push(new_message);
                const display_message = {
                  timestamp: new_message.timestamp,
                  id: new_message.id,
                  context_ids: new_message.context_ids,
                };
                console.log(display_message);
              } else {
                console.error(error);
              }
            }
          );
          return;
        }
      }
    } catch (error) {
      // 中断された場合はnullを返す
      if (this.shouldAbort || this.thinking?.signal?.aborted) {
        console.log("Run aborted due to error");
        return;
      }
      throw error;
    }
  }

  async abort() {
    if (this.thinking) {
      await this.thinking.abort();
      console.warn("Abort thinking");
    }
  }

  close() {
    const system_message: SystemMessage = {
      id: this.generate_id(true),
      speaker_id: this.speaker_id,
      model_name: this.model,
      action: "leave",
      role: "agent",
      topic: MQTT_TOPIC || "default",
      content: `"${this.speaker_id}"さんがチャットを終了しました。`,
    };
    messanger.publish(
      `a2a/system/INFO/`,
      JSON.stringify(system_message),
      { qos: 2 },
      () => {
        console.log("Bye!");
        process.exit(0);
      }
    );
  }
}

export async function createAgent({name, system_prompt, history, tools}: {
    name: string, system_prompt: string, history: ChatMessage[], tools: any[]
  }): Promise<any> {
  const agent = new Agent(name, MODEL_NAME, system_prompt, history, tools);
  try {
    const response = await agent.run();
    return response;
  } catch (error) {
    // AbortErrorだけ無視
    if (error && typeof error === "object" && "name" in error && (error as any).name === "AbortError") {
      // 何もしない（ログだけ出すならconsole.log(error);）
      console.log(error);
    } else {
      return error;
    }
  }
}

export const createAgentTool = {
  type: "function",
  function: {
    name: "createAgent",
    description: "Create a new agent",
    parameters: {
      type: "object",
      required: ["name", "system_prompt", "history", "tools"],
      properties: {
        name: { type: "string", description: "agent name" },
        system_prompt: { type: "string", description: "system prompt" },
        history: { type: "array", description: "history" },
        tools: { type: "array", description: "tools" },
      },
    },
  },
};