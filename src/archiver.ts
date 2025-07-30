import {
  ARCHIVE_DIR,
} from "./config";
import { connect, Table, } from "@lancedb/lancedb";
import path from "node:path";
import { Schema } from "apache-arrow";

export class Archive {
  private table: Table | null = null;
  private table_name: string;
  private schema: Schema;
  constructor(table_name: string, schema: Schema) {
      this.table_name = table_name;
      this.schema = schema;
  }

  async tbl(recreate: boolean = false) {
      if (!this.table) {
          const db = await connect(path.join(ARCHIVE_DIR, ".lancedb", "archive"));

          if (recreate) {
              this.table = await db.createEmptyTable(this.table_name, this.schema, {
                  mode: "overwrite",
              });
          } else {
            this.table = await db.openTable(this.table_name);
          }
      }
      return this.table;
  }
}

export const recallTool = {
  type: "function",
  function: {
    name: "recall",
    description: "Search past messages from the archive",
    parameters: {
      type: "object",
      required: ["query", "limit"],
      properties: {
        query: { type: "string", description: "search query" },
        limit: { type: "number", description: "Maximum number of search results" },
      },
    },
  },
};