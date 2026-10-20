/**
 * The rule that decides whether an unverified account may publish (`be-07`).
 *
 * The suite runs with `ENFORCE_EMAIL_VERIFICATION=true`, so the derived path
 * never executes in an integration test — without this file the most
 * consequential line in `env.ts` would be untested, and it is exactly the line
 * that was wrong the first time it was written.
 */
import { describe, test, expect } from "bun:test";
import { resolveEnforceEmailVerification } from "../../env";

describe("resolveEnforceEmailVerification", () => {
  test("follows the mail provider when unset", () => {
    // The whole point: no way to send the link means no gate to pass.
    expect(resolveEnforceEmailVerification(undefined, "none")).toBe(false);
    expect(resolveEnforceEmailVerification(undefined, "reloop")).toBe(true);
  });

  test("treats an empty or whitespace value as unset", () => {
    expect(resolveEnforceEmailVerification("", "none")).toBe(false);
    expect(resolveEnforceEmailVerification("   ", "reloop")).toBe(true);
  });

  test("an explicit value beats the provider", () => {
    // How the test suite arms the gate with no provider, and how an operator
    // can turn it off once one exists.
    expect(resolveEnforceEmailVerification("true", "none")).toBe(true);
    expect(resolveEnforceEmailVerification("false", "reloop")).toBe(false);
  });

  test("accepts the same spellings as TRUST_PROXY, case-insensitively", () => {
    for (const yes of ["1", "true", "yes", "on", "TRUE", " On "]) {
      expect(resolveEnforceEmailVerification(yes, "none")).toBe(true);
    }
    for (const no of ["0", "false", "no", "off", "FALSE", " Off "]) {
      expect(resolveEnforceEmailVerification(no, "reloop")).toBe(false);
    }
  });
});
