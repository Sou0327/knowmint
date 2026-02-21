#!/usr/bin/env node

/**
 * E2E check:
 * Run km flow from an empty HOME directory:
 * login -> search -> install -> publish -> deploy
 *
 * This script starts a local mock API server and verifies CLI side effects.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const API_KEY = `km_${"a".repeat(64)}`;
const SEEDED_ID = "11111111-1111-4111-8111-111111111111";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const kmEntryPath = path.join(repoRoot, "cli/bin/km.mjs");
const keepArtifacts = process.env.KEEP_KM_E2E_ARTIFACTS === "1";

function toInt(raw, fallback) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function unauthorized(res) {
  json(res, 401, {
    success: false,
    error: { code: "unauthorized", message: "Unauthorized" },
  });
}

async function parseBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

function extractLineValue(output, prefix) {
  const line = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  if (!line) return null;
  return line.slice(prefix.length).trim();
}

async function runKm(args, env, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [kmEntryPath, ...args], {
      env,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function assertSuccess(step, result) {
  if (result.code !== 0) {
    throw new Error(
      `${step} failed (exit ${result.code})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
}

const knowledgeItems = new Map([
  [
    SEEDED_ID,
    {
      id: SEEDED_ID,
      title: "Seed Prompt",
      description: "Seeded knowledge item",
      content_type: "prompt",
      price_sol: 0.1,
      price_usdc: null,
      status: "published",
      tags: ["seed"],
    },
  ],
]);

const knowledgeContents = new Map([
  [
    SEEDED_ID,
    {
      full_content: "# Seed Prompt\nThis is a seeded prompt.",
      file_url: null,
    },
  ],
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${API_KEY}`) {
      unauthorized(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/v1/knowledge") {
      const query = (url.searchParams.get("query") || "").toLowerCase();
      const page = toInt(url.searchParams.get("page"), 1);
      const perPage = toInt(url.searchParams.get("per_page"), 20);
      const allPublished = [...knowledgeItems.values()].filter(
        (item) => item.status === "published"
      );
      const filtered = query
        ? allPublished.filter(
            (item) =>
              item.title.toLowerCase().includes(query) ||
              item.description.toLowerCase().includes(query)
          )
        : allPublished;
      const from = (page - 1) * perPage;
      const sliced = filtered.slice(from, from + perPage);
      json(res, 200, {
        success: true,
        data: sliced,
        pagination: {
          page,
          per_page: perPage,
          total: filtered.length,
          total_pages: Math.max(1, Math.ceil(filtered.length / perPage)),
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/knowledge") {
      const body = await parseBody(req);
      const id = randomUUID();
      const item = {
        id,
        title: String(body.title || "Untitled"),
        description: String(body.description || ""),
        content_type: String(body.content_type || "prompt"),
        price_sol:
          typeof body.price_sol === "number" ? body.price_sol : null,
        price_usdc:
          typeof body.price_usdc === "number" ? body.price_usdc : null,
        status: "draft",
        tags: Array.isArray(body.tags) ? body.tags : [],
      };
      knowledgeItems.set(id, item);
      knowledgeContents.set(id, {
        full_content: body.full_content ?? null,
        file_url: null,
      });
      json(res, 201, { success: true, data: item });
      return;
    }

    const itemMatch = url.pathname.match(/^\/api\/v1\/knowledge\/([^/]+)$/);
    if (req.method === "GET" && itemMatch) {
      const item = knowledgeItems.get(itemMatch[1]);
      if (!item) {
        json(res, 404, {
          success: false,
          error: { code: "not_found", message: "Knowledge item not found" },
        });
        return;
      }
      json(res, 200, { success: true, data: item });
      return;
    }

    const contentMatch = url.pathname.match(
      /^\/api\/v1\/knowledge\/([^/]+)\/content$/
    );
    if (req.method === "GET" && contentMatch) {
      const id = contentMatch[1];
      const content = knowledgeContents.get(id);
      if (!content) {
        json(res, 404, {
          success: false,
          error: { code: "not_found", message: "Content not found" },
        });
        return;
      }
      json(res, 200, { success: true, data: content });
      return;
    }

    const publishMatch = url.pathname.match(
      /^\/api\/v1\/knowledge\/([^/]+)\/publish$/
    );
    if (req.method === "POST" && publishMatch) {
      const id = publishMatch[1];
      const item = knowledgeItems.get(id);
      if (!item) {
        json(res, 404, {
          success: false,
          error: { code: "not_found", message: "Knowledge item not found" },
        });
        return;
      }
      item.status = "published";
      knowledgeItems.set(id, item);
      json(res, 200, { success: true, data: item });
      return;
    }

    json(res, 404, {
      success: false,
      error: { code: "not_found", message: "Route not found in mock server" },
    });
  } catch (error) {
    json(res, 500, {
      success: false,
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
});

let tempHome = "";
let tempWork = "";

try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine mock server address");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "km-e2e-home-"));
  tempWork = await fs.mkdtemp(path.join(os.tmpdir(), "km-e2e-work-"));

  const publishFilePath = path.join(tempWork, "publish.md");
  const downloadDir = path.join(tempWork, "downloads");

  await fs.writeFile(
    publishFilePath,
    "# Published Prompt\nThis prompt is published by km CLI e2e.",
    "utf8"
  );

  const env = {
    ...process.env,
    HOME: tempHome,
    USERPROFILE: tempHome,
  };

  const login = await runKm(
    ["login", "--api-key", API_KEY, "--base-url", baseUrl],
    env,
    repoRoot
  );
  assertSuccess("login", login);
  assert.match(login.stdout, /Logged in successfully\./);

  const configPath = path.join(tempHome, ".km", "config.json");
  const configRaw = await fs.readFile(configPath, "utf8");
  const config = JSON.parse(configRaw);
  assert.equal(config.apiKey, API_KEY);
  assert.equal(config.baseUrl, baseUrl);

  const search = await runKm(["search", "Seed Prompt"], env, repoRoot);
  assertSuccess("search", search);
  assert.match(search.stdout, new RegExp(SEEDED_ID));

  const firstInstall = await runKm(
    ["install", SEEDED_ID, "--dir", downloadDir],
    env,
    repoRoot
  );
  assertSuccess("install (seed item)", firstInstall);
  const firstSavedPath = extractLineValue(firstInstall.stdout, "Saved:");
  assert.ok(firstSavedPath, "Saved path is missing for first install");
  await fs.access(firstSavedPath);

  const publish = await runKm(
    [
      "publish",
      "prompt",
      publishFilePath,
      "--price",
      "0.5SOL",
      "--title",
      "CLI Flow Prompt",
      "--tags",
      "e2e,flow",
    ],
    env,
    repoRoot
  );
  assertSuccess("publish", publish);
  const publishedId = extractLineValue(publish.stdout, "ID:");
  assert.ok(publishedId, "Published ID is missing");

  const deployInstall = await runKm(
    [
      "install",
      publishedId,
      "--dir",
      downloadDir,
      "--deploy-to",
      "claude",
    ],
    env,
    repoRoot
  );
  assertSuccess("install + deploy", deployInstall);
  const deployedPath = extractLineValue(deployInstall.stdout, "Deployed to claude:");
  assert.ok(deployedPath, "Deploy output is missing");
  await fs.access(deployedPath);

  const manifestPath = path.join(
    tempHome,
    ".claude",
    "knowledge_market",
    "manifest.json"
  );
  const manifestRaw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  assert.ok(Array.isArray(manifest), "Manifest must be an array");
  assert.ok(
    manifest.some(
      (entry) =>
        entry.knowledge_id === publishedId && entry.target === "claude"
    ),
    "Manifest is missing deployed item entry"
  );

  console.log(
    "PASS: empty environment flow succeeded (login -> search -> install -> publish -> deploy)"
  );
} finally {
  server.close();
  if (!keepArtifacts) {
    if (tempHome) await fs.rm(tempHome, { recursive: true, force: true });
    if (tempWork) await fs.rm(tempWork, { recursive: true, force: true });
  } else {
    if (tempHome) console.log(`KEEP_KM_E2E_ARTIFACTS: HOME=${tempHome}`);
    if (tempWork) console.log(`KEEP_KM_E2E_ARTIFACTS: WORK=${tempWork}`);
  }
}
