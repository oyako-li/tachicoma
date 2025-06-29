import ollama from "ollama";
import { googleSearch } from "./search";
import { scrape } from "./scraper";
import { recall } from "./archiver";

const avairableFunctions: Record<string, (...args: any[]) => any> = {
  search: googleSearch,
  scrape: scrape,
  recall: recall,
};

export class Conscious {
  private model: string;
  private system_prompt: string;
  private tools: any[];
  public assistant_reply: string;
  private messages: any[];
  public thinking: any;
  constructor(
    model: string,
    system_prompt: string,
    history: any[] = [],
    tools: any[] = []
  ) {
    const messages = history
      ? history
      : [
          {
            role: "system",
            content: system_prompt,
          },
        ];
    this.messages = messages;
    this.model = model;
    this.system_prompt = system_prompt;
    this.tools = tools;
    this.assistant_reply = "";
    this.thinking = null;
  }

  async run(message: string) {
    this.messages.push({ role: "user", content: message });
    this.assistant_reply = "";
    this.thinking = await ollama.chat({
      model: this.model,
      messages: this.messages,
      stream: true,
      tools: this.tools,
    });
    for await (const part of this.thinking) {
      if (
        this.thinking &&
        this.thinking.signal &&
        this.thinking.signal.aborted
      ) {
        break;
      }
      if (part.message.tool_calls) {
        for (const tool of part.message.tool_calls) {
          console.log(tool);
          const toolName = tool.function.name;
          const toolArgs = tool.function.arguments;
          const toolFunction = avairableFunctions[toolName];
          if (toolFunction) {
            const result = await toolFunction(toolArgs);
            const toolMessage = {
              role: "tool",
              content: JSON.stringify(result),
            };
            console.log(`[tool:${toolName}]`, result);
            this.messages.push(part.message);
            this.messages.push(toolMessage);
          }
        }
      } else if (part.message.content) {
        process.stdout.write(part.message.content);
        this.assistant_reply += part.message.content;
      }
    }
    if (
      this.thinking &&
      this.thinking.signal &&
      this.thinking.signal.aborted
    ) {
      process.stdout.write("\n");
      this.assistant_reply = "";
    } else {
      this.messages.push({ role: "assistant", content: this.assistant_reply });
    }
    return this.assistant_reply;
  }

  async abort() {
    if (this.thinking && this.thinking.abort) {
      this.thinking.abort();
    }
  }
}

export class Agent {
  private model: string;
  private system_prompt: string;
  private tools: any[];
  public assistant_reply: string;
  private messages: any[];
  public thinking: any;
  constructor(
    model: string,
    system_prompt: string,
    history: any[] = [],
    tools: any[] = []
  ) {
    const messages = history
      ? history
      : [
          {
            role: "system",
            content: system_prompt,
          },
        ];
    this.messages = messages;
    this.model = model;
    this.system_prompt = system_prompt;
    this.tools = tools;
    this.assistant_reply = "";
    this.thinking = null;
  }

  async run(message: string) {
    this.messages.push({ role: "user", content: message });
    this.assistant_reply = "";
    this.thinking = await ollama.chat({
      model: this.model,
      messages: this.messages,
      stream: true,
      tools: this.tools,
    });
    for await (const part of this.thinking) {
      if (
        this.thinking &&
        this.thinking.signal &&
        this.thinking.signal.aborted
      ) {
        break;
      }
      if (part.message.tool_calls) {
        for (const tool of part.message.tool_calls) {
          console.log(tool);
          const toolName = tool.function.name;
          // const toolArgs = JSON.parse(tool.function.arguments);
          const toolArgs = tool.function.arguments;
          const toolFunction = avairableFunctions[toolName];
          if (toolFunction) {
            const result = await toolFunction(toolArgs);
            const toolMessage = {
              role: "tool",
              content: JSON.stringify(result),
            };
            console.log(`[tool:${toolName}]`, result);
            this.messages.push(part.message);
            this.messages.push(toolMessage);
          }
        }
        this.thinking = await ollama.chat({
          model: this.model,
          messages: this.messages,
          stream: true,
        });
        for await (const part of this.thinking) {
          if (
            this.thinking &&
            this.thinking.signal &&
            this.thinking.signal.aborted
          ) {
            break;
          }
          if (part.message.content) {
            process.stdout.write(part.message.content);
            this.assistant_reply += part.message.content;
          }
        }
      } else if (part.message.content) {
        process.stdout.write(part.message.content);
        this.assistant_reply += part.message.content;
      }
    }
    if (
      this.thinking &&
      this.thinking.signal &&
      this.thinking.signal.aborted
    ) {
      process.stdout.write("\n");
      this.assistant_reply = "";
    } else {
      this.messages.push({ role: "assistant", content: this.assistant_reply });
    }
    return this.assistant_reply;
  }

  async abort() {
    if (this.thinking && this.thinking.abort) {
      this.thinking.abort();
    }
  }
}
