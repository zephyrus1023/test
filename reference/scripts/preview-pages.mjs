import http from "node:http";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist-pages");
const PORT = Number(process.env.PREVIEW_PAGES_PORT || 8080);

const MIME_MAP = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4"
};

function normalizeBasePath(input) {
  const raw = String(input || "").trim();
  if (!raw || raw === "/") return "";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

function readBuiltBasePath() {
  const configPath = path.join(DIST_DIR, "static-config.js");
  if (!fsSync.existsSync(configPath)) {
    return "";
  }
  const source = fsSync.readFileSync(configPath, "utf8");
  const match = source.match(/"basePath"\s*:\s*"([^"]*)"/);
  return normalizeBasePath(match?.[1] || "");
}

function contentTypeFor(targetPath) {
  return MIME_MAP[path.extname(targetPath).toLowerCase()] || "application/octet-stream";
}

async function sendFile(res, targetPath) {
  const content = await fs.readFile(targetPath);
  res.writeHead(200, {
    "Content-Type": contentTypeFor(targetPath),
    "Content-Length": content.length
  });
  res.end(content);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveSafeDistPath(relativePath) {
  const normalized = String(relativePath || "").replace(/^\/+/, "");
  const resolved = path.resolve(DIST_DIR, normalized);
  if (!resolved.startsWith(DIST_DIR)) {
    return null;
  }
  return resolved;
}

async function findAvailablePort(startPort, maxAttempts = 20) {
  const tryListen = (port) =>
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

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = Number(startPort) + offset;
    const matched = await tryListen(candidate);
    if (matched) return matched;
  }

  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.unref();
    tester.on("error", reject);
    tester.listen(0, "127.0.0.1", () => {
      const address = tester.address();
      const chosen = typeof address === "object" && address ? address.port : 0;
      tester.close(() => resolve(chosen));
    });
  });
}

async function main() {
  if (!(await pathExists(DIST_DIR))) {
    throw new Error("dist-pages 폴더가 없습니다. 먼저 `npm run build:pages -- --base-path /Lets_AX_EXE`를 실행하세요.");
  }

  const basePath = readBuiltBasePath();
  const mountPath = basePath || "";
  const indexPath = path.join(DIST_DIR, "index.html");
  const notFoundPath = path.join(DIST_DIR, "404.html");
  const listenPort = await findAvailablePort(PORT);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = url.pathname || "/";

      if (pathname === "/") {
        if (mountPath) {
          res.writeHead(302, { Location: `${mountPath}/` });
          res.end();
          return;
        }
        await sendFile(res, indexPath);
        return;
      }

      if (mountPath && (pathname === mountPath || pathname === `${mountPath}/`)) {
        await sendFile(res, indexPath);
        return;
      }

      let relativePath = pathname;
      if (mountPath) {
        if (!pathname.startsWith(`${mountPath}/`)) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }
        relativePath = pathname.slice(mountPath.length);
      }

      const targetPath = resolveSafeDistPath(relativePath);
      if (!targetPath) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Bad request");
        return;
      }

      if (await pathExists(targetPath)) {
        const stat = await fs.stat(targetPath);
        if (stat.isDirectory()) {
          const nestedIndex = path.join(targetPath, "index.html");
          if (await pathExists(nestedIndex)) {
            await sendFile(res, nestedIndex);
            return;
          }
          res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Forbidden");
          return;
        }
        await sendFile(res, targetPath);
        return;
      }

      await sendFile(res, notFoundPath);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(String(error?.message || error || "Server error"));
    }
  });

  server.listen(listenPort, "127.0.0.1", () => {
    const previewUrl = `http://127.0.0.1:${listenPort}${mountPath || "/"}`;
    process.stdout.write(`[preview:pages] serving ${DIST_DIR}\n`);
    process.stdout.write(`[preview:pages] base path = ${mountPath || "/"}\n`);
    if (listenPort !== PORT) {
      process.stdout.write(
        `[preview:pages] port ${PORT} in use, using ${listenPort} instead\n`
      );
    }
    process.stdout.write(`[preview:pages] open ${previewUrl}\n`);
  });
}

main().catch((error) => {
  console.error(`[preview:pages] ${error.message}`);
  process.exit(1);
});
