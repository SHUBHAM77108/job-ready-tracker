const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { SITE_ORIGIN, SsoError, createSsoService } = require("./sso-core");

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const codeStore = {
  async issue(hash, record) {
    await db.collection("nativeSsoCodes").doc(hash).create({
      uid: record.uid,
      origin: record.origin,
      expiresAt: admin.firestore.Timestamp.fromMillis(record.expiresAt),
      usedAt: null,
    });
  },
  async consume(hash, { now, expectedOrigin, currentUid }) {
    const ref = db.collection("nativeSsoCodes").doc(hash);
    return db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new SsoError("invalid_code", 400);
      const record = snapshot.data();
      if (record.usedAt) throw new SsoError("code_already_used", 409);
      if (!(record.expiresAt instanceof admin.firestore.Timestamp) || record.expiresAt.toMillis() <= now) {
        throw new SsoError("code_expired", 410);
      }
      if (record.origin !== expectedOrigin) throw new SsoError("origin_not_allowed", 403);
      if (currentUid && currentUid !== record.uid) throw new SsoError("web_user_mismatch", 409);
      transaction.update(ref, { usedAt: admin.firestore.FieldValue.serverTimestamp() });
      return record.uid;
    });
  },
};

const sso = createSsoService({
  verifyIdToken: (idToken, checkRevoked) => auth.verifyIdToken(idToken, checkRevoked),
  createCustomToken: uid => auth.createCustomToken(uid),
  codeStore,
});

function sendJson(res, status, body) {
  res.set("Cache-Control", "no-store, private");
  res.set("Pragma", "no-cache");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Content-Type-Options", "nosniff");
  return res.status(status).json(body);
}

const options = cors => ({ region: "us-central1", memory: "256MiB", timeoutSeconds: 30, maxInstances: 10, cors });

exports.createNativeSsoCode = onRequest(options(false), async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  const origin = req.get("origin");
  if (origin && origin !== SITE_ORIGIN) return sendJson(res, 403, { error: "origin_not_allowed" });
  const match = /^Bearer ([^\s]+)$/.exec(req.get("authorization") || "");
  if (!match) return sendJson(res, 401, { error: "unauthorized" });
  try {
    return sendJson(res, 200, await sso.issueCode(match[1]));
  } catch (error) {
    if (error instanceof SsoError) return sendJson(res, error.status, { error: error.code });
    return sendJson(res, 500, { error: "sso_unavailable" });
  }
});

exports.exchangeNativeSsoCode = onRequest(options([SITE_ORIGIN]), async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  if (req.get("origin") !== SITE_ORIGIN) return sendJson(res, 403, { error: "origin_not_allowed" });
  try {
    const result = await sso.exchangeCode({
      code: req.body?.code,
      origin: req.get("origin"),
      currentUid: req.body?.currentUid,
    });
    return sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof SsoError) return sendJson(res, error.status, { error: error.code });
    return sendJson(res, 500, { error: "sso_unavailable" });
  }
});
