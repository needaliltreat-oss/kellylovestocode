"use strict";
/*
 * Contact form handler, shared by the Vercel function (api/contact.js) and its tests.
 * It checks and cleans the fields, applies the spam checks, and hands one plain-text
 * message to sendMail(). It never logs the visitor's details or any credential.
 *
 * Spam protection, with no third-party service:
 *   - origin allowlist (the live site and this project's Vercel URLs only)
 *   - hidden "website" field: if filled, reply OK and send nothing
 *   - timing: the browser reports ms since the form was first touched; under MIN_MS is refused
 *   - per-IP rate limit (best effort: it lives in each warm function instance)
 *   - size and length limits, strict field checks, control characters removed
 */

const MIN_MS = 2500;                 // matches the browser check in studio/index.html
const MAX_BODY = 16 * 1024;          // bytes
const RATE = { max: 5, windowMs: 10 * 60 * 1000 };
const LIMITS = { name: 120, email: 254, company: 160, need: 40, need_other: 200, message: 2000 };
const NEEDS = ["", "Fractional CTO", "Advisory", "Build", "Design and brand", "Other"];
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

const ALLOWED_ORIGINS = new Set([
  "https://kellylovestocode.com",
  "https://www.kellylovestocode.com",
  "https://kellylovestocode.vercel.app",
]);
// Vercel preview URLs for this project, e.g. kellylovestocode-git-<branch>-needaliltreat-oss-projects.vercel.app
const PREVIEW_ORIGIN_RE = /^https:\/\/kellylovestocode-[a-z0-9-]+-needaliltreat-oss-projects\.vercel\.app$/;

const isAllowedOrigin = (o) => typeof o === "string" && (ALLOWED_ORIGINS.has(o) || PREVIEW_ORIGIN_RE.test(o));
// Browsers may leave Origin off a same-origin POST; then trust Sec-Fetch-Site plus the Host it was sent to.
const requestOrigin = (req) => {
  const h = req.headers || {};
  if (h.origin) return String(h.origin);
  if (h["sec-fetch-site"] === "same-origin" && h.host) return "https://" + String(h.host).toLowerCase();
  return "";
};

// one line: no control characters, no line breaks, collapsed spaces
const line = (v, max) => String(v == null ? "" : v)
  .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
  .replace(/\s+/g, " ").trim().slice(0, max);
// multi-line text: keep \n, drop other control characters, normalize line endings
const block = (v, max) => String(v == null ? "" : v)
  .replace(/\r\n?/g, "\n")
  .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]+/g, "")
  .replace(/\n{4,}/g, "\n\n\n").trim().slice(0, max);

function clean(raw) {
  const f = {
    name: line(raw.name, LIMITS.name),
    email: line(raw.email, LIMITS.email),
    company: line(raw.company, LIMITS.company),
    need: line(raw.need, LIMITS.need),
    need_other: line(raw.need_other, LIMITS.need_other),
    message: block(raw.message, LIMITS.message),
  };
  if (!NEEDS.includes(f.need)) f.need = "";
  if (f.need !== "Other") f.need_other = "";
  const errors = {};
  if (!f.name) errors.name = "required";
  if (!f.email) errors.email = "required";
  else if (!EMAIL_RE.test(f.email)) errors.email = "invalid";
  if (!f.message) errors.message = "required";
  return { fields: f, errors };
}

function buildMail(f, env) {
  const needLine = f.need ? (f.need === "Other" && f.need_other ? `Other: ${f.need_other}` : f.need) : "Not given";
  const text = [
    `Name: ${f.name}`,
    `Email: ${f.email}`,
    `Company: ${f.company || "Not given"}`,
    `What they need: ${needLine}`,
    "",
    f.message,
    "",
    "Sent from the contact form on kellylovestocode.com. Reply to this email to answer them.",
  ].join("\n");
  return {
    from: { name: "kellylovestocode.com", address: env.FASTMAIL_USER },
    to: env.CONTACT_TO,
    replyTo: { name: f.name, address: f.email },
    subject: `Website message from ${f.name}`.slice(0, 160),
    text,
  };
}

function clientIp(req) {
  const h = req.headers || {};
  const fwd = String(h["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(h["x-real-ip"] || "") || (req.socket && req.socket.remoteAddress) || "unknown";
}

async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
  if (raw == null) {
    raw = await new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error("too large"), { code: 413 })); req.destroy(); } else chunks.push(c); });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY) throw Object.assign(new Error("too large"), { code: 413 });
  try { const v = JSON.parse(raw); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch (_) { /* fall through */ }
  throw Object.assign(new Error("bad json"), { code: 400 });
}

function send(res, status, body, origin) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Origin");
  if (isAllowedOrigin(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.end(JSON.stringify(body));
}

function createHandler({ sendMail, env = process.env, now = () => Date.now() }) {
  const hits = new Map(); // ip -> [timestamps]
  const limited = (ip) => {
    const t = now(), from = t - RATE.windowMs;
    const list = (hits.get(ip) || []).filter((x) => x > from);
    if (list.length >= RATE.max) { hits.set(ip, list); return true; }
    list.push(t); hits.set(ip, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => x > from)) hits.delete(k);
    return false;
  };

  return async function handler(req, res) {
    const origin = requestOrigin(req);
    if (req.method === "OPTIONS") {
      if (!isAllowedOrigin(origin)) return send(res, 403, { ok: false, error: "origin" }, origin);
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "86400");
      res.setHeader("Vary", "Origin");
      return res.end();
    }
    if (req.method !== "POST") { res.setHeader("Allow", "POST, OPTIONS"); return send(res, 405, { ok: false, error: "method" }, origin); }
    if (!isAllowedOrigin(origin)) return send(res, 403, { ok: false, error: "origin" }, origin);
    if (!/^application\/json\b/i.test(String((req.headers && req.headers["content-type"]) || ""))) return send(res, 415, { ok: false, error: "type" }, origin);

    let raw;
    try { raw = await readJson(req); } catch (e) { return send(res, e.code === 413 ? 413 : 400, { ok: false, error: e.code === 413 ? "size" : "json" }, origin); }

    if (limited(clientIp(req))) return send(res, 429, { ok: false, error: "rate" }, origin);

    // honeypot: look like success, send nothing
    if (line(raw.website, 200)) return send(res, 200, { ok: true }, origin);

    const elapsed = Number(raw.t);
    if (!Number.isFinite(elapsed) || elapsed < MIN_MS) return send(res, 400, { ok: false, error: "fast" }, origin);

    const { fields, errors } = clean(raw);
    if (Object.keys(errors).length) return send(res, 422, { ok: false, error: "fields", fields: errors }, origin);

    if (!env.FASTMAIL_USER || !env.FASTMAIL_APP_PASSWORD || !env.CONTACT_TO) {
      console.error("contact: missing environment variables (FASTMAIL_USER, FASTMAIL_APP_PASSWORD, CONTACT_TO)");
      return send(res, 503, { ok: false, error: "config" }, origin);
    }

    try {
      await sendMail(buildMail(fields, env));
    } catch (e) {
      // log the SMTP failure class only, never the message content or credentials
      console.error("contact: send failed", e && (e.code || e.responseCode || e.name));
      return send(res, 502, { ok: false, error: "send" }, origin);
    }
    return send(res, 200, { ok: true }, origin);
  };
}

module.exports = { createHandler, clean, buildMail, isAllowedOrigin, MIN_MS, LIMITS };
