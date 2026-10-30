/**
 * Runs once when the server starts. On hosts without a shell (Render) the shop bot's webhook is registered
 * here when TELEGRAM_AUTO_SETUP=1; elsewhere use `npm run telegram:setup` once after deploy.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.TELEGRAM_AUTO_SETUP !== "1") return;
  const { ensureShopBotWebhook } = await import("@/lib/telegram-setup");
  // Not awaited: the server starts answering at once (a sleeping instance may be woken by this very bot).
  void ensureShopBotWebhook().catch((e) => console.error("[telegram] webhook sozlab bo‘lmadi:", (e as Error).message));
}
