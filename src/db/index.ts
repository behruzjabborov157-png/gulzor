import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

type Holder = { db?: DB; ready?: Promise<DB>; close?: () => Promise<void> };
const g = globalThis as unknown as { __gulzorDb?: Holder };
const holder: Holder = (g.__gulzorDb ??= {});

export function databaseKind(): "pglite" | "postgres" {
  const url = process.env.DATABASE_URL ?? "";
  return url === "" || url.startsWith("pglite:") ? "pglite" : "postgres";
}

export function pgliteDir(): string {
  const url = process.env.DATABASE_URL ?? "";
  const dir = url.startsWith("pglite:") ? url.slice("pglite:".length) : "./storage/pgdata";
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), dir);
}

async function connect(): Promise<DB> {
  if (databaseKind() === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const fs = await import("node:fs");
    fs.mkdirSync(pgliteDir(), { recursive: true });
    const client = await PGlite.create(pgliteDir());
    holder.close = () => client.close();
    return drizzle({ client, schema }) as unknown as DB;
  }
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = postgres(process.env.DATABASE_URL!, { max: 10, prepare: false });
  holder.close = () => client.end();
  return drizzle({ client, schema }) as unknown as DB;
}

/** Lazily connects on first use. Safe to call from any server code. */
export async function getDb(): Promise<DB> {
  if (holder.db) return holder.db;
  holder.ready ??= connect().then((db) => (holder.db = db));
  return holder.ready;
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.ready = undefined;
}

export { schema };
