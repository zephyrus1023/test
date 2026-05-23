import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import net from "node:net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const OUT_DIR = path.join(ROOT_DIR, "dist-pages");
const REQUESTED_PORT = 4173;
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split("/")[1] || "05_ax_lecture";
const BASE_PATH = process.env.PAGES_BASE_PATH || `/${REPO_NAME}`;

function log(message) {
  process.stdout.write(`[build:pages] ${message}\n`);
}

async function waitForHealth(baseUrl, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/chapters`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for local build server");
}

async function findAvailablePort(startPort) {
  const tryPort = (port) =>
    new Promise((resolve) => {
      const tester = net.createServer();
      tester.unref();
      tester.on("error", () => resolve(false));
      tester.listen(port, "127.0.0.1", () => {
        const address = tester.address();
        const chosen = typeof address === "object" && address ? address.port : port;
        tester.close(() => resolve(chosen));
      });
    });

  const preferred = Number(startPort);
  if (Number.isFinite(preferred) && preferred > 0) {
    const matched = await tryPort(preferred);
    if (matched) return matched;
  }
  return 4071; // fallback
}

async function main() {
  log(`Base Path = ${BASE_PATH}`);
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });
  
  // public 폴더 복사
  await fs.cp(PUBLIC_DIR, OUT_DIR, { recursive: true });
  
  const buildPort = await findAvailablePort(REQUESTED_PORT);
  log(`Starting build server on port = ${buildPort}`);

  const serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(buildPort)
    },
    stdio: "pipe"
  });

  serverProcess.stdout.on("data", (chunk) => {
    const text = String(chunk || "").trim();
    if (text) log(text);
  });

  const cleanup = () => {
    if (!serverProcess.killed) {
      serverProcess.kill("SIGTERM");
    }
  };

  process.on("exit", cleanup);
  
  const baseUrl = `http://127.0.0.1:${buildPort}`;
  await waitForHealth(baseUrl);

  try {
    // 1. 목차 가져오기
    log("Fetching chapters metadata...");
    const chaptersRes = await fetch(`${baseUrl}/api/chapters`);
    const chaptersData = await chaptersRes.json();
    
    // chapters.json 저장
    await fs.mkdir(path.join(OUT_DIR, "data"), { recursive: true });
    await fs.writeFile(
      path.join(OUT_DIR, "data", "chapters.json"),
      JSON.stringify(chaptersData, null, 2),
      "utf8"
    );

    // 2. 각 강의 클립 본문 데이터 가져오기
    log("Fetching clips content...");
    await fs.mkdir(path.join(OUT_DIR, "data", "clips"), { recursive: true });
    
    for (const chapter of chaptersData) {
      for (const clip of chapter.clips || []) {
        log(`Snapping content for clip: ${clip.id}`);
        const clipRes = await fetch(`${baseUrl}/api/content/${clip.id}`);
        const clipData = await clipRes.json();
        
        await fs.writeFile(
          path.join(OUT_DIR, "data", "clips", `${clip.id}.json`),
          JSON.stringify(clipData, null, 2),
          "utf8"
        );
      }
    }

    // 3. static-config.js 생성
    const staticConfig = {
      mode: "static",
      basePath: BASE_PATH
    };
    await fs.writeFile(
      path.join(OUT_DIR, "static-config.js"),
      `window.__AX_STATIC_CONFIG__ = ${JSON.stringify(staticConfig, null, 2)};\n`,
      "utf8"
    );

    // 4. index.html 스크립트 인젝션 수정
    const sourceHtml = await fs.readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
    const indexHtml = sourceHtml.replace(
      '<script src="js/app.js"></script>',
      '<script src="static-config.js"></script>\n  <script src="js/app.js"></script>'
    );
    await fs.writeFile(path.join(OUT_DIR, "index.html"), indexHtml, "utf8");
    await fs.writeFile(path.join(OUT_DIR, "404.html"), indexHtml, "utf8");
    await fs.writeFile(path.join(OUT_DIR, ".nojekyll"), "", "utf8");

    log(`Done compiling! Static site built in: dist-pages`);
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
