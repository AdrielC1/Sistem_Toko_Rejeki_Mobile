import {
  extractPosSessionFromResponse,
  getSessionCaptureDiagnostics,
  type CookieResponseLike,
} from "@/services/api/cookieParser";

describe("cookieParser", () => {
  it("extracts pos_session from expo/fetch _rawHeaders tuple array with multiple set-cookie rows", () => {
    const mockRes: CookieResponseLike = {
      _rawHeaders: [
        ["content-type", "application/json"],
        ["set-cookie", "theme=light; Path=/; SameSite=Lax"],
        [
          "Set-Cookie",
          "pos_session=eyJpZCI6IjEifQ.sig_abc-123; Path=/; HttpOnly; SameSite=Lax",
        ],
      ],
    };

    expect(extractPosSessionFromResponse(mockRes)).toBe(
      "eyJpZCI6IjEifQ.sig_abc-123"
    );
  });

  it("extracts pos_session from whatwg-fetch comma-joined headers.get('set-cookie') across Expires commas", () => {
    const joinedSetCookie =
      "csrf_hint=ok; Expires=Thu, 18 Dec 2026 11:00:00 GMT; Path=/, pos_session=payload_1.sig-2; Path=/; Expires=Fri, 18 Dec 2026 11:00:00 GMT; HttpOnly; SameSite=Lax";

    const mockRes: CookieResponseLike = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "set-cookie" ? joinedSetCookie : null,
      },
    };

    expect(extractPosSessionFromResponse(mockRes)).toBe("payload_1.sig-2");
  });

  it("extracts pos_session via optional headers.getSetCookie() fallback in Node/Jest fetch", () => {
    const mockRes: CookieResponseLike = {
      headers: {
        get: () => null,
        getSetCookie: () => [
          "pref=1; Path=/",
          "pos_session=node_payload.node_sig_99; HttpOnly; Path=/",
        ],
      },
    };

    expect(extractPosSessionFromResponse(mockRes)).toBe(
      "node_payload.node_sig_99"
    );
  });

  it("returns null for missing, unrelated, or cleared pos_session cookies", () => {
    const missingCookie: CookieResponseLike = {
      headers: { get: () => null },
    };
    const unrelatedCookie: CookieResponseLike = {
      headers: { get: () => "other_pos_session=should_not_match; Path=/" },
    };
    const clearedCookie: CookieResponseLike = {
      _rawHeaders: [["set-cookie", "pos_session=; Path=/; Max-Age=0"]],
    };

    expect(extractPosSessionFromResponse(missingCookie)).toBeNull();
    expect(extractPosSessionFromResponse(unrelatedCookie)).toBeNull();
    expect(extractPosSessionFromResponse(clearedCookie)).toBeNull();
    expect(extractPosSessionFromResponse(null)).toBeNull();
  });

  it("returns boolean and length diagnostics without exposing raw token bytes", () => {
    const rawToken = "secret_payload_abc.secret_signature_xyz";
    const captured = getSessionCaptureDiagnostics(rawToken);
    const empty = getSessionCaptureDiagnostics(null);

    expect(captured).toEqual({
      captured: true,
      length: rawToken.length,
    });
    expect(JSON.stringify(captured)).not.toContain(rawToken);
    expect(empty).toEqual({
      captured: false,
      length: 0,
    });
  });
});
