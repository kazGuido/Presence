import crypto from "node:crypto";
import express from "express";
import pino from "pino";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const PORT = Number(process.env.PORT || 3005);
const AUTH_TOKEN = process.env.WHATSAPP_BRIDGE_SECRET || "";
const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR || "./auth_info";

/** @type {import('@whiskeysockets/baileys').WASocket | null} */
let sock = null;

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

function phoneToJid(phone) {
  const digits = String(phone).replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion({});
  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      logger.info("Scan this QR with WhatsApp (Linked devices)");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      const err = lastDisconnect?.error;
      const code = err instanceof Boom ? err.output?.statusCode : undefined;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn({ code, shouldReconnect }, "WhatsApp connection closed");
      sock = null;
      if (shouldReconnect) {
        setTimeout(() => void connect().catch((e) => logger.error(e)), 4000);
      }
    } else if (connection === "open") {
      logger.info({ user: sock?.user?.id }, "WhatsApp connected");
    }
  });
}

const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    connected: Boolean(sock?.user),
    wid: sock?.user?.id || null,
  });
});

app.post("/send", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!AUTH_TOKEN || !safeCompare(token, AUTH_TOKEN)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { phone, text } = req.body || {};
  if (!phone || !text) {
    return res.status(400).json({ error: "Missing phone or text" });
  }
  if (!sock?.user) {
    return res.status(503).json({
      error: "WhatsApp not connected; scan QR in container logs",
    });
  }
  try {
    const jid = phoneToJid(phone);
    await sock.sendMessage(jid, { text: String(text) });
    return res.json({ ok: true });
  } catch (e) {
    logger.error(e);
    return res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  logger.info({ port: PORT, authDir: AUTH_DIR }, "Geofence attendance WhatsApp bridge listening");
  void connect().catch((e) => logger.error(e));
});
