import { Timestamp } from "apache-arrow";


export const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
};

export type DataListItem = {
    role: string;
    content: string;
    agent?: string;
    oblivion?: number;
};

export type ModalType = "text" | "audio" | "image" | "video";

export type SystemMessage = {
    id?: string;
    speaker_id: string;
    model_name?: string;
    action?: string;
    role: string;
    roles?: string[];
    topic: string;
    system_prompt?: string;
    content?: string;
    last_heartbeat?: Timestamp;
};

export type ArchiveMessage = {
    payload: string,
    topic: string,
    protocol: string,
    provider: string,
    speaker_id: string,
    status: string,
    role: string,
    phase?: string,
    context_id?: string,
    context_ids?: string[],
    timestamp: number,
};

export interface ChatMessage {
    id: string;
    speaker_id: string;
    role: string;
    content: string;
    context_ids?: string[];
    timestamp: number;
}