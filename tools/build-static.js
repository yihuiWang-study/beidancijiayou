import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/data", { recursive: true });
mkdirSync("dist/server", { recursive: true });
mkdirSync("dist/.openai", { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  cpSync(file, `dist/${file}`);
}

for (const file of ["vocab-data.js", "speaking-data.js", "writing-data.js", "ielts-speaking-topics.json"]) {
  cpSync(`data/${file}`, `dist/data/${file}`);
}

for (const file of ["ielts-task-1-soro.pdf", "ielts-task-2-soro.pdf"]) {
  if (existsSync(`data/${file}`)) cpSync(`data/${file}`, `dist/data/${file}`);
}

if (existsSync(".openai/hosting.json")) {
  cpSync(".openai/hosting.json", "dist/.openai/hosting.json");
}

const assets = {
  "/": readFileSync("index.html", "utf8"),
  "/index.html": readFileSync("index.html", "utf8"),
  "/styles.css": readFileSync("styles.css", "utf8"),
  "/app.js": readFileSync("app.js", "utf8"),
  "/data/vocab-data.js": readFileSync("data/vocab-data.js", "utf8"),
  "/data/speaking-data.js": readFileSync("data/speaking-data.js", "utf8"),
  "/data/writing-data.js": readFileSync("data/writing-data.js", "utf8"),
  "/data/ielts-speaking-topics.json": readFileSync("data/ielts-speaking-topics.json", "utf8"),
};

writeFileSync(
  "dist/server/index.js",
  `const assets = ${JSON.stringify(assets)};

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function contentType(pathname) {
  if (pathname.endsWith(".css")) return types[".css"];
  if (pathname.endsWith(".js")) return types[".js"];
  if (pathname.endsWith(".json")) return types[".json"];
  return types[".html"];
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/" : url.pathname;
    const body = assets[pathname] || assets["/index.html"];
    return new Response(body, {
      headers: {
        "content-type": contentType(pathname),
        "cache-control": pathname.includes("vocab-data") ? "public, max-age=3600" : "no-cache"
      }
    });
  }
};
`,
);
