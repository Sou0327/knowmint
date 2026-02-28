#!/usr/bin/env node

import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output, exit } from "node:process";
import { loadOrCreateKeypair, signMessage } from "../lib/keypair.mjs";

const CONFIG_DIR = path.join(os.homedir(), ".km");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

class KmError extends Error {
  constructor(message, status = null, code = null, details = null) {
    super(message);
    this.name = "KmError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function printHelp() {
  console.log(`km - KnowMint CLI

Usage:
  km register [--keypair <path>] [--base-url <url>] [--display-name <name>]
  km wallet-login [--keypair <path>] [--base-url <url>] [--key-name <name>]
  km login --api-key <km_key> [--base-url <url>]
  km logout
  km search <query> [--page <n>] [--per-page <n>] [--json]
  km install <id> [--tx-hash <hash>] [--token SOL|USDC] [--chain solana] [--dir <path>] [--deploy-to claude|opencode]
  km publish prompt <file> --price <amount><SOL|USDC> [--title <text>] [--description <text>] [--tags "a,b"]
  km publish mcp <file> --price <amount><SOL|USDC> [--title <text>] [--description <text>] [--tags "a,b"]
  km publish dataset <file> --price <amount><SOL|USDC> [--title <text>] [--description <text>] [--tags "a,b"] [--content-type <mime>]
  km my purchases [--page <n>] [--per-page <n>] [--json]
  km my listings [--page <n>] [--per-page <n>] [--json]
  km versions <id> [--json]
  km config
  km help
`);
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) {
      positional.push(current);
      continue;
    }

    const eqIndex = current.indexOf("=");
    if (eqIndex !== -1) {
      const key = current.slice(2, eqIndex);
      flags[key] = current.slice(eqIndex + 1);
      continue;
    }

    const key = current.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }

  return { flags, positional };
}

function getFlag(flags, ...names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(flags, name)) {
      return flags[name];
    }
  }
  return undefined;
}

function normalizeBaseUrl(raw) {
  const fallback = raw?.trim() || DEFAULT_BASE_URL;
  const url = fallback.replace(/\/+$/, "");
  // 非 localhost は HTTPS を必須にして API キーの平文送信を防止
  try {
    const parsed = new URL(url);
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1" || parsed.hostname === "[::1]";
    if (!isLocalhost && parsed.protocol !== "https:") {
      throw new KmError(`Non-localhost base URL must use HTTPS: ${url}`);
    }
  } catch (e) {
    if (e instanceof KmError) throw e;
    throw new KmError(`Invalid base URL: ${url}`);
  }
  return url;
}

function toInt(raw, fallback) {
  const parsed = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureApiKeyShape(apiKey) {
  return typeof apiKey === "string" && /^km_[a-f0-9]{64}$/i.test(apiKey);
}

async function loadConfig() {
  let fileConfig = {};
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      fileConfig = parsed;
    }
  } catch {
    fileConfig = {};
  }

  return {
    apiKey: process.env.KM_API_KEY || fileConfig.apiKey || null,
    baseUrl: normalizeBaseUrl(process.env.KM_BASE_URL || fileConfig.baseUrl || DEFAULT_BASE_URL),
  };
}

async function saveConfig(config) {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
  // 既存ファイルの権限も矯正（過去に緩い権限で作成された場合の対策）
  await fs.chmod(CONFIG_DIR, 0o700);
  await fs.chmod(CONFIG_PATH, 0o600);
}

async function parseApiResponse(response) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    // JSON 内のエラーメッセージのみ使用。生テキスト (HTML/スタックトレース等) は露出しない。
    const message =
      json?.error?.message ||
      json?.message ||
      `Request failed with status ${response.status}`;
    throw new KmError(message, response.status, json?.error?.code || null, json || null);
  }

  return json;
}

