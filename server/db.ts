// Local data layer for Sasa Event Hub.
//
// The Manus template expects a hosted MySQL instance (drizzle-orm/mysql2).
// For the self-hosted deployment we use Node's built-in SQLite (node:sqlite),
// which needs no native build and keeps everything on-box.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type UserRow = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type PrizeRow = {
  id: number;
  name: string;
  detail: string;
  quantity: number;
  createdAt: Date;
};

export type GuestRow = {
  id: number;
  registrationCode: string;
  name: string;
  department: string;
  phone: string;
  isWinner: boolean;
  prizeId: number | null;
  winnerAt: Date | null;
  redeemedAt: Date | null;
  redeemedBy: string | null;
  createdAt: Date;
};

export type InsertUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: string | null;
  lastSignedIn?: Date;
};

type Row = Record<string, unknown>;
type SqlValue = string | number | bigint | null | Uint8Array;

let _db: DatabaseSync | null = null;

function resolveDbPath(): string {
  const configured = process.env.SASA_DB;
  if (configured && configured.length > 0) return configured;
  return path.resolve(process.cwd(), "data", "sasa-event.db");
}

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSignedIn TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      detail TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registrationCode TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      phone TEXT NOT NULL,
      isWinner INTEGER NOT NULL DEFAULT 0,
      prizeId INTEGER,
      winnerAt TEXT,
      redeemedAt TEXT,
      redeemedBy TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_guests_registrationCode ON guests (registrationCode);
    CREATE INDEX IF NOT EXISTS idx_guests_prizeId ON guests (prizeId);
  `);
  _db = db;
  return db;
}

function all(sql: string, ...params: SqlValue[]): Row[] {
  return getDb().prepare(sql).all(...params) as unknown as Row[];
}

function run(sql: string, ...params: SqlValue[]): void {
  getDb().prepare(sql).run(...params);
}

const toDate = (value: unknown): Date =>
  value == null ? new Date(0) : new Date(String(value));
const toNullableDate = (value: unknown): Date | null =>
  value == null ? null : new Date(String(value));

function mapGuest(row: Row): GuestRow {
  return {
    id: Number(row.id),
    registrationCode: String(row.registrationCode),
    name: String(row.name),
    department: String(row.department),
    phone: String(row.phone),
    isWinner: Number(row.isWinner) === 1,
    prizeId: row.prizeId == null ? null : Number(row.prizeId),
    winnerAt: toNullableDate(row.winnerAt),
    redeemedAt: toNullableDate(row.redeemedAt),
    redeemedBy: row.redeemedBy == null ? null : String(row.redeemedBy),
    createdAt: toDate(row.createdAt),
  };
}

function mapPrize(row: Row): PrizeRow {
  return {
    id: Number(row.id),
    name: String(row.name),
    detail: String(row.detail),
    quantity: Number(row.quantity),
    createdAt: toDate(row.createdAt),
  };
}

function mapUser(row: Row): UserRow {
  return {
    id: Number(row.id),
    openId: String(row.openId),
    name: row.name == null ? null : String(row.name),
    email: row.email == null ? null : String(row.email),
    loginMethod: row.loginMethod == null ? null : String(row.loginMethod),
    role: String(row.role ?? "user"),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    lastSignedIn: toDate(row.lastSignedIn),
  };
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const now = new Date().toISOString();
  const lastSignedIn = (user.lastSignedIn ?? new Date()).toISOString();
  run(
    `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(openId) DO UPDATE SET
       name = COALESCE(excluded.name, users.name),
       email = COALESCE(excluded.email, users.email),
       loginMethod = COALESCE(excluded.loginMethod, users.loginMethod),
       role = excluded.role,
       lastSignedIn = excluded.lastSignedIn,
       updatedAt = excluded.updatedAt`,
    user.openId,
    user.name ?? null,
    user.email ?? null,
    user.loginMethod ?? null,
    user.role ?? "user",
    now,
    now,
    lastSignedIn
  );
}

export async function getUserByOpenId(openId: string): Promise<UserRow | undefined> {
  const rows = all(`SELECT * FROM users WHERE openId = ? LIMIT 1`, openId);
  return rows[0] ? mapUser(rows[0]) : undefined;
}

// ── Prizes ─────────────────────────────────────────────────────────────────

const defaultPrizes = [
  { name: "Sasa Cooking Set", detail: "Paket alat masak pilihan", quantity: 1 },
  { name: "Sasa Hampers", detail: "Hampers produk favorit Sasa", quantity: 2 },
  { name: "Voucher Belanja", detail: "Voucher belanja senilai Rp250.000", quantity: 3 },
];

export async function ensureDefaultPrizes(): Promise<PrizeRow[]> {
  let rows = all(`SELECT * FROM prizes ORDER BY id`);
  if (rows.length === 0) {
    const now = new Date().toISOString();
    for (const prize of defaultPrizes) {
      run(
        `INSERT INTO prizes (name, detail, quantity, createdAt) VALUES (?, ?, ?, ?)`,
        prize.name,
        prize.detail,
        prize.quantity,
        now
      );
    }
    rows = all(`SELECT * FROM prizes ORDER BY id`);
  }
  return rows.map(mapPrize);
}

export async function getEventRows(): Promise<{ guestRows: GuestRow[]; prizeRows: PrizeRow[] }> {
  const guestRows = all(`SELECT * FROM guests ORDER BY id`).map(mapGuest);
  const prizeRows = await ensureDefaultPrizes();
  return { guestRows, prizeRows };
}

// ── Guests ─────────────────────────────────────────────────────────────────

export async function findGuestByCode(code: string): Promise<GuestRow | undefined> {
  const rows = all(`SELECT * FROM guests WHERE registrationCode = ? LIMIT 1`, code);
  return rows[0] ? mapGuest(rows[0]) : undefined;
}

export async function createGuest(input: {
  registrationCode: string;
  name: string;
  department: string;
  phone: string;
}): Promise<GuestRow> {
  const now = new Date().toISOString();
  run(
    `INSERT INTO guests (registrationCode, name, department, phone, isWinner, createdAt)
     VALUES (?, ?, ?, ?, 0, ?)`,
    input.registrationCode,
    input.name,
    input.department,
    input.phone,
    now
  );
  const guest = await findGuestByCode(input.registrationCode);
  if (!guest) throw new Error("Gagal menyimpan tamu");
  return guest;
}

export async function markGuestWinner(id: number, prizeId: number, winnerAt: Date): Promise<void> {
  run(`UPDATE guests SET isWinner = 1, prizeId = ?, winnerAt = ? WHERE id = ?`, prizeId, winnerAt.toISOString(), id);
}

export async function markGuestRedeemed(id: number, redeemedBy: string, redeemedAt: Date): Promise<void> {
  run(`UPDATE guests SET redeemedAt = ?, redeemedBy = ? WHERE id = ?`, redeemedAt.toISOString(), redeemedBy, id);
}

export async function findPrizeById(id: number): Promise<PrizeRow | undefined> {
  const rows = all(`SELECT * FROM prizes WHERE id = ? LIMIT 1`, id);
  return rows[0] ? mapPrize(rows[0]) : undefined;
}
