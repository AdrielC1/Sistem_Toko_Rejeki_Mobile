export interface CookieResponseLike {
  headers?: {
    get?: (name: string) => string | null;
    getSetCookie?: () => string[];
  };
  _rawHeaders?: [string, string][];
}

export interface SessionCaptureDiagnostics {
  captured: boolean;
  length: number;
}

const POS_SESSION_REGEX = /(?:^|,\s*)pos_session=([A-Za-z0-9_.-]+)/;

/**
 * Extracts `pos_session` across Node/Jest (`getSetCookie`), `expo/fetch` (`_rawHeaders`),
 * and React Native `whatwg-fetch` (`headers.get("set-cookie")`) safely across `Expires` commas.
 */
export function extractPosSessionFromResponse(
  res: CookieResponseLike | null | undefined
): string | null {
  if (!res) {
    return null;
  }

  const candidates: string[] = [];

  // 1. Optional standard WinterCG/Node getSetCookie() (absent on RN whatwg-fetch Headers)
  const getSetCookie = res.headers?.getSetCookie;
  if (typeof getSetCookie === "function") {
    try {
      const cookies = getSetCookie.call(res.headers);
      if (Array.isArray(cookies)) {
        for (const item of cookies) {
          if (typeof item === "string" && item.length > 0) {
            candidates.push(item);
          }
        }
      }
    } catch {
      // Fall through to native _rawHeaders and headers.get
    }
  }

  // 2. expo/fetch native tuple list preserves each Set-Cookie row unjoined
  if (Array.isArray(res._rawHeaders)) {
    for (const entry of res._rawHeaders) {
      if (
        Array.isArray(entry) &&
        entry.length >= 2 &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "string" &&
        entry[0].toLowerCase() === "set-cookie"
      ) {
        candidates.push(entry[1]);
      }
    }
  }

  // 3. Fallback to whatwg-fetch comma-joined headers.get("set-cookie")
  // only when structured Set-Cookie sources produced no rows
  if (candidates.length === 0 && typeof res.headers?.get === "function") {
    const headerStr = res.headers.get("set-cookie");
    if (typeof headerStr === "string" && headerStr.length > 0) {
      candidates.push(headerStr);
    }
  }

  for (const raw of candidates) {
    const match = raw.match(POS_SESSION_REGEX);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Safe boolean + length diagnostics for __DEV__ spike telemetry (never exposes raw token bytes).
 */
export function getSessionCaptureDiagnostics(
  token: string | null
): SessionCaptureDiagnostics {
  const captured = typeof token === "string" && token.length > 0;
  return {
    captured,
    length: captured ? token.length : 0,
  };
}
