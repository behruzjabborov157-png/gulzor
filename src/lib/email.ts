import nodemailer from "nodemailer";
import { getDb, schema } from "@/db";
import { orderMessage, type OrderForMessage, type OrderMessageOptions, type SendResult } from "@/lib/telegram";

/**
 * Order e-mails to the shop owner over SMTP — a second channel next to Telegram.
 * The order is already saved before this runs; a failure is logged on the order and can be
 * retried from the admin page, it never affects the customer's order.
 */
export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.ORDER_EMAIL_TO);
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

/** Sends one e-mail to ORDER_EMAIL_TO. Never throws; reports what really happened. */
export async function sendOwnerEmail(subject: string, html: string, text: string): Promise<SendResult> {
  if (!emailConfigured()) return { status: "skipped", detail: "SMTP_HOST yoki ORDER_EMAIL_TO sozlanmagan" };
  return sendEmail(process.env.ORDER_EMAIL_TO!, subject, html, text);
}

/** Sends one e-mail to any address (florists). Never throws; reports what really happened. */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (!process.env.SMTP_HOST) return { status: "skipped", detail: "SMTP_HOST sozlanmagan" };
  try {
    const info = await transport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    if (info.rejected?.length) return { status: "failed", detail: `Qabul qilinmadi: ${info.rejected.join(", ")}` };
    return { status: "sent", detail: "Yuborildi" };
  } catch (e) {
    return { status: "failed", detail: `SMTP xatosi: ${(e as Error).message}` };
  }
}

/** Telegram-style HTML (line breaks, <b>, <a>) as an e-mail: subject stays as given. */
export function htmlEmail(body: string) {
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#221a1d">${body.replace(/\n/g, "<br>")}</div>`;
  const text = body
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return { html, text };
}

/** The Telegram message (HTML with line breaks) reused as the e-mail body. */
export function orderEmail(o: OrderForMessage, heading = "Yangi buyurtma", opts: OrderMessageOptions = {}) {
  const { html, text } = htmlEmail(orderMessage(o, heading, opts));
  const subject = `${heading}: ${o.number} — ${o.customerName}`;
  return { subject, html, text };
}

/** Sends and logs the result against the order (channel "email"). */
export async function notifyOrderEmail(o: OrderForMessage, heading?: string, opts: OrderMessageOptions = {}): Promise<SendResult> {
  const { subject, html, text } = orderEmail(o, heading, opts);
  const result = await sendOwnerEmail(subject, html, text);
  const db = await getDb();
  await db.insert(schema.notifications).values({ orderId: o.id, channel: "email", status: result.status, detail: result.detail });
  return result;
}
