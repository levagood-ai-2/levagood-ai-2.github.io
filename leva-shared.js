// leva account pages: the little bit of plumbing shared by account.html and admin.html.
window.LEVA = (() => {
  const isLocal = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  const API = (() => { try { return localStorage.getItem("leva_api") || (isLocal ? "http://127.0.0.1:8797" : "https://api.levagood.com"); } catch (_) { return "https://api.levagood.com"; } })();
  const session = { get: () => { try { return localStorage.getItem("leva_session") || ""; } catch (_) { return ""; } }, set: (t) => { try { t ? localStorage.setItem("leva_session", t) : localStorage.removeItem("leva_session"); } catch (_) {} } };
  async function call(method, path, body) {
    const r = await fetch(API + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(session.get() ? { Authorization: "Bearer " + session.get() } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let d = {}; try { d = await r.json(); } catch (_) {}
    if (r.status === 401) { session.set(""); }
    return { status: r.status, ...d };
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const day = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
  const ago = (ts) => { if (!ts) return "never"; const s = Date.now() / 1000 - ts; if (s < 90) return "just now"; if (s < 5400) return Math.round(s / 60) + " min ago"; if (s < 129600) return Math.round(s / 3600) + " h ago"; return Math.round(s / 86400) + " days ago"; };
  function planText(u) {
    const e = u.entitlement || {};
    if (u.role === "admin") return "Admin. Everything on.";
    if (e.reason === "complimentary") return `Complimentary through ${day(e.expires_at)}.`;
    if (e.reason === "subscribed") return `Subscribed. Paid through ${day(e.expires_at)}.`;
    if (/grace/.test(e.reason)) return `Your last payment didn't go through. leva keeps working until ${day(e.expires_at)}; please update your card.`;
    if (e.reason === "paid through the period") return `Canceled, but paid through ${day(e.expires_at)}.`;
    if (/canceled|unpaid|expired/.test(e.reason)) return "Subscription ended. The free checks still run; subscribe again for the full read.";
    return "Free. Mechanical checks only.";
  }
  return { API, session, call, esc, day, ago, planText, isLocal };
})();
