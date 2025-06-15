import fs from 'fs';
import os from 'os';
import path from 'path';

const historyPath = path.join(os.homedir(), '.ollama_history.json');

export function loadHistory() {
    try {
        const raw = fs.readFileSync(historyPath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function saveHistory(history: any[]) {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

export function clearHistory() {
    if (fs.existsSync(historyPath)) {
        fs.unlinkSync(historyPath);
    }
}
