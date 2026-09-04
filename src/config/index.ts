import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

export interface Config {
  token: string;
  maxBackupSizeBytes: number;
  tempDir: string;
  compressionLevel: number;
  requestTimeoutMs: number;
  concurrency: number;
  retryLimit: number;
  logLevel: string;
}

const TOKEN_FILE_PATH = path.join(os.homedir(), ".zenryn_token");

export async function loadConfig(): Promise<Config> {
  let token = process.env.ZENRYN_TOKEN || "";
  let savedToken = "";

  if (fs.existsSync(TOKEN_FILE_PATH)) {
    try {
      savedToken = fs.readFileSync(TOKEN_FILE_PATH, "utf8").trim();
    } catch {}
  }

  if (!token) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const promptText = savedToken
      ? "enter discord bot token (press enter to use the token you used last time): "
      : "enter discord bot token: ";

    const answer = await new Promise<string>((resolve) => {
      rl.question(promptText, (input) => {
        rl.close();
        resolve(input.trim());
      });
    });

    if (answer) {
      token = answer;
    } else if (savedToken) {
      token = savedToken;
    }
  }

  if (token) {
    try {
      fs.writeFileSync(TOKEN_FILE_PATH, token, { mode: 0o600 });
    } catch {}
  }

  const maxBackupSizeBytes = parseInt(process.env.ZENRYN_MAX_BACKUP_SIZE || "104857600", 10);
  const tempDir = process.env.ZENRYN_TEMP_DIR || process.env.TMPDIR || "/tmp";
  const compressionLevel = parseInt(process.env.ZENRYN_COMPRESSION_LEVEL || "6", 10);
  const requestTimeoutMs = parseInt(process.env.ZENRYN_REQUEST_TIMEOUT || "30000", 10);
  const concurrency = parseInt(process.env.ZENRYN_CONCURRENCY || "5", 10);
  const retryLimit = parseInt(process.env.ZENRYN_RETRY_LIMIT || "3", 10);
  const logLevel = process.env.ZENRYN_LOG_LEVEL || "info";

  return {
    token,
    maxBackupSizeBytes,
    tempDir,
    compressionLevel,
    requestTimeoutMs,
    concurrency,
    retryLimit,
    logLevel,
  };
}

export function generateRandomId(): string {
  return crypto.randomBytes(16).toString("hex");
}
