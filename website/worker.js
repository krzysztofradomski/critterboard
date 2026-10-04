// Waitlist endpoint. Everything else is a static asset (served before this runs).
// Stores email -> ISO date in KV, matching the page's privacy note.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/waitlist") return env.ASSETS.fetch(request);
    if (request.method !== "POST") return new Response(null, { status: 405 });

    const form = await request.formData().catch(() => null);
    if (!form) return new Response("bad request", { status: 400 });
    // Honeypot filled: pretend it worked so bots don't retry.
    if (form.get("bot-field")) return new Response(null, { status: 204 });

    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) {
      return new Response("invalid email", { status: 400 });
    }
    // Re-signups keep the original date.
    if ((await env.WAITLIST.get(email)) === null) {
      await env.WAITLIST.put(email, new Date().toISOString());
    }
    return new Response(null, { status: 204 });
  },
};