async function apiJson(config, apiPath, method = "GET", body = undefined) {
  if (!config.apiKey) {
    throw new KmError("Not logged in. Run `km login` first.");
  }

  const url = `${normalizeBaseUrl(config.baseUrl)}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
  };
  const init = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  return parseApiResponse(response);
}

function unwrapData(result) {
  if (!result || result.success !== true) {
    throw new KmError("Unexpected API response shape");
  }
  return result.data;
}

function sanitizeFileName(input) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

function inferTextExtension(contentType) {
  if (contentType === "tool_def") return "json";
  if (contentType === "api") return "md";
  if (contentType === "prompt") return "md";
  if (contentType === "general") return "md";
  return "txt";
}

function pickMimeFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") return "text/csv";
  if (ext === ".json") return "application/json";
  if (ext === ".jsonl" || ext === ".ndjson") return "application/x-ndjson";
  return "application/octet-stream";
}

function parsePrice(rawPrice) {
  if (typeof rawPrice !== "string" || rawPrice.trim() === "") {
    throw new KmError("`--price` is required (example: 0.5SOL)");
  }

  const normalized = rawPrice.replace(/\s+/g, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?)(SOL|USDC)$/i);
  if (!match) {
    throw new KmError("Invalid price format. Use <amount><SOL|USDC> (example: 0.5SOL)");
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new KmError("Price amount must be a positive number");
  }

  return {
    amount,
    token: match[2].toUpperCase(),
  };
}

function parseTags(rawTags) {
  if (!rawTags || typeof rawTags !== "string") return [];
  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function toDisplayPrice(item) {
  const priceSol = item.price_sol ?? null;
  const priceUsdc = item.price_usdc ?? null;
  if (priceSol !== null) return `${priceSol} SOL`;
  if (priceUsdc !== null) return `${priceUsdc} USDC`;
  return "-";
}

function printTable(columns, rows) {
  if (!rows.length) {
    console.log("(empty)");
    return;
  }

  const widths = columns.map((column) =>
    Math.max(
      column.label.length,
      ...rows.map((row) => String(row[column.key] ?? "").length)
    )
  );

  const header = columns
    .map((column, index) => String(column.label).padEnd(widths[index]))
    .join("  ");
  const separator = widths.map((width) => "-".repeat(width)).join("  ");

  console.log(header);
  console.log(separator);
  for (const row of rows) {
    const line = columns
      .map((column, index) => String(row[column.key] ?? "").padEnd(widths[index]))
      .join("  ");
    console.log(line);
  }
}

function makeUniquePath(targetDir, targetName) {
  const ext = path.extname(targetName);
  const base = targetName.slice(0, targetName.length - ext.length);
  let candidate = path.join(targetDir, targetName);
  let counter = 1;
  while (fsSync.existsSync(candidate)) {
    candidate = path.join(targetDir, `${base}-${counter}${ext}`);
    counter += 1;
  }
  return candidate;
}

async function deployArtifact(sourceFilePath, knowledgeId, title, target) {
  const base =
    target === "claude"
      ? path.join(os.homedir(), ".claude", "knowledge_market")
      : path.join(os.homedir(), ".opencode", "knowledge_market");

  const installDir = path.join(base, "installed");
  await fs.mkdir(installDir, { recursive: true });
  const destinationPath = makeUniquePath(installDir, path.basename(sourceFilePath));
  await fs.copyFile(sourceFilePath, destinationPath);

  const manifestPath = path.join(base, "manifest.json");
  let manifest = [];
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      manifest = parsed;
    }
  } catch {
    manifest = [];
  }

  manifest.push({
    knowledge_id: knowledgeId,
    title,
    installed_at: new Date().toISOString(),
    source_path: sourceFilePath,
    deployed_path: destinationPath,
    target,
  });

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  return destinationPath;
}

async function promptForApiKey() {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question("API key (km_...): ");
    return answer.trim();
  } finally {
    rl.close();
  }
}

/**
 * 認証不要 API へ JSON リクエストを送信する (Bearer なし)。
 */
async function apiFetchPublic(baseUrl, apiPath, method, body) {
  const url = `${normalizeBaseUrl(baseUrl)}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers = { Accept: "application/json" };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  return parseApiResponse(response);
}

/**
 * サーバー返却のチャレンジメッセージが期待フォーマットと完全一致するか検証。
 * buildAuthMessage (サーバー側 src/lib/siws/auth-message.ts) と同一テンプレートを
 * クライアント側で再構築し、署名オラクル攻撃を防止する。
 *
 * IMPORTANT: テンプレート変更時は src/lib/siws/auth-message.ts と mcp/src/tools.ts も同期すること。
 */
