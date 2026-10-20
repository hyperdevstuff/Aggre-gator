/**
 * The mailer, asserted without sending anything.
 *
 * `MAIL_PROVIDER=none` is what the suite runs under, so `fetch` is replaced with
 * a thrower for the whole file: if any path in here reached the network, the
 * test fails instead of quietly mailing a real address. The one place a real
 * payload shape appears is `sendViaReloop`, and that is exercised against a
 * stub — headers and body asserted, nothing dispatched.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  mailEnabled,
  renderPasswordResetEmail,
  renderVerificationEmail,
  sendMail,
  sendPasswordResetEmail,
  sendViaReloop,
  sendVerificationEmail,
  setMailTransport,
  type Mail,
} from "../../utils/mail";

const RESET_URL = "http://localhost:3001/api/auth/reset-password/reset-token";
const VERIFY_URL = "http://localhost:3001/api/auth/verify-email?token=abc123";

/** Anything reaching here is a bug: the default provider sends nothing. */
const networkTripwire = () => {
  throw new Error("mail.test.ts attempted a network call");
};

let realFetch: typeof fetch;
let sent: Mail[];

beforeEach(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = networkTripwire as unknown as typeof fetch;
  sent = [];
  // Capture what *would* be sent so dispatch can be asserted without a provider.
  setMailTransport(async (mail) => {
    sent.push(mail);
    return { status: "sent" };
  });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  setMailTransport(null);
});

describe("provider selection", () => {
  test("the suite runs with no provider configured", () => {
    expect(mailEnabled()).toBe(false);
  });
});

