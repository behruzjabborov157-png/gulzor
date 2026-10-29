"use client";

/** Last-resort boundary (replaces the root layout), so it must render its own <html>. Shown in both languages. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbf6ef", color: "#221a1d", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 500 }}>Nimadir noto‘g‘ri ketdi</h1>
          <p>Sahifani yangilang yoki birozdan so‘ng qayta urinib ko‘ring.</p>
          <p lang="ru" style={{ color: "#6f6266" }}>Что-то пошло не так. Обновите страницу или попробуйте чуть позже.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "12px 24px", borderRadius: 999, border: 0, background: "#7a1732", color: "#fbf6ef", cursor: "pointer" }}>
            Qayta urinish / Повторить
          </button>
        </div>
      </body>
    </html>
  );
}
