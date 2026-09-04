import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function build() {
  const distDir = path.join(__dirname, "../dist");
  const binDir = path.join(__dirname, "../bin");

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const esbuildPath = path.join(__dirname, "../node_modules/esbuild/bin/esbuild");
  const entryPath = path.join(__dirname, "../src/index.ts");
  const bundleJs = path.join(distDir, "index.js");

  execSync(`node "${esbuildPath}" "${entryPath}" --bundle --platform=node --target=node18 --outfile="${bundleJs}" --minify`);

  const jsContent = fs.readFileSync(bundleJs);
  const nativeBinPath = path.join(binDir, "zenryn-termux-arm64");
  
  const nodePath = process.execPath;
  const header = Buffer.from(`#!${nodePath}\n`);
  fs.writeFileSync(nativeBinPath, Buffer.concat([header, jsContent]), { mode: 0o755 });

  console.log(`Successfully built distribution artifact: ${nativeBinPath}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
