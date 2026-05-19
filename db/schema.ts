import { pgTable, text, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow(),
});

export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  title: text("title").notNull(),
  icon: text("icon").notNull().default(""),
  active: boolean("active").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  full_name: text("full_name").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  active: boolean("active").notNull().default(true),
});

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id"),
  section_key: text("section_key").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull(),
  required: boolean("required").notNull().default(false),
  active: boolean("active").notNull().default(true),
  is_master: boolean("is_master").notNull().default(false),
});

export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(),
  tenant_id: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  tenant_name: text("tenant_name").notNull().default(""),
  submitter_name: text("submitter_name").notNull(),
  status: text("status").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  answers: jsonb("answers").notNull().default({}),
});
