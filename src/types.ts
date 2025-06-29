export interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: string;
    embedding: number[];
}
  
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