import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import {
  DATASET_ALLOWED_MIME_TYPES,
  DATASET_MAX_FILE_SIZE_BYTES,
  DATASET_BUCKET,
  ensureDatasetBucket,
  sanitizeDatasetFilename,
} from "@/lib/storage/datasets";

interface UploadUrlRequestBody {
  filename?: string;
  content_type?: string;
  size_bytes?: number;
  checksum_sha256?: string;
}

const SHA256_HEX_PATTERN = /^[a-fA-F0-9]{64}$/;

/**
 * POST /api/v1/knowledge/[id]/dataset/upload-url
 * Create a signed upload URL for dataset files.
 */
export const POST = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;

  let body: UploadUrlRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const filename = body.filename?.trim() || "";
  const contentType = body.content_type?.trim() || "application/octet-stream";
  const sizeBytes = body.size_bytes;
  const checksum = body.checksum_sha256?.trim();

  if (!filename) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'filename' is required");
  }

  if (
    typeof sizeBytes !== "number" ||
    !Number.isFinite(sizeBytes) ||
    sizeBytes <= 0
  ) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'size_bytes' must be a positive number");
  }

  if (sizeBytes > DATASET_MAX_FILE_SIZE_BYTES) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      `File size exceeds limit (${DATASET_MAX_FILE_SIZE_BYTES} bytes)`
    );
  }

  if (!DATASET_ALLOWED_MIME_TYPES.includes(contentType)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Unsupported dataset content_type");
  }

  if (checksum && !SHA256_HEX_PATTERN.test(checksum)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'checksum_sha256' must be 64-char hex");
  }

  const admin = getAdminClient();

  const { data: item, error: itemError } = await admin
    .from("knowledge_items")
    .select("id, seller_id, content_type")
    .eq("id", id)
    .single();

  if (itemError || !item) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  if (item.seller_id !== user.userId) {
    return apiError(API_ERRORS.FORBIDDEN, "You can only upload files for your own item");
  }

  if (item.content_type !== "dataset") {
    return apiError(API_ERRORS.BAD_REQUEST, "Only dataset items support file upload");
  }

  try {
    await ensureDatasetBucket(admin);
  } catch (error) {
    console.error("Failed to ensure dataset bucket:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  const safeFilename = sanitizeDatasetFilename(filename);
  const storagePath = `${user.userId}/${id}/${Date.now()}-${safeFilename}`;

  const { data, error } = await admin
    .storage
    .from(DATASET_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("Failed to create signed upload URL:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess({
    bucket: DATASET_BUCKET,
    storage_path: data.path,
    token: data.token,
    signed_url: data.signedUrl,
    expires_in: 3600,
  });
}, { requiredPermissions: ["write"] });
