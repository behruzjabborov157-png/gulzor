"use client";

/** Last-resort boundary (replaces the root layout), so it must render its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbf8f3", color: "#2a2a28", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 500 }}>Nimadir noto‘g‘ri ketdi</h1>
          <p>Sahifani yangilang yoki birozdan so‘ng qayta urinib ko‘ring.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "12px 24px", borderRadius: 999, border: 0, background: "#2e4a3b", color: "#fbf8f3", cursor: "pointer" }}>
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  );
}
