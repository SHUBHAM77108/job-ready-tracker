const crypto = require("node:crypto");

const CODE_TTL_MS = 2 * 60 * 1000;
const SITE_ORIGIN = "https://build-skills-9320a.web.app";

class SsoError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function createSsoService({ verifyIdToken, createCustomToken, codeStore, now = Date.now, makeCode = () => crypto.randomBytes(32).toString("base64url") }) {
  return {
    async issueCode(idToken) {
      if (typeof idToken !== "string" || !idToken) throw new SsoError("unauthorized", 401);
      let decoded;
      try {
        decoded = await verifyIdToken(idToken, true);
      } catch {
        throw new SsoError("unauthorized", 401);
      }
      if (typeof decoded?.uid !== "string" || !decoded.uid) throw new SsoError("unauthorized", 401);

      const code = makeCode();
      const expiresAt = now() + CODE_TTL_MS;
      await codeStore.issue(crypto.createHash("sha256").update(code).digest("hex"), {
        uid: decoded.uid,
        origin: SITE_ORIGIN,
        expiresAt,
      });
      return { code, expiresInSeconds: CODE_TTL_MS / 1000 };
    },

    async exchangeCode({ code, origin, currentUid }) {
      if (origin !== SITE_ORIGIN) throw new SsoError("origin_not_allowed", 403);
      if (typeof code !== "string" || !/^[A-Za-z0-9_-]{40,64}$/.test(code)) throw new SsoError("invalid_code", 400);
      const hash = crypto.createHash("sha256").update(code).digest("hex");
      const uid = await codeStore.consume(hash, {
        now: now(),
        expectedOrigin: SITE_ORIGIN,
        currentUid: typeof currentUid === "string" && currentUid ? currentUid : null,
      });
      const customToken = await createCustomToken(uid);
      return { customToken, uid };
    },
  };
}

module.exports = { CODE_TTL_MS, SITE_ORIGIN, SsoError, createSsoService };
