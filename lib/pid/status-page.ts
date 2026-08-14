function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function pidStatusPage(input: {
  status: 400 | 404 | 410;
  title: string;
  identifier?: string;
  body: string;
}) {
  const identifier = input.identifier ? escapeHtml(input.identifier) : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(input.title)} | BICUNI</title>
  <style>
    :root{color-scheme:dark;--ink:#f8fafc;--muted:#94a3b8;--line:rgba(148,163,184,.16);--blue:#60a5fa}
    *{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:32px;color:var(--ink);background:#020617;font-family:Inter,Geist,"Segoe UI",sans-serif}
    main{width:min(720px,100%);padding:40px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(145deg,rgba(15,23,42,.82),rgba(8,13,26,.68))}
    .eyebrow{color:#93a8ff;font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    h1{margin:12px 0;font-size:clamp(2rem,6vw,3.4rem);letter-spacing:-.05em;line-height:1}
    p{color:var(--muted);line-height:1.7}
    code{display:inline-block;margin:8px 0 18px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.05);font-size:.9rem;overflow-wrap:anywhere}
    a{display:inline-flex;margin-top:8px;color:white;text-decoration:none;font-weight:750}
    a:hover{color:var(--blue)}
  </style>
</head>
<body>
  <main>
    <span class="eyebrow">BICUNI Persistent Identifier</span>
    <h1>${escapeHtml(input.title)}</h1>
    ${identifier ? `<code>${identifier}</code>` : ""}
    <p>${escapeHtml(input.body)}</p>
    <p><a href="/">Retour à l’accueil BICUNI</a></p>
  </main>
</body>
</html>`;
}