describe("sendMail under MAIL_PROVIDER=none", () => {
  test("resolves as skipped without opening a socket", async () => {
    setMailTransport(null);
    const result = await sendMail({
      to: "nobody@example.com",
      subject: "Anything",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(result).toEqual({ status: "skipped", reason: "provider-disabled" });
    // `fetch` is a thrower for this whole file, so reaching here is the proof.
  });
});

describe("renderPasswordResetEmail", () => {
  const mail = renderPasswordResetEmail({ url: RESET_URL, name: "Ada" });

  test("has a subject that says what it is", () => {
    expect(mail.subject).toBe("Reset your Aggregator password");
  });

  test("links to the reset URL in both parts", () => {
    expect(mail.html).toContain(`href="${RESET_URL}"`);
    expect(mail.text).toContain(RESET_URL);
  });

  test("greets by name, and says the link expires", () => {
    expect(mail.html).toContain("Hi Ada,");
    expect(mail.text).toContain("expires in an hour");
  });

  test("carries a preheader so the inbox preview is not the subject alone", () => {
    expect(mail.html).toMatch(/display:none[^>]*>Reset your password/);
  });

  test("falls back to a neutral greeting when there is no name", () => {
    expect(renderPasswordResetEmail({ url: RESET_URL }).html).toContain("Hi,");
    expect(renderPasswordResetEmail({ url: RESET_URL }).text).toContain("Hi,");
  });

  test("is a complete HTML document with inline styles only", () => {
    expect(mail.html.startsWith("<!doctype html>")).toBe(true);
    expect(mail.html).toContain("<meta name=\"color-scheme\" content=\"light\" />");
    // A <style> block is the first thing Outlook's Word renderer drops.
    expect(mail.html).not.toContain("<style");
  });
});

describe("renderVerificationEmail", () => {
  const mail = renderVerificationEmail({ url: VERIFY_URL, name: "Ada" });

  test("links to the verification URL in both parts", () => {
    expect(mail.html).toContain(`href="${VERIFY_URL}"`);
    expect(mail.text).toContain(VERIFY_URL);
    expect(mail.subject).toBe("Verify your email for Aggregator");
  });
});

describe("interpolation safety", () => {
  test("escapes a display name instead of mailing raw HTML", () => {
    const mail = renderPasswordResetEmail({
      url: RESET_URL,
      name: '<img src=x onerror="alert(1)">',
    });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
  });

  test("refuses a non-http link rather than emitting an unsafe href", () => {
    expect(() =>
      renderVerificationEmail({ url: "javascript:alert(1)" }),
    ).toThrow(/refusing to mail/);
  });
});

describe("dispatch", () => {
  test("sendPasswordResetEmail hands the rendered template to the transport", async () => {
    const result = await sendPasswordResetEmail({
      to: "ada@example.com",
      url: RESET_URL,
      name: "Ada",
    });

    expect(result).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ada@example.com");
    expect(sent[0].subject).toBe("Reset your Aggregator password");
    expect(sent[0].text).toContain(RESET_URL);
  });

  test("sendVerificationEmail hands the rendered template to the transport", async () => {
    const result = await sendVerificationEmail({
      to: "ada@example.com",
      url: VERIFY_URL,
      name: "Ada",
    });

    expect(result).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Verify your email for Aggregator");
    expect(sent[0].html).toContain(VERIFY_URL);
  });

  test("a transport that throws is reported, not propagated", async () => {
    setMailTransport(async () => {
      throw new Error("provider exploded");
    });
    // better-auth calls these inside the request; a rejection here would turn a
    // completed sign-up into a 500.
    const result = await sendVerificationEmail({
      to: "ada@example.com",
      url: VERIFY_URL,
    });
    expect(result.status).toBe("failed");
  });

  test("a link that cannot be rendered is reported, not thrown", async () => {
    // `safeUrl` throws before `sendMail` is reached, so without the guard this
    // would escape the callback and 500 a sign-up that already succeeded.
    const result = await sendVerificationEmail({
      to: "ada@example.com",
      url: "javascript:alert(1)",
    });
    expect(result.status).toBe("failed");
    expect(sent).toHaveLength(0);
  });
});

describe("sendViaReloop", () => {
  const mail: Mail = {
    to: "ada@example.com",
    subject: "Verify your email for Aggregator",
    html: "<p>hi</p>",
    text: "hi",
  };

  async function captureFetch(response: Response) {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    globalThis.fetch = (async (input: any, init?: any) => {
      calls.push({ url: String(input), init });
      return response;
    }) as unknown as typeof fetch;
    return calls;
  }

  test("POSTs the documented Reloop request and nothing else", async () => {
    const calls = await captureFetch(
      new Response(JSON.stringify({ success: true, messageId: "msg_1" }), {
        status: 200,
      }),
    );

    const result = await sendViaReloop(mail, {
      apiKey: "re_test_key",
      from: "Aggregator <hello@aggregator.test>",
    });

    expect(result).toEqual({ status: "sent" });
    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    // From https://reloop.sh/docs/api/mail/post-api-mail-v1send — this shape is
    // the whole point of the test: `be-08` blocks a live send, so a wrong URL,
    // header or field name would otherwise go unnoticed until the first reset.
    expect(url).toBe("https://reloop.sh/api/mail/v1/send");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("re_test_key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBeUndefined();

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      from: "Aggregator <hello@aggregator.test>",
      to: "ada@example.com",
      subject: "Verify your email for Aggregator",
      html: "<p>hi</p>",
      text: "hi",
    });
  });

  test("passes a bare address through as the sender", async () => {
    const calls = await captureFetch(new Response("{}", { status: 200 }));

    await sendViaReloop(mail, {
      apiKey: "re_test_key",
      from: "hello@aggregator.test",
    });

    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.from).toBe("hello@aggregator.test");
  });

  test("reports a provider rejection instead of throwing", async () => {
    await captureFetch(new Response("quota exceeded", { status: 429 }));

    const result = await sendViaReloop(mail, {
      apiKey: "re_test_key",
      from: "hello@aggregator.test",
    });

    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain("429");
  });

  test("reports a transport error instead of throwing", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await sendViaReloop(mail, {
      apiKey: "re_test_key",
      from: "hello@aggregator.test",
    });

    expect(result).toEqual({ status: "failed", reason: "ECONNREFUSED" });
  });

  test("rejects a RELOOP_FROM that is not an address", async () => {
    await captureFetch(new Response("{}", { status: 200 }));

    const result = await sendViaReloop(mail, {
      apiKey: "re_test_key",
      from: "not-an-address",
    });

    expect(result.status).toBe("failed");
  });
});
