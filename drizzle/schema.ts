import { boolean, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 32 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const prizes = mysqlTable("prizes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  detail: varchar("detail", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const guests = mysqlTable("guests", {
  id: int("id").autoincrement().primaryKey(),
  registrationCode: varchar("registrationCode", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  department: varchar("department", { length: 140 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  isWinner: boolean("isWinner").default(false).notNull(),
  prizeId: int("prizeId"),
  winnerAt: timestamp("winnerAt"),
  redeemedAt: timestamp("redeemedAt"),
  redeemedBy: varchar("redeemedBy", { length: 180 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Guest = typeof guests.$inferSelect;
export type Prize = typeof prizes.$inferSelect;
