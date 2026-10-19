/**
 * Outbound mail — the only module in the app that speaks to an email provider.
 *
 * Provider-agnostic by construction: a caller hands over a finished
 * `{ subject, html, text }` triple and this module decides whether that
 * reaches a transport, a log line, or nothing at all. Adding a second provider
 * means one function here plus one `MAIL_PROVIDER` value in `env.ts` — no call
 * site changes.
 *
 * ## `MAIL_PROVIDER=none` is the default, and it is a real no-op
 *
 * Nothing is sent, no socket is opened, and `sendMail` resolves with
 * `{ status: "skipped" }`. That is what keeps `bun test` off the network: the
 * integration suite drives the real sign-up, password-reset and
 * email-verification endpoints, and every one of those fires mail. It is also
 * the only safe setting until the sending domain exists (`be-08` is a human
 * task) — mailing from an unverified domain is how a provider ends up
 * blacklisting it.
 *
 * ## Nothing here throws
 *
 * A mail outage must not fail the action the user already completed: better-auth
 * invokes these callbacks inside the request, so a rejected promise surfaces as
 * a 500 on a sign-up that in fact succeeded. Every failure — a transport that
 * rejects, a provider that returns 500, a malformed link — is logged once and
 * returned as a value.
 *
 * ## Templates are HTML strings on purpose
 *
 * A template engine would need a build step, a plugin, or a directory of `.hbs`
 * files watched by `bun run --watch`. Two transactional emails do not justify
 * any of that. They are also *transactional* mail: the whole design brief is
 * "readable in every client, including ones that strip `<style>`", which argues
 * for inline styles and a plain-text alternative rather than for cleverness.
 */
import { env } from "../env";

export type MailProvider = "none" | "reloop";

/** A finished message, ready for a provider. Never logged whole — see below. */
export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Outcome of one send. `skipped` is the `MAIL_PROVIDER=none` path and is a
 * success as far as the request is concerned; `failed` means a real provider
 * rejected or dropped the message.
 */
export type MailResult =
  | { status: "sent" }
  | { status: "skipped"; reason: "provider-disabled" }
  | { status: "failed"; reason: string };

export type MailTransport = (mail: Mail) => Promise<MailResult>;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Brand palette, converted from the OKLCH tokens in `docs/DESIGN.md`.
 *
 * Light ground on purpose: transactional mail is read in whatever the reader's
 * mail client decides, and Gmail's client-side dark-mode inversion of a dark
 * email is the single most reliable way to produce an unreadable message. The
 * accents come from the same tokens, so an email still looks like the product.
 */
const INK = "#101719"; // --foreground, light
const MUTED = "#5c6567"; // a mid tone on the light ground (0.50 0.012 215)
const GROUND = "#f5f7f8"; // --background, light
const CARD = "#ffffff"; // --card, light
const HAIRLINE = "rgba(16, 23, 25, 0.12)"; // --border, light
const CLAY = "#e8796c"; // --accent fill, light

const BODY_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Geist, Helvetica, Arial, sans-serif";

/**
 * Escape before interpolating. The display name is attacker-influenced (anyone
 * can sign up as `<img onerror>` and we will happily put it in their inbox),
 * so this is a correctness requirement, not a nicety.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A link that ends up in an `href`. Only http(s) is allowed: the URL is built
 * by better-auth from `BETTER_AUTH_URL`, so it should never be anything else —
 * but a `javascript:` href in an email is the kind of thing that should be
 * impossible rather than unlikely.
 */
function safeUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`refusing to mail a ${parsed.protocol} URL`);
  }
  return parsed.toString();
}

/** Greeting that degrades to something neutral rather than to "undefined,". */
function greeting(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? `Hi ${escapeHtml(trimmed)},` : "Hi,";
}

/**
 * The shared document. Inline styles only — Outlook's Word renderer drops
 * `<style>` blocks, and the one place a stylesheet is not optional (the dark
 * opt-out) is answered with `<meta name="color-scheme">` below instead.
 */
function layout(options: {
  preheader: string;
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  outro: string;
  reason: string;
}): string {
  const { preheader, heading, intro, ctaLabel, ctaUrl, outro, reason } = options;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};font-family:${BODY_FONT};color:${INK};">
<!-- Hidden in the inbox list, visible in the message: the first line a reader
     sees before they open it. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GROUND};">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${CARD};border:1px solid ${HAIRLINE};border-radius:10px;">
