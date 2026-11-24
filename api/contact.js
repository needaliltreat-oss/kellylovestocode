"use strict";
/*
 * POST /api/contact on Vercel. Sends the site's contact form through Fastmail SMTP.
 * Fastmail settings (fastmail.help, "Server names and ports"): smtp.fastmail.com, port 465,
 * SSL/TLS (not STARTTLS), PLAIN auth, username = the full Fastmail login address,
 * password = an app password with Mail access.
 *
 * Environment variables (set in Vercel > Settings > Environment Variables, never in code):
 *   FASTMAIL_USER          the Fastmail login address; also the From address
 *   FASTMAIL_APP_PASSWORD  the Fastmail app password
 *   CONTACT_TO             where messages are delivered
 */
const nodemailer = require("nodemailer");
const { createHandler } = require("../lib/contact");

let transport;
const getTransport = () => transport || (transport = nodemailer.createTransport({
  host: "smtp.fastmail.com",
  port: 465,
  secure: true,
  auth: { user: process.env.FASTMAIL_USER, pass: process.env.FASTMAIL_APP_PASSWORD },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
}));

module.exports = createHandler({ sendMail: (mail) => getTransport().sendMail(mail) });
