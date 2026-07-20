import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = `${source}/${entry.name}`;
    const to = `${destination}/${entry.name}`;
    if (entry.isDirectory()) copyDirectory(from, to);
    else copyFileSync(from, to);
  }
}

const requiredWritingLibraryFiles = [
  "data/writing-library/library.css",
  "data/writing-library/task1/index.html",
  "data/writing-library/task2/index.html",
];

for (const file of requiredWritingLibraryFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing required writing-library asset: ${file}`);
  }
}

const vocabData = {
  reading: JSON.parse(readFileSync("data/ielts-reading-538.json", "utf8")),
  listening: JSON.parse(readFileSync("data/ielts-listening-179.json", "utf8")),
};
writeFileSync(
  "data/vocab-data.js",
  `window.VOCAB_DATA = ${JSON.stringify(vocabData, null, 2)};\n`,
  "utf8",
);

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

copyDirectory("data/writing-library", "dist/data/writing-library");

if (existsSync("data/speaking-source")) {
  copyDirectory("data/speaking-source", "dist/data/speaking-source");
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
