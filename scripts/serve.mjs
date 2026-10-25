import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist"),
  port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
http
  .createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        "." + (name === "/" ? "/index.html" : name),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Не найдено");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Local: http://127.0.0.1:${port}`),
  );
