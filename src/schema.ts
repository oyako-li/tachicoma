import { Float32, Utf8, Timestamp, TimeUnit, List, Field } from 'apache-arrow';

import { EmbeddingFunction, register, LanceSchema } from "@lancedb/lancedb/embedding";
import ollama from "ollama";

// ❶ @register でグローバルレジストリに登録
@register("ollama")                          // 任意のキー名
class OllamaEmbeddings extends EmbeddingFunction<string> {
  model = "mxbai-embed-large";

  /* ----------- 必須メソッド ----------- */
  ndims() { return 1024; }                   // ベクトル次元
  embeddingDataType() { return new Float32();}
  protected getSensitiveKeys() { return []; }

  /* ----------- 実体 ----------- */
  async computeQueryEmbeddings(text: string) {
    const res = await ollama.embed({ model: this.model, input: text });
    return res.embeddings[0];                        // 1 クエリ = 1 ベクトル
  }
  async computeSourceEmbeddings(texts: string[]) {
    const res = await ollama.embed({ model: this.model, input: texts });
    return res.embeddings;                       // 配列で返す
  }
}

const func = new OllamaEmbeddings();

// Create schema
export const message_schema = LanceSchema({
    topic: new Utf8(),
    protocol: new Utf8(),
    provider: new Utf8(),
    speaker_id: new Utf8(),
    status: new Utf8(),
    role: new Utf8(),
    phase: new Utf8(),
    context_id: new Utf8(),
    context_ids: new List(new Field("item", new Utf8(), true)),
    payload: func.sourceField(new Utf8()),
    timestamp: new Timestamp(TimeUnit.MILLISECOND, 'Asia/Tokyo'),
    embedding: func.vectorField(),
});

// Create schema
export const agent_master_schema = LanceSchema({
    speaker_id: new Utf8(),
    model_name: new Utf8(),
    status: new Utf8(),
    roles: new List(new Field("item", new Utf8(), true)),
    score: new Float32(),
    system_prompt: func.sourceField(new Utf8()),
    result: new Utf8(),
    review: new Utf8(),
    last_heartbeat: new Timestamp(TimeUnit.MILLISECOND, 'Asia/Tokyo'),
    embedding: func.vectorField(),
});
