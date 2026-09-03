import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;

function init(): PostgresJsDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL chưa cấu hình. Tạo Postgres (Neon/Supabase) rồi thêm vào .env.local",
    );
  }
  // max:1 hợp serverless; prepare:false hợp transaction pooler (pgbouncer)
  const client = postgres(url, { prepare: false, max: 1 });
  _db = drizzle(client, { schema });
  return _db;
}

// Lazy: chỉ kết nối khi query đầu tiên, không throw lúc import (build sẽ pass).
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_t, prop) {
    const inst = _db ?? init();
    // @ts-expect-error – forward mọi thuộc tính sang drizzle instance
    return inst[prop];
  },
});

export { schema };
