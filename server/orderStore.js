import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readOrders() {
  await ensureStore();
  const raw = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeOrders(orders) {
  await ensureStore();
  await writeFile(DATA_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

export async function getOrderRecord(sessionId) {
  const orders = await readOrders();
  return orders.find((order) => order.sessionId === sessionId) || null;
}

export async function saveOrderRecord(nextRecord) {
  const orders = await readOrders();
  const index = orders.findIndex((order) => order.sessionId === nextRecord.sessionId);

  if (index === -1) {
    orders.push(nextRecord);
  } else {
    orders[index] = nextRecord;
  }

  await writeOrders(orders);
  return nextRecord;
}

export async function findDestinationBySlug(slug) {
  const orders = await readOrders();
  for (const order of orders) {
    if (order.intake?.entries) {
      const entry = order.intake.entries.find((e) => e.slug === slug);
      if (entry) return entry.targetUrl;
    }
  }
  return null;
}

export async function isSlugAvailable(slug, currentSessionId) {
  const orders = await readOrders();
  for (const order of orders) {
    if (order.intake?.entries) {
      const entry = order.intake.entries.find((e) => e.slug === slug);
      if (entry && order.sessionId !== currentSessionId) return false;
    }
  }
  return true;
}
