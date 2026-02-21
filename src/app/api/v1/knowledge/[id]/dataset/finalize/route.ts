import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import {
  DATASET_BUCKET,
  buildDatasetFileUrl,
  createDatasetSignedDownloadUrl,
  ensureDatasetBucket,
  normalizeDatasetStoragePath,
} from "@/lib/storage/datasets";

interface FinalizeDatasetRequestBody {
  storage_path?: string;
  checksum_sha256?: string;
}

const SHA256_HEX_PATTERN = /^[a-fA-F0-9]{64}$/;

/**
 * POST /api/v1/knowledge/[id]/dataset/finalize
 * Finalize dataset upload and attach file URL to the knowledge content record.
 */
export const POST = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;

  let body: FinalizeDatasetRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const storagePathRaw = body.storage_path?.trim() || "";
  if (!storagePathRaw) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'storage_path' is required");
  }

  if (body.checksum_sha256 && !SHA256_HEX_PATTERN.test(body.checksum_sha256)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'checksum_sha256' must be 64-char hex");
  }

  const storagePath = normalizeDatasetStoragePath(storagePathRaw);
  const expectedPrefix = `${user.userId}/${id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return apiError(
      API_ERRORS.FORBIDDEN,
      "storage_path must be under your own item namespace"
    );
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
    return apiError(API_ERRORS.FORBIDDEN, "You can only finalize your own item upload");
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

  const { data: signedProbe, error: signedProbeError } = await admin
    .storage
    .from(DATASET_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (signedProbeError || !signedProbe?.signedUrl) {
    return apiError(API_ERRORS.BAD_REQUEST, "Uploaded file not found in storage");
  }

  const fileUrl = buildDatasetFileUrl(storagePath);
  const { data: existingContent } = await admin
    .from("knowledge_item_contents")
    .select("id")
    .eq("knowledge_item_id", id)
    .maybeSingle();

  if (existingContent?.id) {
    const { error: updateError } = await admin
      .from("knowledge_item_contents")
      .update({
        file_url: fileUrl,
        full_content: null,
      })
      .eq("knowledge_item_id", id);

    if (updateError) {
      console.error("Failed to update dataset content:", updateError);
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }
  } else {
    const { error: insertError } = await admin
      .from("knowledge_item_contents")
      .insert({
        knowledge_item_id: id,
        file_url: fileUrl,
        full_content: null,
      });

    if (insertError) {
      console.error("Failed to insert dataset content:", insertError);
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }
  }

  const signedDownloadUrl = await createDatasetSignedDownloadUrl(admin, fileUrl, 900);

  return apiSuccess({
    bucket: DATASET_BUCKET,
    storage_path: storagePath,
    file_url: signedDownloadUrl || fileUrl,
    canonical_file_url: fileUrl,
  });
}, { requiredPermissions: ["write"] });
