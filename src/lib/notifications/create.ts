import { getAdminClient } from "@/lib/supabase/admin";

export async function notifyPurchase(
  sellerId: string,
  buyerName: string,
  item: { id: string; title: string },
  amount: number,
  token: string
) {
  const admin = getAdminClient();
  await admin.rpc("create_notification", {
    p_user_id: sellerId,
    p_type: "purchase",
    p_title: "新しい購入がありました",
    p_message: `${buyerName} が「${item.title}」を ${amount} ${token} で購入しました`,
    p_link: `/knowledge/${item.id}`,
    p_metadata: { item_id: item.id, amount, token },
  });
}

export async function notifyReview(
  sellerId: string,
  reviewerName: string,
  item: { id: string; title: string },
  rating: number
) {
  const admin = getAdminClient();
  await admin.rpc("create_notification", {
    p_user_id: sellerId,
    p_type: "review",
    p_title: "新しいレビューが投稿されました",
    p_message: `${reviewerName} が「${item.title}」に ★${rating} のレビューを投稿しました`,
    p_link: `/knowledge/${item.id}`,
    p_metadata: { item_id: item.id, rating },
  });
}

export async function notifyFollow(
  userId: string,
  followerName: string,
  followerId: string
) {
  const admin = getAdminClient();
  await admin.rpc("create_notification", {
    p_user_id: userId,
    p_type: "follow",
    p_title: "新しいフォロワー",
    p_message: `${followerName} があなたをフォローしました`,
    p_link: `/search?seller=${followerId}`,
    p_metadata: { follower_id: followerId },
  });
}

export async function notifyNewListing(
  followerId: string,
  sellerName: string,
  item: { id: string; title: string }
) {
  const admin = getAdminClient();
  await admin.rpc("create_notification", {
    p_user_id: followerId,
    p_type: "new_listing",
    p_title: "フォロー中の出品者が新規出品",
    p_message: `${sellerName} が「${item.title}」を出品しました`,
    p_link: `/knowledge/${item.id}`,
    p_metadata: { item_id: item.id, seller_name: sellerName },
  });
}
