import messanger, { topic_parser, payload_parser } from "./messanger";
import { SystemMessage } from "./types";
import { MQTT_TOPIC } from "./config";
import readline from "readline";

export class User {
    private speaker_id: string;
    private rl: readline.Interface;
    constructor(
        speaker_id: string,
    ) {
        this.speaker_id = speaker_id;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: `${this.speaker_id} > `,
        });
    }

    async listen(watch: string[] = []) {

        messanger.on("connect", () => {
            const system_message: SystemMessage = {
                speaker_id: this.speaker_id,
                action: "join",
                role: "user",
                topic: MQTT_TOPIC || "default",
                content: `"${this.speaker_id}"さんがチャットに参加しました。`,
            };
            messanger.publish(
                `a2a/system/INFO/`,
                JSON.stringify(system_message),
                { qos: 2 }
            );
            messanger.subscribe(watch, () => {
                console.log(`Subscribe ${watch}`);
                this.rl.prompt();
            });
        });
        messanger.on("message", (topic, payload) => {
            const parsedTopic = topic_parser(topic);
            const parsedPayload = payload_parser(payload.toString());
            if (parsedTopic.speaker_id !== this.speaker_id) {
                console.log(parsedTopic.speaker_id, ":", parsedPayload.content);
                this.rl.prompt();
            }
        });
        this.rl.on("line", async (line) => {
            if (line === "help") {
                console.log("help");
            } else if (line === "exit") {
                this.close();
            } else {
                messanger.publish(
                    `a2a/${MQTT_TOPIC}/user/${this.speaker_id}/INFO/`,
                    JSON.stringify({
                        role: "user",
                        content: line,
                        id: `${this.speaker_id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        speaker_id: this.speaker_id,
                        timestamp: Date.now()
                    }), { qos: 2 },
                    () => {
                        console.log("Message sent");
                    }
                );
            }
            this.rl.prompt();
        });
        this.rl.on("close", async () => {
            await this.close();
        });
    }
    async close() {
        const system_message: SystemMessage = {
            speaker_id: this.speaker_id,
            action: "leave",
            role: "user",
            topic: MQTT_TOPIC || "default",
            content: `"${this.speaker_id}"さんが退出しました。`,
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