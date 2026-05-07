/**
 * Multi-tenant Baileys bridge: one WhatsApp session per company (UUID tenant id).
 * Routes: /t/:tenantId/health | /qr | /logout | /send
 * Auth dirs: WHATSAPP_DATA_DIR/tenants/:tenantId/ (useMultiFileAuthState)
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import pino from "pino";
import QRCode from "qrcode";
import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const PORT = Number(process.env.PORT || 3005);
const AUTH_TOKEN = process.env.WHATSAPP_BRIDGE_SECRET || "";
const DATA_DIR = process.env.WHATSAPP_DATA_DIR || "./wa_data";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @typedef {{ sock: import('@whiskeysockets/baileys').WASocket | null, latestQr: string | null, connecting: Promise<void> | null }} TenantState */

/** @type {Map<string, TenantState>} */
const tenants = new Map();

function safeCompare(a, b) {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function requireAuth(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!AUTH_TOKEN || !safeCompare(token, AUTH_TOKEN)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function validTenantId(tenantId) {
  return Boolean(tenantId && UUID_RE.test(tenantId));
}

function tenantAuthDir(tenantId) {
  return path.join(DATA_DIR, "tenants", tenantId);
}

function getState(tenantId) {
  let st = tenants.get(tenantId);
  if (!st) {
    st = { sock: null, latestQr: null, connecting: null };
    tenants.set(tenantId, st);
  }
  return st;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Max time to wait for Baileys to emit pairing QR after socket creation (race with connection.update). */
const QR_WAIT_MS = Number(process.env.WHATSAPP_QR_WAIT_MS || 45000);

function phoneToJid(phone) {
  const digits = String(phone).replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

/**
 * @param {string} tenantId
 * @param {TenantState} st
 * @param {string} authDir
 */
async function runConnection(tenantId, st, authDir) {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion({});
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
  });
  st.sock = sock;

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      st.latestQr = qr;
      logger.info({ tenantId }, "WhatsApp QR generated");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      const err = lastDisconnect?.error;
      const code = err instanceof Boom ? err.output?.statusCode : undefined;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn({ tenantId, code, shouldReconnect }, "WhatsApp connection closed");
      st.sock = null;
      st.latestQr = null;
      if (shouldReconnect) {
        setTimeout(() => {
          void ensureTenantSocket(tenantId).catch((e) => logger.error({ tenantId, e }));
        }, 4000);
      }
    } else if (connection === "open") {
      st.latestQr = null;
      logger.info({ tenantId, user: sock?.user?.id }, "WhatsApp connected");
    }
  });
}

async function ensureTenantSocket(tenantId) {
  if (!validTenantId(tenantId)) {
    throw new Error("Invalid tenant id (expected company UUID)");
  }
  const authDir = tenantAuthDir(tenantId);
  await fs.mkdir(authDir, { recursive: true });
  const st = getState(tenantId);

  if (st.sock?.user) return st;

  // Socket exists but not paired yet — pairing QR may still be loading; do not spawn a second WASocket.
  if (st.sock && !st.sock.user) return st;

  if (st.connecting) {
    await st.connecting;
    if (st.sock?.user) return st;
    if (st.sock && !st.sock.user) return st;
  }

  st.connecting = (async () => {
    try {
      await runConnection(tenantId, st, authDir);
    } catch (e) {
      logger.error({ tenantId, e }, "connect failed");
      st.sock = null;
      throw e;
    }
  })();

  try {
    await st.connecting;
  } finally {
    st.connecting = null;
  }

  return st;
}

const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/t/:tenantId/health", (req, res) => {
  if (!requireAuth(req, res)) return;
  const tenantId = req.params.tenantId;
  if (!validTenantId(tenantId)) {
    return res.status(400).json({ error: "Invalid tenant id (expected company UUID)" });
  }
  const st = getState(tenantId);
  if (!st.sock) {
    return res.json({
      ok: true,
      tenant_id: tenantId,
      connected: false,
      wid: null,
    });
  }
  return res.json({
    ok: true,
    tenant_id: tenantId,
    connected: Boolean(st.sock?.user),
    wid: st.sock?.user?.id || null,
  });
});

app.get("/t/:tenantId/qr", async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const tenantId = req.params.tenantId;
    if (!validTenantId(tenantId)) {
      return res.status(400).json({ error: "Invalid tenant id (expected company UUID)" });
    }
    await ensureTenantSocket(tenantId);
    const st = getState(tenantId);
    if (st.sock?.user) {
      return res.status(204).end();
    }
    const deadline = Date.now() + QR_WAIT_MS;
    while (Date.now() < deadline) {
      if (st.sock?.user) {
        return res.status(204).end();
      }
      if (st.latestQr) {
        const svg = await QRCode.toString(st.latestQr, { type: "svg" });
        return res.type("image/svg+xml").send(svg);
      }
      await sleep(150);
    }
    return res.status(404).json({
      error: "No QR available yet",
      hint: "WhatsApp did not send a pairing code in time; check bridge logs and try again.",
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: String(e) });
  }
});

app.post("/t/:tenantId/logout", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const tenantId = req.params.tenantId;
  if (!validTenantId(tenantId)) {
    return res.status(400).json({ error: "Invalid tenant id (expected company UUID)" });
  }
  const st = getState(tenantId);
  const authDir = tenantAuthDir(tenantId);
  try {
    await fs.rm(authDir, { recursive: true, force: true });
  } catch (e) {
    logger.warn({ tenantId, e }, "Could not remove auth dir");
  }
  try {
    await st.sock?.logout?.();
  } catch (e) {
    logger.warn({ tenantId, e }, "logout() failed");
  }
  st.sock = null;
  st.latestQr = null;
  setTimeout(() => {
    void ensureTenantSocket(tenantId).catch((e) => logger.error({ tenantId, e }));
  }, 1000);
  res.json({ ok: true, tenant_id: tenantId });
});

app.post("/t/:tenantId/send", async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const tenantId = req.params.tenantId;
    if (!validTenantId(tenantId)) {
      return res.status(400).json({ error: "Invalid tenant id (expected company UUID)" });
    }
    await ensureTenantSocket(tenantId);
    const st = getState(tenantId);
    const { phone, text } = req.body || {};
    if (!phone || !text) {
      return res.status(400).json({ error: "Missing phone or text" });
    }
    if (!st.sock?.user) {
      return res.status(503).json({
        error: "WhatsApp not connected for this company; pair via employer settings QR",
      });
    }
    const jid = phoneToJid(phone);
    await st.sock.sendMessage(jid, { text: String(text) });
    return res.json({ ok: true, tenant_id: tenantId });
  } catch (e) {
    logger.error(e);
    return res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, async () => {
  await fs.mkdir(path.join(DATA_DIR, "tenants"), { recursive: true });
  logger.info({ port: PORT, dataDir: DATA_DIR }, "WhatsApp bridge (multi-tenant) listening");
});
