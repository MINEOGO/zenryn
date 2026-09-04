import { serializeBackup, deserializeBackup } from "../src/storage/serializer";
import { ZenRynBackupData } from "../src/storage/format";
import { computeHash, verifyHash } from "../src/security/crypto";
import { sanitizeFileName } from "../src/utils/temp";

function runTests() {
  const dummyData: Omit<ZenRynBackupData, "integrity"> = {
    version: 1,
    createdAt: new Date().toISOString(),
    guildId: "123456789012345678",
    guildName: "Test Guild",
    description: "A test guild description",
    iconBase64: null,
    bannerBase64: null,
    splashBase64: null,
    roles: [
      {
        id: "111",
        name: "Admin",
        color: 16711680,
        hoist: true,
        position: 1,
        permissions: "8",
        managed: false,
        mentionable: true,
      },
    ],
    channels: [
      {
        id: "222",
        name: "general",
        type: 0,
        position: 0,
        parentId: null,
        topic: "General talk",
        nsfw: false,
        bitrate: null,
        userLimit: null,
        rateLimitPerUser: null,
        permissionOverwrites: [],
      },
    ],
    emojis: [],
    stickers: [],
    webhooks: [],
    autoModRules: [],
  };

  const serialized = serializeBackup(dummyData);
  if (!serialized || serialized.length < 8) {
    throw new Error("Serialization failed");
  }

  const deserialized = deserializeBackup(serialized, 10 * 1024 * 1024);
  if (deserialized.guildName !== "Test Guild" || deserialized.roles.length !== 1) {
    throw new Error("Deserialization assertion failed");
  }

  const hashResult = computeHash("hello world");
  if (!verifyHash("hello world", hashResult.hash)) {
    throw new Error("Crypto verification failed");
  }

  if (sanitizeFileName("hello/world?.txt") !== "hello_world_.txt") {
    throw new Error("Sanitize filename failed");
  }

  let caught = false;
  try {
    deserializeBackup(Buffer.from("ZYNREN01invaliddata"), 1048576);
  } catch (err: any) {
    if (err.message === "backup is invalid bro") {
      caught = true;
    }
  }

  if (!caught) {
    throw new Error("Malformed backup protection failed");
  }

  console.log("All unit tests passed successfully.");
}

runTests();
