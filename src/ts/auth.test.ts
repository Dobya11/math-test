import { describe, expect, it } from "vitest";
import { getAuthEmailForUsername } from "./auth.ts";

describe("username authentication", () => {
  it("maps usernames to a stable, normalized Supabase email", () => {
    expect(getAuthEmailForUsername("  User_Olya ")).toBe(
      "user_olya@login.math-test.invalid",
    );
  });
});