<tr>
<td style="padding:32px 32px 8px 32px;">
<!-- The wordmark is a clay dot plus the product name. The app never sets clay
     on two things at once (DESIGN.md), and the dot is the one thing here. -->
<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${CLAY};vertical-align:middle;margin-right:8px;"></span><span style="font-size:15px;font-weight:600;letter-spacing:-0.01em;vertical-align:middle;">Aggregator</span>
</td>
</tr>
<tr>
<td style="padding:16px 32px 0 32px;">
<h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(heading)}</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:${INK};">${intro}</p>
</td>
</tr>
<tr>
<td align="center" style="padding:4px 32px 24px 32px;">
<a href="${ctaUrl}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;line-height:1;padding:14px 28px;border-radius:6px;">${escapeHtml(ctaLabel)}</a>
</td>
</tr>
<tr>
<td style="padding:0 32px 8px 32px;">
<p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:${MUTED};">${outro}</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">Button not working? Paste this link into your browser:<br /><a href="${ctaUrl}" style="color:${INK};word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>
</td>
</tr>
<tr>
<td style="padding:20px 32px 28px 32px;border-top:1px solid ${HAIRLINE};">
<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">${reason}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

const IGNORE_LINE =
  "You are receiving this because someone used this address to sign up to Aggregator. If that was not you, ignore this email — nothing has changed.";

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * Password reset. The link is the whole email: short subject, one button, the
 * URL repeated as plain text so a client that strips the button still delivers
 * a recoverable password.
 */
export function renderPasswordResetEmail(input: {
  url: string;
  name?: string | null;
}): RenderedEmail {
  const url = safeUrl(input.url);
  return {
    subject: "Reset your Aggregator password",
    html: layout({
      preheader: `Reset your password — ${url}`,
      heading: "Reset your password",
      intro: `${greeting(input.name)}<br /><br />Use the button below to choose a new one. The link works once and expires in an hour.`,
      ctaLabel: "Choose a new password",
      ctaUrl: url,
      outro: "If you did not ask for this, ignore it and nothing changes.",
      reason: IGNORE_LINE,
    }),
    text: [
      greeting(input.name),
      "",
      "Use this link to choose a new password:",
      url,
      "",
      "The link works once and expires in an hour.",
      "",
      "If you did not ask for this, ignore this email — nothing has changed.",
    ].join("\n"),
  };
}

/**
 * Address verification. Same shape as the reset mail on purpose: two
 * transactional templates that look the same are one thing to review, not two.
 */
