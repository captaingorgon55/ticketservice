#!/usr/bin/env tsx
/**
 * seed.ts — Creates initial users in MongoDB for the Help Desk.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *   SEED_PASSWORD=securepass npx tsx scripts/seed.ts
 *
 * Default password is "helpdesk2024" — change immediately after first login.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/helpdesk";
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "helpdesk2024";

const SEED_USERS = [
  { name: "Admin",           email: "admin@helpdesk.com",              role: "admin"   as const, area: "Inteligencia de Mercados" },
  { name: "Analista Sr",     email: "analista1@helpdesk.com",          role: "analista" as const, area: "Inteligencia de Mercados" },
  { name: "Analista Jr",     email: "analista2@helpdesk.com",          role: "analista" as const, area: "Inteligencia de Mercados" },
  { name: "Cristian Ramírez", email: "cmramirez@elespectador.com",    role: "analista" as const, area: "Especialista IM" },
  { name: "Sebastián Martínez", email: "smartinezr@elespectador.com", role: "analista" as const, area: "Lider IM" },
  { name: "Juan Sebastián Castañeda", email: "jscastaneda@elespectador.com", role: "analista" as const, area: "Lider Redes y Omnicanalidad" },
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB:", MONGODB_URI);

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const u of SEED_USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`  SKIP  ${u.email} (already exists)`);
      continue;
    }
    await User.create({ ...u, password: hash, isActive: true });
    console.log(`  CREATED  ${u.email}  [${u.role}]`);
  }

  console.log(`\nAll users seeded. Default password: "${DEFAULT_PASSWORD}"`);
  console.log("IMPORTANT: change passwords immediately after first login.\n");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
