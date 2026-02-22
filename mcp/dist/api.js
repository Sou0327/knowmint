import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const CONFIG_DIR = path.join(os.homedir(), ".km");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_BASE_URL = "https://knowledge-market.app";
/** フェッチタイムアウト (ms) */
const FETCH_TIMEOUT_MS = 30_000;
function fatal(msg) {
    process.stderr.write(`[km-mcp] ${msg}\n`);
    process.exit(1);
}
/**
 * baseUrl を検証・正規化する。
 * - userinfo (credentials) を持つ URL を拒否
 * - localhost/127.0.0.1/::1 以外では HTTPS を強制
 * - origin のみ返す (path/query/fragment を除去)
 */
function validateBaseUrl(raw) {
    const cleaned = typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_BASE_URL;
    let parsed;
    try {
        parsed = new URL(cleaned);
    }
    catch {
        fatal(`Invalid base URL: "${cleaned}"`);
    }
    if (parsed.username || parsed.password) {
        fatal("Base URL must not contain credentials (user:pass@...).");
    }
    const isLocal = parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1" ||
        parsed.hostname === "[::1]";
    if (!isLocal && parsed.protocol !== "https:") {
        fatal(`Base URL must use HTTPS for non-localhost hosts. Got: "${parsed.protocol}//..."`);
    }
    return parsed.origin; // scheme + host + port のみ
}
/**
 * apiKey を検証する。km_<64 hex> 形式のみ許可。
 */
function validateApiKey(raw) {
    if (typeof raw !== "string") {
        fatal("API key must be a string. Set KM_API_KEY env or run `km login`.");
    }
    if (!/^km_[a-f0-9]{64}$/i.test(raw)) {
        fatal("API key format is invalid (expected km_<64 hex chars>).");
    }
    return raw;
}
export async function loadConfig() {
    let fileConfig = {};
    try {
        const raw = await fs.readFile(CONFIG_PATH, "utf8");
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            fatal(`~/.km/config.json is not valid JSON. Please fix or delete it and run \`km login\` again.`);
        }
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            fileConfig = parsed;
        }
    }
    catch (e) {
        if (e.code !== "ENOENT")
            throw e;
        // ENOENT: config file not yet created — fall through to env-only mode
    }
    const rawKey = process.env["KM_API_KEY"] ?? fileConfig["apiKey"] ?? null;
    if (!rawKey) {
        fatal("No API key configured. Set KM_API_KEY env var, or run `km login` to save credentials.");
    }
    const apiKey = validateApiKey(rawKey);
    const rawUrl = process.env["KM_BASE_URL"] ?? fileConfig["baseUrl"] ?? DEFAULT_BASE_URL;
    const baseUrl = validateBaseUrl(rawUrl);
    return { apiKey, baseUrl };
}
export class KmApiError extends Error {
    status;
    code;
    constructor(message, status = null, code = null) {
        super(message);
        this.name = "KmApiError";
        this.status = status;
        this.code = code;
    }
}
/**
 * サーバーエラーメッセージをサニタイズする。
 * JSON 応答内の error.message / message フィールドのみ使用し、
 * 生テキスト（HTMLスタックトレース等）は返さない。
 */
function sanitizeServerError(status, json) {
    const obj = json;
    const errObj = obj?.["error"];
    const serverMsg = (typeof errObj?.["message"] === "string" ? errObj["message"] : null) ??
        (typeof obj?.["message"] === "string" ? obj["message"] : null);
    return serverMsg ?? `Request failed with status ${status}`;
}
function buildHeaders(config) {
    return {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
    };
}
function withTimeout(signal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    // 親シグナルがあれば連鎖
    signal?.addEventListener("abort", () => controller.abort());
    return {
        signal: controller.signal,
        cleanup: () => clearTimeout(timer),
    };
}
async function parseResponse(response) {
    const text = await response.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    }
    catch {
        json = null;
    }
    if (!response.ok) {
        const code = json?.["error"]?.["code"] ?? null;
        throw new KmApiError(sanitizeServerError(response.status, json), response.status, code);
    }
    const result = json;
    if (!result || result.success !== true) {
        throw new KmApiError("Unexpected API response shape");
    }
    return result.data;
}
/**
 * X-PAYMENT ヘッダーを付けてリクエストし、HTTP 402 を特別処理する。
 * 402 の場合は PaymentRequiredResponse を返す (throw しない)。
 */
export async function apiRequestWithPayment(config, apiPath, extraHeaders) {
    const url = `${config.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
    const headers = { ...buildHeaders(config), ...extraHeaders };
    const { signal, cleanup } = withTimeout();
    try {
        const response = await fetch(url, { method: "GET", headers, signal });
        if (response.status === 402) {
            const text = await response.text();
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            }
            catch {
                json = null;
            }
            const body = (json ?? {});
            return {
                payment_required: true,
                x402Version: typeof body["x402Version"] === "number" ? body["x402Version"] : undefined,
                accepts: Array.isArray(body["accepts"]) ? body["accepts"] : [],
                error: typeof body["error"] === "string" ? body["error"] : undefined,
            };
        }
        return await parseResponse(response);
    }
    catch (e) {
        if (e.name === "AbortError") {
            throw new KmApiError(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, null);
        }
        throw e;
    }
    finally {
        cleanup();
    }
}
export async function apiRequest(config, apiPath, method = "GET", body) {
    const url = `${config.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
    const headers = buildHeaders(config);
    const { signal, cleanup } = withTimeout();
    try {
        const init = { method, headers, signal };
        if (body !== undefined) {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(body);
        }
        const response = await fetch(url, init);
        return await parseResponse(response);
    }
    catch (e) {
        if (e.name === "AbortError") {
            throw new KmApiError(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, null);
        }
        throw e;
    }
    finally {
        cleanup();
    }
}
export async function apiRequestPaginated(config, apiPath) {
    const url = `${config.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
    const headers = buildHeaders(config);
    const { signal, cleanup } = withTimeout();
    try {
        const response = await fetch(url, { method: "GET", headers, signal });
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        }
        catch {
            json = null;
        }
        if (!response.ok) {
            throw new KmApiError(sanitizeServerError(response.status, json), response.status);
        }
        const result = json;
        if (!result || result.success !== true) {
            throw new KmApiError("Unexpected API response shape");
        }
        return { data: result.data, pagination: result.pagination };
    }
    catch (e) {
        if (e.name === "AbortError") {
            throw new KmApiError(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, null);
        }
        throw e;
    }
    finally {
        cleanup();
    }
}
export async function createAndPublishKnowledge(config, input) {
    const created = await apiRequest(config, "/api/v1/knowledge", "POST", {
        title: input.title,
        description: input.description,
        content_type: input.content_type,
        full_content: input.content,
        preview_content: input.content.slice(0, 280),
        price_sol: input.price_sol ?? null,
        price_usdc: input.price_usdc ?? null,
        tags: input.tags ?? [],
    });
    return apiRequest(config, `/api/v1/knowledge/${encodeURIComponent(created.id)}/publish`, "POST");
}
