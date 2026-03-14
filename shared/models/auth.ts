import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, text } from "drizzle-orm/pg-core";

export const httpSessions = pgTable(
  "http_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: text("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  displayName: text("display_name"),
  fullName: text("full_name"),
  artistName: text("artist_name"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  altPhone: text("alt_phone"),
  birthDate: text("birth_date"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  mainLanguage: text("main_language"),
  additionalLanguages: text("additional_languages"),
  experience: text("experience"),
  specialty: text("specialty"),
  bio: text("bio"),
  portfolioUrl: text("portfolio_url"),
  status: text("status").notNull().default("pending"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [index("user_profiles_user_id_idx").on(table.userId)]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
