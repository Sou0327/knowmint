/** Search result item returned from GET /api/v1/knowledge */
export interface SearchItem {
  id: string;
  title: string;
  description: string;
  content_type: string;
  price_sol: number | null;
  price_usdc: number | null;
  tags: string[];
  usefulness_score: number | null;
  preview_content: string | null;
  metadata: {
    domain?: string;
    experience_type?: string;
    source_type?: string;
    applicable_to?: string[];
  } | null;
  seller?: {
    trust_score?: number | null;
  };
}

/** Full knowledge item detail from GET /api/v1/knowledge/:id */
export interface KnowledgeDetail extends SearchItem {
  seller_id: string;
  status: string;
  view_count: number;
  purchase_count: number;
  average_rating: number | null;
  created_at: string;
  updated_at: string;
}

/** Content response from GET /api/v1/knowledge/:id/content */
export interface ContentResponse {
  full_content: string;
  file_url: string | null;
}

/** Purchase response from POST /api/v1/knowledge/:id/purchase */
export interface PurchaseResponse {
  id: string;
  buyer_id: string;
  seller_id: string;
  knowledge_item_id: string;
  amount: number;
  token: string;
  chain: string;
  tx_hash: string;
  status: string;
}
