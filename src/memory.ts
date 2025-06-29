import { Connection, Table } from "@lancedb/lancedb";
import { Schema, Field, Float32, FixedSizeList, Utf8 } from "apache-arrow";
import { DataListItem, ModalType } from "./types";
import { connect } from "@lancedb/lancedb";
import path from "path";
import os from "os";
import { options } from "./types";
import { MQTT_CLIENT_ID } from "./config";

/**
 * Agent Memory
 */
export class Memory {
    private db: Connection | null = null;
    private table: Table | null = null;
    private collectionName: string;
    private embeddingFunction: any;
    private beta: number;
    constructor(
        collectionName: string,
        embeddingFunction: any,
        beta: number = 0.99,
    ) {
        this.collectionName = collectionName;
        this.embeddingFunction = embeddingFunction;
        this.beta = beta;
    }

    async init() {
        this.db = await connect(path.join(".", ".lancedb"));
        try {
            // 既存のテーブルを開く
            this.table = await this.db.openTable(this.collectionName);
            return this.table;
        } catch (error) {
            // テーブルが存在しない場合は新規作成
            const timestamp = new Date().getTime(); //.toLocaleDateString("ja-JP",options);
            const vector = await this.embeddingFunction.generate("init");
            const rand = Math.random();
            this.table = await this.db.createTable(this.collectionName, [
                {
                    id: `${MQTT_CLIENT_ID}-${timestamp}-${rand}`,
                    vector: vector[0], // 配列の最初の要素を使用
                    content: "init",
                    role: "system",
                    timestamp: timestamp, //.toLocaleDateString("ja-JP",options),
                    agent: MQTT_CLIENT_ID,
                    oblivion: 0.99,
                },
            ]);
            return this.table;
        }
    }

    async save(
        data: DataListItem | DataListItem[],
        data_type: ModalType = "text"
    ) {
        if (!this.table) this.table = await this.init();

        const _timestamp = new Date();
        const timestamp = _timestamp.getTime(); //.toLocaleDateString("ja-JP",options);
        const dataList = Array.isArray(data) ? data : [data];
        const documents = await Promise.all(
            dataList.map(async ({ content, role, agent = name, oblivion = 0.99 }) => {
                const vector = await this.embeddingFunction.generate(content);
                const rand = Math.random();
                return {
                    id: `${os.hostname()}-${timestamp}-${rand}`,
                    vector: vector[0],
                    content: this.getQuery(content, _timestamp),
                    role,
                    timestamp,
                    agent,
                    oblivion,
                };
            })
        );
        await this.table?.add(documents);
    }

    async load(query: string | string[], topRank: number = 7) {
        if (!this.table) this.table = await this.init();

        const queryText = Array.isArray(query) ? query[0] : query;
        const queryVector = await this.embeddingFunction.generate(queryText);

        const results = await this.table
            .search(queryVector[0])
            .where(`role = 'self' ORDER BY oblivion ASC`)
            .limit(topRank * 3)
            .toArray();

        // _distanceとoblivionの重み付けでソート
        const sortedResults = results
            .sort((a, b) => {
                const oblivionWeight = 0.3;
                const distanceWeight = 0.7;
                return (
                    a.oblivion * oblivionWeight +
                    a._distance * distanceWeight -
                    (b.oblivion * oblivionWeight + b._distance * distanceWeight)
                );
            })
            .slice(0, topRank);

        await this.table.add(
            sortedResults.map((doc) => {
                const { vector, oblivion, _distance, ...update } = doc;
                return {
                    ...update,
                    vector: Array.from(vector.data[0].values), // Float32Arrayを通常の配列に変換
                    oblivion: oblivion * this.beta,
                };
            }),
            { mode: "overwrite" }
        );

        return sortedResults.map((doc) => {
            const { vector, ...update } = doc;
            return update;
        });
    }

    async delete(ids: string[]) {
        if (!this.table) this.table = await this.init();
        await this.table.delete(`id IN (${ids.map((id) => `'${id}'`).join(",")})`);
    }

    async oblivion() {
        if (!this.table) this.table = await this.init();
        const results = await this.table
            .query()
            .select(["id", "oblivion"])
            .toArray();
        const deleteIds = results
            .filter((doc) => Math.random() < (doc.oblivion ?? 0.99))
            .map((doc) => doc.id);

        if (deleteIds.length > 0) {
            await this.delete(deleteIds);
        }
    }

    private getQuery(content: string, timestamp: Date = new Date()) {
        const _timestamp = timestamp.toLocaleDateString("ja-JP", options);
        return `【${_timestamp}】${content.replace(/^【.*?】/, "")}`;
    }

    async generate(text: string) {
        return await this.embeddingFunction.generate(text);
    }
}

/**
 * Archive All Agent Messages
 */
export class Archive {
    private db: Connection | null = null;
    private table: Table | null = null;
    private collectionName: string;
    private embeddingFunction: any;
    private beta: number;
    constructor(
      collectionName: string,
      embeddingFunction: any,
      beta: number = 0.99,
    ) {
      this.collectionName = collectionName;
      this.embeddingFunction = embeddingFunction;
      this.beta = beta;
    }
  
    async init() {
      this.db = await connect(path.join("~", ".lancedb", "archive"));
      this.table = await this.db.openTable(this.collectionName);
      return this.table;
    }
  
    async save(data: DataListItem | DataListItem[]) {
      const timestamp = new Date().getTime();
      const vector = await this.embeddingFunction.generate(data.content);
      const record = {
        timestamp,
        vector,
        content: data.content,
        role: data.role,
        agent: data.agent,
        oblivion: data.oblivion,
      };
      await this.table?.add(record);
    }
  }