function validateChallengeMessage(message, wallet, nonce, purpose) {
  const action = purpose === "register"
    ? "register a new account with"
    : "log in with";
  const expected = [
    `KnowMint wants you to ${action} your Solana wallet.`,
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    "",
    "By signing this message you confirm that you own this wallet.",
    "This request does not involve any transaction or transfer of funds.",
  ].join("\n");
  if (message !== expected) {
    throw new KmError("Challenge message does not match expected format. Server may be compromised.");
  }
}

/**
 * ウォレット認証の共通フロー (register / login)。
 * challenge 取得 → メッセージ検証 → 署名 → API 呼び出し → config 保存。
 */
async function walletAuthFlow(args, mode) {
  const { flags } = parseArgs(args);
  const keypairPath = String(getFlag(flags, "keypair") ?? "").trim() || undefined;
  const baseUrl = normalizeBaseUrl(String(getFlag(flags, "base-url") ?? DEFAULT_BASE_URL));

  const { secretKey, wallet } = await loadOrCreateKeypair(keypairPath);
  console.log(`Wallet: ${wallet}`);

  // 1. challenge 取得
  const challengeResult = await apiFetchPublic(baseUrl, "/api/v1/auth/challenge", "POST", {
    wallet,
    purpose: mode,
  });
  const challengeData = challengeResult?.data;
  if (!challengeData?.nonce || !challengeData?.message) {
    throw new KmError("Failed to obtain challenge from server");
  }

  // 2. メッセージ検証 + 署名
  validateChallengeMessage(challengeData.message, wallet, challengeData.nonce, mode);
  const sig = signMessage(secretKey, challengeData.message);

  // 3. mode 固有パラメータ
  const extraParam = mode === "register"
    ? { display_name: String(getFlag(flags, "display-name") ?? "").trim() || undefined }
    : { key_name: String(getFlag(flags, "key-name") ?? "").trim() || undefined };

  const result = await apiFetchPublic(baseUrl, `/api/v1/auth/${mode}`, "POST", {
    wallet,
    signature: sig,
    nonce: challengeData.nonce,
    ...extraParam,
  });
  const data = result?.data;
  if (!data?.api_key) {
    throw new KmError(`${mode === "register" ? "Registration" : "Login"} failed: no API key returned`);
  }

  // 4. config 保存
  await saveConfig({ apiKey: data.api_key, baseUrl });
  const verb = mode === "register" ? "Registered successfully." : "Logged in successfully via wallet signature.";
  console.log(verb);
  console.log(`User ID: ${data.user_id}`);
  console.log(`Base URL: ${baseUrl}`);
}

async function cmdRegister(args) {
  await walletAuthFlow(args, "register");
}

async function cmdWalletLogin(args) {
  await walletAuthFlow(args, "login");
}

async function cmdLogin(args) {
  const { flags } = parseArgs(args);
  let apiKey = String(getFlag(flags, "api-key", "key") ?? "").trim();
  const baseUrl = normalizeBaseUrl(String(getFlag(flags, "base-url") ?? DEFAULT_BASE_URL));

  if (!apiKey) {
    apiKey = await promptForApiKey();
  }

  if (!ensureApiKeyShape(apiKey)) {
    throw new KmError("Invalid API key format. Expected km_<64 hex chars>.");
  }

  const candidateConfig = { apiKey, baseUrl };
  const result = await apiJson(candidateConfig, "/api/v1/knowledge?per_page=1");
  if (!result?.success) {
    throw new KmError("Failed to validate API key");
  }

  await saveConfig(candidateConfig);
  console.log(`Logged in successfully.`);
  console.log(`Base URL: ${baseUrl}`);
}

async function cmdLogout() {
  const current = await loadConfig();
  await saveConfig({ baseUrl: current.baseUrl, apiKey: null });
  console.log("Logged out.");
}

async function cmdConfig() {
  const config = await loadConfig();
  console.log(JSON.stringify({
    baseUrl: config.baseUrl,
    apiKeyConfigured: Boolean(config.apiKey),
  }, null, 2));
}

