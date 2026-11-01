const test = require("node:test");
const assert = require("node:assert/strict");
const { CODE_TTL_MS, SITE_ORIGIN, SsoError, createSsoService } = require("../sso-core");

function fixture() {
  let now = 1_800_000_000_000;
  const records = new Map();
  let verifiedUid = "native-user";
  let shouldRejectToken = false;
  const tokens = [];
  const store = {
    async issue(hash, record) { records.set(hash, { ...record, usedAt: false }); },
    async consume(hash, { now: requestTime, expectedOrigin, currentUid }) {
      const record = records.get(hash);
      if (!record) throw new SsoError("invalid_code", 400);
      if (record.usedAt) throw new SsoError("code_already_used", 409);
      if (record.expiresAt <= requestTime) throw new SsoError("code_expired", 410);
      if (record.origin !== expectedOrigin) throw new SsoError("origin_not_allowed", 403);
      if (currentUid && currentUid !== record.uid) throw new SsoError("web_user_mismatch", 409);
      record.usedAt = true;
      return record.uid;
    },
  };
  const service = createSsoService({
    verifyIdToken: async () => {
      if (shouldRejectToken) throw new Error("invalid ID token");
      return { uid: verifiedUid };
    },
    createCustomToken: async uid => { tokens.push(uid); return `custom-token-for-${uid}`; },
    codeStore: store,
    now: () => now,
    makeCode: () => "A".repeat(43),
  });
  return { service, records, tokens, setNow: value => { now = value; }, setVerifiedUid: value => { verifiedUid = value; }, rejectToken: () => { shouldRejectToken = true; } };
}

test("rejects invalid native Firebase ID tokens", async () => {
  const f = fixture();
  f.rejectToken();
  await assert.rejects(() => f.service.issueCode("bad-token"), error => error.code === "unauthorized");
  assert.equal(f.records.size, 0);
});

test("rejects expired one-time codes", async () => {
  const f = fixture();
  const { code } = await f.service.issueCode("valid-id-token");
  f.setNow(1_800_000_000_000 + CODE_TTL_MS + 1);
  await assert.rejects(() => f.service.exchangeCode({ code, origin: SITE_ORIGIN }), error => error.code === "code_expired");
  assert.equal(f.tokens.length, 0);
});

test("rejects malformed or unknown one-time codes", async () => {
  const f = fixture();
  await assert.rejects(() => f.service.exchangeCode({ code: "not-a-code", origin: SITE_ORIGIN }), error => error.code === "invalid_code");
  const unknown = "B".repeat(43);
  await assert.rejects(() => f.service.exchangeCode({ code: unknown, origin: SITE_ORIGIN }), error => error.code === "invalid_code");
  assert.equal(f.tokens.length, 0);
});

test("stores only a hash of the one-time code and rejects an unintended origin", async () => {
  const f = fixture();
  const { code } = await f.service.issueCode("valid-id-token");
  assert.equal(f.records.has(code), false);
  await assert.rejects(() => f.service.exchangeCode({ code, origin: "https://attacker.example" }), error => error.code === "origin_not_allowed");
  assert.equal(f.tokens.length, 0);
});

test("rejects reused one-time codes", async () => {
  const f = fixture();
  const { code } = await f.service.issueCode("valid-id-token");
  await f.service.exchangeCode({ code, origin: SITE_ORIGIN });
  await assert.rejects(() => f.service.exchangeCode({ code, origin: SITE_ORIGIN }), error => error.code === "code_already_used");
  assert.deepEqual(f.tokens, ["native-user"]);
});

test("does not consume a code when the current website user differs", async () => {
  const f = fixture();
  const { code } = await f.service.issueCode("valid-id-token");
  await assert.rejects(() => f.service.exchangeCode({ code, origin: SITE_ORIGIN, currentUid: "different-user" }), error => error.code === "web_user_mismatch");
  assert.equal(f.tokens.length, 0);
  const result = await f.service.exchangeCode({ code, origin: SITE_ORIGIN });
  assert.equal(result.uid, "native-user");
});

test("mints the custom token only for the UID in the verified native ID token", async () => {
  const f = fixture();
  f.setVerifiedUid("verified-user");
  const { code } = await f.service.issueCode("valid-id-token");
  const result = await f.service.exchangeCode({ code, origin: SITE_ORIGIN, currentUid: "verified-user" });
  assert.deepEqual(result, { uid: "verified-user", customToken: "custom-token-for-verified-user" });
});
