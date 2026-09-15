import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.DAYZ_DATA_DIR?.trim() || path.join(process.cwd(), ".data", "dayz");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  await ensureDir();
  const file = path.join(DATA_DIR, name);
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(name: string, value: T): Promise<void> {
  await ensureDir();
  const file = path.join(DATA_DIR, name);
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
}
