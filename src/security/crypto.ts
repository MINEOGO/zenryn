import crypto from "crypto";

export interface CryptoIntegrity {
  algorithm: string;
  hash: string;
}

export function computeHash(data: Buffer | string): CryptoIntegrity {
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  return {
    algorithm: "sha256",
    hash,
  };
}

export function verifyHash(data: Buffer | string, expectedHash: string): boolean {
  const computed = computeHash(data).hash;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash));
}