async function cmdSearch(args) {
  const { flags, positional } = parseArgs(args);
  const query = positional.join(" ").trim();
  if (!query) {
    throw new KmError("Usage: km search <query>");
  }

  const config = await loadConfig();
  const page = toInt(getFlag(flags, "page"), 1);
  const perPage = toInt(getFlag(flags, "per-page", "per_page"), 20);
  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
  });

  const result = await apiJson(config, `/api/v1/knowledge?${params.toString()}`);
  if (getFlag(flags, "json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const rows = (result.data || []).map((item) => ({
    id: item.id,
    title: item.title,
    type: item.content_type,
    price: toDisplayPrice(item),
    trust: item.seller?.trust_score != null
      ? `${Math.round(item.seller.trust_score * 100)}%`
      : "-",
  }));
  printTable(
    [
      { key: "id", label: "ID" },
      { key: "title", label: "TITLE" },
      { key: "type", label: "TYPE" },
      { key: "price", label: "PRICE" },
      { key: "trust", label: "TRUST" },
    ],
    rows
  );

  if (result.pagination) {
    console.log(
      `\nPage ${result.pagination.page}/${result.pagination.total_pages} | total ${result.pagination.total}`
    );
  }
}

async function cmdInstall(args) {
  const { flags, positional } = parseArgs(args);
  const knowledgeId = positional[0];
  if (!knowledgeId) {
    throw new KmError("Usage: km install <id> [--tx-hash <hash>] [--deploy-to claude|opencode]");
  }

  const config = await loadConfig();
  const txHash = String(getFlag(flags, "tx-hash") ?? "").trim();
  const token = String(getFlag(flags, "token") ?? "SOL").toUpperCase();
  const chain = String(getFlag(flags, "chain") ?? "solana");
  const outputDir = path.resolve(String(getFlag(flags, "dir") ?? "./km-downloads"));
  const deployToRaw = String(getFlag(flags, "deploy-to") ?? "").trim();

  const itemResult = await apiJson(config, `/api/v1/knowledge/${encodeURIComponent(knowledgeId)}`);
  const item = unwrapData(itemResult);

  if (txHash) {
    await apiJson(config, `/api/v1/knowledge/${encodeURIComponent(knowledgeId)}/purchase`, "POST", {
      tx_hash: txHash,
      token,
      chain,
    });
    console.log("Purchase recorded.");
  } else {
    console.log("No --tx-hash provided. Skipping purchase step and trying direct content fetch.");
  }

  const contentResult = await apiJson(config, `/api/v1/knowledge/${encodeURIComponent(knowledgeId)}/content`);
  const content = unwrapData(contentResult);

  await fs.mkdir(outputDir, { recursive: true });

  let savedPath = "";
  if (content.full_content) {
    const extension = inferTextExtension(item.content_type);
    const name = sanitizeFileName(`${item.title || knowledgeId}-${knowledgeId}.${extension}`);
    savedPath = makeUniquePath(outputDir, name);
    await fs.writeFile(savedPath, String(content.full_content), "utf8");
  } else if (content.file_url) {
    const fileResponse = await fetch(String(content.file_url));
    if (!fileResponse.ok) {
      throw new KmError(`Failed to download dataset file (${fileResponse.status})`);
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsedUrl = new URL(String(content.file_url));
    const fallbackName = sanitizeFileName(`${item.title || knowledgeId}-${knowledgeId}.bin`);
    const baseName = sanitizeFileName(path.basename(parsedUrl.pathname) || fallbackName);
    const fileName = baseName.includes(".") ? baseName : `${baseName}.bin`;

    savedPath = makeUniquePath(outputDir, fileName);
    await fs.writeFile(savedPath, buffer);
  } else {
    throw new KmError("No downloadable content was returned for this item");
  }

  console.log(`Saved: ${savedPath}`);

  if (deployToRaw) {
    const targets = deployToRaw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

    for (const target of targets) {
      if (target !== "claude" && target !== "opencode") {
        throw new KmError(`Unsupported deploy target: ${target}`);
      }
      const deployedPath = await deployArtifact(savedPath, knowledgeId, item.title, target);
      console.log(`Deployed to ${target}: ${deployedPath}`);
    }
  }
}

async function uploadDatasetToSignedUrl(signedUrl, fileBuffer, contentType) {
  const response = await fetch(String(signedUrl), {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new KmError(
      `Dataset upload failed with status ${response.status}: ${text || "unknown error"}`
    );
  }
}

async function cmdPublish(args) {
  const kind = args[0];
  const targetFile = args[1];
  if (!kind || !targetFile) {
    throw new KmError("Usage: km publish <prompt|mcp|dataset> <file> --price <amount><SOL|USDC>");
  }

  const supportedKinds = new Set(["prompt", "mcp", "dataset"]);
  if (!supportedKinds.has(kind)) {
    throw new KmError("Publish kind must be one of: prompt, mcp, dataset");
  }

  const { flags } = parseArgs(args.slice(2));
  const price = parsePrice(String(getFlag(flags, "price") ?? ""));
  const resolvedPath = path.resolve(targetFile);

  if (!fsSync.existsSync(resolvedPath)) {
    throw new KmError(`File not found: ${resolvedPath}`);
  }

  const fileBuffer = await fs.readFile(resolvedPath);
  const asText = fileBuffer.toString("utf8");
  const fileName = path.basename(resolvedPath);
  const tags = parseTags(String(getFlag(flags, "tags") ?? ""));

  if (kind === "mcp") {
    try {
      JSON.parse(asText);
    } catch {
      throw new KmError("MCP publish requires valid JSON content");
    }
  }

  const contentType = kind === "mcp" ? "tool_def" : kind;
  const title =
    String(getFlag(flags, "title") ?? "").trim() ||
    path.basename(resolvedPath, path.extname(resolvedPath));
  const description =
    String(getFlag(flags, "description") ?? "").trim() ||
    `Published via km CLI (${kind})`;
  const preview =
    kind === "dataset"
      ? `Dataset file: ${fileName}`
      : asText.slice(0, 280);

  const createBody = {
    title,
    description,
    content_type: contentType,
    price_sol: price.token === "SOL" ? price.amount : null,
    price_usdc: price.token === "USDC" ? price.amount : null,
    preview_content: preview,
    full_content: kind === "dataset" ? undefined : asText,
    tags,
  };

  const config = await loadConfig();
  const createResult = await apiJson(config, "/api/v1/knowledge", "POST", createBody);
  const created = unwrapData(createResult);
  const knowledgeId = created.id;

  if (kind === "dataset") {
    const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const datasetMime =
      String(getFlag(flags, "content-type") ?? "").trim() || pickMimeFromFile(resolvedPath);

    const uploadUrlResult = await apiJson(
      config,
      `/api/v1/knowledge/${knowledgeId}/dataset/upload-url`,
      "POST",
      {
        filename: fileName,
        content_type: datasetMime,
        size_bytes: fileBuffer.length,
        checksum_sha256: checksum,
      }
    );
    const uploadData = unwrapData(uploadUrlResult);

    await uploadDatasetToSignedUrl(uploadData.signed_url, fileBuffer, datasetMime);

    await apiJson(
      config,
      `/api/v1/knowledge/${knowledgeId}/dataset/finalize`,
      "POST",
      {
        storage_path: uploadData.storage_path,
        checksum_sha256: checksum,
      }
    );
  }

  const publishedResult = await apiJson(
    config,
    `/api/v1/knowledge/${knowledgeId}/publish`,
    "POST"
  );
  const published = unwrapData(publishedResult);

  console.log(`Published successfully.`);
  console.log(`ID: ${published.id}`);
  console.log(`Status: ${published.status}`);
}

async function cmdMyPurchases(args) {
  const { flags } = parseArgs(args);
  const page = toInt(getFlag(flags, "page"), 1);
  const perPage = toInt(getFlag(flags, "per-page", "per_page"), 20);
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  const config = await loadConfig();
  const result = await apiJson(config, `/api/v1/me/purchases?${params.toString()}`);

  if (getFlag(flags, "json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const rows = (result.data || []).map((entry) => ({
    id: entry.id,
    title: entry.knowledge_item?.title || "-",
    amount: `${entry.amount} ${entry.token}`,
    status: entry.status,
    created: new Date(entry.created_at).toISOString().slice(0, 10),
  }));

  printTable(
    [
      { key: "id", label: "ID" },
      { key: "title", label: "TITLE" },
      { key: "amount", label: "AMOUNT" },
      { key: "status", label: "STATUS" },
      { key: "created", label: "CREATED" },
    ],
    rows
  );

  if (result.pagination) {
    console.log(
      `\nPage ${result.pagination.page}/${result.pagination.total_pages} | total ${result.pagination.total}`
    );
  }
}

async function cmdVersions(args) {
  const { flags, positional } = parseArgs(args);
  const knowledgeId = positional[0];
  if (!knowledgeId) {
    throw new KmError("Usage: km versions <id> [--json] [--page <n>] [--per-page <n>]");
  }

  const config = await loadConfig();
  const page = getFlag(flags, "page") ?? "1";
  const perPage = getFlag(flags, "per-page") ?? "20";
  const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const result = await apiJson(config, `/api/v1/knowledge/${encodeURIComponent(knowledgeId)}/versions?${qs.toString()}`);

  if (getFlag(flags, "json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const rows = (result.data || []).map((v) => ({
    version: `v${v.version_number}`,
    date: new Date(v.created_at).toISOString().slice(0, 10),
    summary: v.change_summary || "-",
  }));

  printTable(
    [
      { key: "version", label: "VERSION" },
      { key: "date", label: "DATE" },
      { key: "summary", label: "SUMMARY" },
    ],
    rows
  );

  if (result.pagination) {
    console.log(
      `\nPage ${result.pagination.page}/${result.pagination.total_pages} | total ${result.pagination.total}`
    );
  }
}

