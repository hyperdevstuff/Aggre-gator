/**
 * Email verification (`be-06`).
 *
 * Everything here drives the real `/api/auth` endpoints with the real mailer;
 * the only thing stubbed is the transport, via `setMailTransport`. No message
 * can leave the process, which is also the property `MAIL_PROVIDER=none` exists
 * to guarantee.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../../index";
import { db } from "../../db";
import { user } from "../../db/schema";
import { auth } from "../../utils/auth";
import { mailEnabled, setMailTransport, type Mail } from "../../utils/mail";
import { createTestUser, getSessionCookie, cleanupTestUser } from "./setup";

let sent: Mail[];
let created: string[];

beforeEach(() => {
  sent = [];
  created = [];
  setMailTransport(async (mail) => {
    sent.push(mail);
    return { status: "sent" };
  });
});

afterEach(async () => {
  setMailTransport(null);
  for (const id of created) await cleanupTestUser(id);
});

/** The link the mailer put in the message — the plain-text copy is the one a
 *  client that strips the button would still deliver. */
function linkIn(mail: Mail): string {
  const match = mail.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`no link in:\n${mail.text}`);
  return match[0];
}

async function signUp(email: string, name = "Verify Probe") {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password: "Test1234!" }),
    }),
  );
  const body = await res.json();
  created.push(body.user.id);
  return body;
}

async function requestVerification(email: string) {
  return app.handle(
    new Request("http://localhost/api/auth/send-verification-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
}

describe("verification mail dispatch", () => {
  test("send-verification-email mails the address it was given", async () => {
    const email = `verify-${Date.now()}@example.com`;
    await signUp(email);

    const res = await requestVerification(email);

    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
    expect(sent[0].subject).toBe("Verify your email for Aggregator");
    expect(sent[0].html).toContain("Verify my email");
    // The link is the API's verify endpoint, token and callback included.
    expect(linkIn(sent[0])).toContain("/api/auth/verify-email?token=");
  });

  test("the same address can be sent a second link without an account change", async () => {
    const email = `resend-${Date.now()}@example.com`;
    await signUp(email);

    await requestVerification(email);
    await requestVerification(email);

    // `sendOnSignIn` exists for exactly this moment — a user who lost the first
    // mail — so re-sending has to work rather than 400 on a used token.
    expect(sent).toHaveLength(2);
    expect(linkIn(sent[1])).toContain("/api/auth/verify-email?token=");
  });

  test("an unknown address gets the same answer and no mail", async () => {
    const res = await requestVerification(`nobody-${Date.now()}@example.com`);

    // Identical to the success response on purpose: a different status or body
    // here would turn this endpoint into an account-existence oracle.
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe(true);
    expect(sent).toHaveLength(0);
  });

  test("a signed-in owner re-sending for their own address still gets a mail", async () => {
    const email = `session-${Date.now()}@example.com`;
    await signUp(email);
    const cookie = await getSessionCookie(email, "Test1234!");

    const res = await app.handle(
      new Request("http://localhost/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ email }),
      }),
    );

    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
  });
});

describe("the link works", () => {
  test("following it marks the address verified", async () => {
    const email = `click-${Date.now()}@example.com`;
    const { user: created_user } = await signUp(email);

    expect(created_user.emailVerified).toBe(false);
    await requestVerification(email);

    const res = await app.handle(new Request(linkIn(sent[0])));
    // better-auth redirects to `callbackURL` after verifying; we only care that
    // the row moved, so the status is incidental.
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);

    const [row] = await db.select().from(user).where(eq(user.id, created_user.id));
    expect(row.emailVerified).toBe(true);
  });

  test("a tampered token does not verify the address", async () => {
    const email = `tamper-${Date.now()}@example.com`;
    const { user: created_user } = await signUp(email);
    await requestVerification(email);

    const tampered = linkIn(sent[0]).replace(/token=[^&]+/, "token=not.a.jwt");
    await app.handle(new Request(tampered));

    const [row] = await db.select().from(user).where(eq(user.id, created_user.id));
    expect(row.emailVerified).toBe(false);
  });
});

describe("auth config", () => {
  test("sendOnSignIn is on, so a refused sign-in re-mails the link", () => {
    // Not reachable through the suite: `requireEmailVerification` is
    // `mailEnabled()`, which is false under `MAIL_PROVIDER=none`, so the branch
    // never runs here. Asserting the wiring is the honest version of this test.
    expect(auth.options.emailVerification?.sendOnSignIn).toBe(true);
    expect(auth.options.emailVerification?.autoSignInAfterVerification).toBe(true);
  });

  test("the token lifetime matches the copy in the email", () => {
    // The templates say "expires in an hour"; this is the same number.
    expect(auth.options.emailVerification?.expiresIn).toBe(3600);
  });

  test("sign-in enforcement is off while no provider is configured", () => {
    expect(mailEnabled()).toBe(false);
    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(false);
  });

  test("sendOnSignUp follows enforcement rather than being pinned", async () => {
    // Left unset on purpose so it tracks `requireEmailVerification`: with no
    // provider, a sign-up mails nothing and locks nobody out.
    expect(auth.options.emailVerification?.sendOnSignUp).toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});
