import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) {
      return next();
    }
    const accept = String(req.headers.accept || "");
    if (!accept.includes("text/html")) {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