async function cmdMyListings(args) {
  const { flags } = parseArgs(args);
  const page = toInt(getFlag(flags, "page"), 1);
  const perPage = toInt(getFlag(flags, "per-page", "per_page"), 20);
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  const config = await loadConfig();
  const result = await apiJson(config, `/api/v1/me/listings?${params.toString()}`);

  if (getFlag(flags, "json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const rows = (result.data || []).map((entry) => ({
    id: entry.id,
    title: entry.title,
    status: entry.status,
    price: toDisplayPrice(entry),
    purchases: entry.purchase_count,
  }));

  printTable(
    [
      { key: "id", label: "ID" },
      { key: "title", label: "TITLE" },
      { key: "status", label: "STATUS" },
      { key: "price", label: "PRICE" },
      { key: "purchases", label: "PURCHASES" },
    ],
    rows
  );

  if (result.pagination) {
    console.log(
      `\nPage ${result.pagination.page}/${result.pagination.total_pages} | total ${result.pagination.total}`
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "register") {
    await cmdRegister(argv.slice(1));
    return;
  }
  if (command === "wallet-login") {
    await cmdWalletLogin(argv.slice(1));
    return;
  }
  if (command === "login") {
    await cmdLogin(argv.slice(1));
    return;
  }
  if (command === "logout") {
    await cmdLogout();
    return;
  }
  if (command === "config") {
    await cmdConfig();
    return;
  }
  if (command === "search") {
    await cmdSearch(argv.slice(1));
    return;
  }
  if (command === "install") {
    await cmdInstall(argv.slice(1));
    return;
  }
  if (command === "publish") {
    await cmdPublish(argv.slice(1));
    return;
  }
  if (command === "versions") {
    await cmdVersions(argv.slice(1));
    return;
  }
  if (command === "my") {
    const sub = argv[1];
    if (sub === "purchases") {
      await cmdMyPurchases(argv.slice(2));
      return;
    }
    if (sub === "listings") {
      await cmdMyListings(argv.slice(2));
      return;
    }
    throw new KmError("Usage: km my <purchases|listings>");
  }

  throw new KmError(`Unknown command: ${command}`);
}

main().catch((error) => {
  if (error instanceof KmError) {
    if (error.status) {
      console.error(`Error (${error.status}${error.code ? `:${error.code}` : ""}): ${error.message}`);
    } else {
      console.error(`Error: ${error.message}`);
    }
  } else {
    console.error(error);
  }
  exit(1);
});
