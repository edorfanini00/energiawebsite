// ALTCHA proof of work. The browser solves a signed PBKDF2 challenge
// (main.js uses Web Crypto, no third party script); the server checks the
// signature, expiry, origin binding and the solution itself.
import { createHmac, randomInt } from "node:crypto";
import { createChallenge, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";

export const CHALLENGE_SECONDS = 300;
export const CHALLENGE_COST = 1000;
export const CHALLENGE_MAX_COUNTER = 2000;
const ACTION = "energia_inquiry";

const signingKey = (secret, origin) => createHmac("sha256", secret).update(`altcha-energia-v1:${origin}`).digest("hex");

export function issueChallenge(secret, origin, now = Date.now()) {
  return createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: CHALLENGE_COST,
    counter: randomInt(500, CHALLENGE_MAX_COUNTER + 1),
    deriveKey,
    expiresAt: Math.floor(now / 1000) + CHALLENGE_SECONDS,
    data: { origin, action: ACTION },
    hmacSignatureSecret: signingKey(secret, origin),
  });
}

// Returns the challenge signature (the proof's identity) or null. Malformed
// or expensive inputs are rejected before any key derivation.
export async function verifyProof(token, secret, origin, now = Date.now()) {
  try {
    if (typeof token !== "string" || token.length > 2048 || !/^[A-Za-z0-9+/]+={0,2}$/.test(token)) return null;
    const decoded = Buffer.from(token, "base64");
    if (decoded.toString("base64") !== token) return null;
    const { challenge, solution } = JSON.parse(decoded.toString("utf8"));
    const p = challenge?.parameters;
    if (
      !p ||
      !solution ||
      p.algorithm !== "PBKDF2/SHA-256" ||
      p.cost !== CHALLENGE_COST ||
      p.keyLength !== 32 ||
      !/^[a-f0-9]{32}$/.test(p.nonce) ||
      !/^[a-f0-9]{32}$/.test(p.salt) ||
      !/^[a-f0-9]{32}$/.test(p.keyPrefix) ||
      !/^[a-f0-9]{64}$/.test(challenge.signature ?? "") ||
      p.keySignature !== undefined ||
      p.memoryCost !== undefined ||
      p.parallelism !== undefined ||
      !Number.isInteger(p.expiresAt) ||
      p.expiresAt <= now / 1000 ||
      p.expiresAt > now / 1000 + CHALLENGE_SECONDS ||
      p.data?.origin !== origin ||
      p.data?.action !== ACTION ||
      !Number.isInteger(solution.counter) ||
      solution.counter < 0 ||
      solution.counter > CHALLENGE_MAX_COUNTER ||
      typeof solution.derivedKey !== "string" ||
      !/^[a-f0-9]{64}$/.test(solution.derivedKey)
    )
      return null;
    const result = await verifySolution({ challenge, solution, deriveKey, hmacSignatureSecret: signingKey(secret, origin) });
    return result.verified ? challenge.signature : null;
  } catch {
    return null;
  }
}
