import zlib from "zlib";
import { ZenRynBackupData } from "./format";
import { computeHash, verifyHash } from "../security/crypto";

export function serializeBackup(data: Omit<ZenRynBackupData, "integrity">): Buffer {
  const jsonWithoutHash = JSON.stringify(data);
  const hashObj = computeHash(jsonWithoutHash);
  const fullBackup: ZenRynBackupData = {
    ...data,
    integrity: hashObj,
  };

  const finalJson = JSON.stringify(fullBackup);
  const compressed = zlib.gzipSync(Buffer.from(finalJson, "utf8"), { level: 6 });

  const magic = Buffer.from("ZYNREN01", "utf8");
  return Buffer.concat([magic, compressed]);
}

export function deserializeBackup(buffer: Buffer, maxSizeBytes: number): ZenRynBackupData {
  if (buffer.length > maxSizeBytes) {
    throw new Error("backup is invalid bro");
  }

  const magic = buffer.subarray(0, 8).toString("utf8");
  if (magic !== "ZYNREN01") {
    throw new Error("backup is invalid bro");
  }

  const compressedData = buffer.subarray(8);
  let decompressed: Buffer;
  try {
    decompressed = zlib.gunzipSync(compressedData, { maxOutputLength: maxSizeBytes * 5 });
  } catch {
    throw new Error("backup is invalid bro");
  }

  let parsed: ZenRynBackupData;
  try {
    parsed = JSON.parse(decompressed.toString("utf8"));
  } catch {
    throw new Error("backup is invalid bro");
  }

  if (!parsed || parsed.version !== 1 || !parsed.integrity || !parsed.integrity.hash) {
    throw new Error("backup is invalid bro");
  }

  const hashToVerify = parsed.integrity.hash;
  const tempObj: any = { ...parsed };
  delete tempObj.integrity;

  const jsonWithoutHash = JSON.stringify(tempObj);
  if (!verifyHash(jsonWithoutHash, hashToVerify)) {
    throw new Error("backup is invalid bro");
  }

  return parsed;
}