export function renderVerificationEmail(input: {
  url: string;
  name?: string | null;
}): RenderedEmail {
  const url = safeUrl(input.url);
  return {
    subject: "Verify your email for Aggregator",
    html: layout({
      preheader: `Confirm this address to finish setting up Aggregator — ${url}`,
      heading: "Verify your email",
      intro: `${greeting(input.name)}<br /><br />Confirm this address and you are done. Everything else in Aggregator is already waiting for you.`,
      ctaLabel: "Verify my email",
      ctaUrl: url,
      outro: "The link works once and expires in an hour.",
      reason: IGNORE_LINE,
    }),
    text: [
      greeting(input.name),
      "",
      "Confirm your email address:",
      url,
      "",
      "The link works once and expires in an hour.",
      "",
      "If you did not sign up, ignore this email — nothing has changed.",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

/** Reloop's transactional send endpoint. Everything provider-specific is in
 *  the two functions below this line. */
const RELOOP_ENDPOINT = "https://reloop.sh/api/mail/v1/send";
/** Reloop's default is 30s; a mail send is not worth holding a request open for. */
const RELOOP_TIMEOUT_MS = 10_000;

/**
 * `RELOOP_FROM` in either accepted form: `hello@example.com` or
 * `Aggregator <hello@example.com>`.
 *
 * The API takes the display-name form verbatim, so there is nothing to split —
 * this only fails fast on a value that is obviously not an address, rather than
 * waiting for a 400 on the first reset someone requests.
 */
function assertFrom(from: string): string {
  const address = (/<([^>]+)>/.exec(from)?.[1] ?? from).trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    throw new Error(`RELOOP_FROM is not an email address: ${JSON.stringify(from)}`);
  }
  return from;
}

/**
 * THE provider call. The only place a URL, a header or a payload shape for a
 * real mail API appears in this codebase.
 *
 * Verified against <https://reloop.sh/docs/api/mail/post-api-mail-v1send>:
 * `POST /api/mail/v1/send`, authenticated with an `x-api-key` header (not a
 * bearer token), `from` as a single string, and `html`/`text` at the top level.
 * There is no domain to point at yet, so this cannot be exercised live until
 * `be-08` lands — which is exactly why it is pinned to the published contract
 * rather than to a plausible guess, and why a test asserts the request shape.
 */
export async function sendViaReloop(
  mail: Mail,
  config: { apiKey: string; from: string },
): Promise<MailResult> {
  try {
    const from = assertFrom(config.from);
    const response = await fetch(RELOOP_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
      signal: AbortSignal.timeout(RELOOP_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Reloop answers errors with `{message, why, fix, link}`, and the body can
      // echo the recipient back, so it is logged only on failure and truncated —
      // an operator needs the reason, not the address book.
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      return { status: "failed", reason: `reloop ${response.status}: ${detail}` };
    }
    return { status: "sent" };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The `MAIL_PROVIDER=none` transport.
 *
 * In development it still prints the URL, because that is the only way to
 * complete a password-reset or verification flow locally before a domain
 * exists. In production it refuses to: a reset token in a log stream is a
 * reset token somebody can read, and Render's logs are not a secret store.
 * Under test it prints nothing at all.
 */
async function skipSend(mail: Mail): Promise<MailResult> {
  if (env.NODE_ENV === "development") {
    console.log(`[mail] MAIL_PROVIDER=none — not sent. "${mail.subject}" → ${mail.to}\n[mail] ${mail.text.match(/https?:\/\/\S+/)?.[0] ?? ""}`);
  } else if (env.NODE_ENV === "production") {
    console.warn(
      `[mail] MAIL_PROVIDER=none — "${mail.subject}" was NOT sent. Set MAIL_PROVIDER=reloop and RELOOP_API_KEY to turn mail on.`,
    );
  }
  return { status: "skipped", reason: "provider-disabled" };
}

/**
 * Test seam. `null` restores the transport the environment selects. Exists for
 * the same reason as `resetRateLimits()`: the interesting behaviour is *which*
 * message went out, and asserting that needs somewhere to put it.
 */
let transportOverride: MailTransport | null = null;

export function setMailTransport(next: MailTransport | null): void {
  transportOverride = next;
}

function resolveTransport(): MailTransport {
  if (transportOverride) return transportOverride;
  // `env` has already refused to boot with `reloop` and no credentials, so the
  // non-null assertions here are enforced rather than hopeful.
  if (env.MAIL_PROVIDER === "reloop") {
    const config = {
      apiKey: env.RELOOP_API_KEY!,
      from: env.RELOOP_FROM!,
    };
    return (mail) => sendViaReloop(mail, config);
  }
  return skipSend;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** True when a real provider is configured. */
export function mailEnabled(): boolean {
  return env.MAIL_PROVIDER !== "none";
}

/**
 * Hand a finished message to the configured provider.
 *
 * Resolves rather than rejects in every case — see the module header for why a
 * 500 on a completed sign-up is worse than a lost email.
 */
export async function sendMail(mail: Mail): Promise<MailResult> {
  try {
    const result = await resolveTransport()(mail);
    if (result.status === "failed") {
      // One line, no recipient: an operator needs to know mail is broken, and
      // the address book is not part of that. `be-02` established that emails
      // and reset tokens stay out of the logs.
      console.error(`[mail] send failed: ${result.reason}`);
    }
    return result;
  } catch (error) {
    console.error(
      `[mail] ${error instanceof Error ? error.message : String(error)}`,
    );
    return { status: "failed", reason: "unhandled mail error" };
  }
}

/**
 * Render, then hand to `sendMail`.
 *
 * The render is wrapped for the same reason the transport is: `safeUrl` refuses
 * a non-http link, which is *before* `sendMail`'s own try, so an escaping throw
 * would 500 a request whose action had already succeeded — the exact thing this
 * module promises never happens.
 */
async function sendRendered(
  to: string,
  render: () => RenderedEmail,
): Promise<MailResult> {
  let message: RenderedEmail;
  try {
    message = render();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[mail] ${reason}`);
    return { status: "failed", reason };
  }
  return sendMail({ to, ...message });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  url: string;
  name?: string | null;
}): Promise<MailResult> {
  return sendRendered(input.to, () => renderPasswordResetEmail(input));
}

export async function sendVerificationEmail(input: {
  to: string;
  url: string;
  name?: string | null;
}): Promise<MailResult> {
  return sendRendered(input.to, () => renderVerificationEmail(input));
}
