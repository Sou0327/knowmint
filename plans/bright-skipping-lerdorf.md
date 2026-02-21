# Phase 7: ナレッジメタデータ強化

## Context

エージェントが「この知識は自分に必要か」を判断できるよう、`knowledge_items` に構造化メタデータと品質シグナルを追加する。
- **7.1**: `metadata JSONB` カラムで domain/experience_type/applicable_to/source_type を管理
- **7.2**: フィードバックAPIと `usefulness_score` で、購入後の有用性をシグナル化

---

## 7.1 構造化メタデータ

### Step 1: DB マイグレーション

**新規ファイル**: `supabase/migrations/20260220000013_phase7_metadata_feedback.sql`

```sql
-- 7.1.1: metadata JSONB カラム追加
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 7.2.2: usefulness_score カラム追加
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS usefulness_score DECIMAL(3,2) DEFAULT 0.0
  CHECK (usefulness_score >= 0.0 AND usefulness_score <= 1.0);

-- 7.2.1: フィードバックテーブル
CREATE TABLE IF NOT EXISTS knowledge_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  useful BOOLEAN NOT NULL,
  usage_context TEXT CHECK (char_length(usage_context) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(transaction_id)  -- 1トランザクション=1フィードバック
);

-- RLS
ALTER TABLE knowledge_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyers can insert own feedbacks" ON knowledge_feedbacks
  FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "sellers can read feedbacks on their items" ON knowledge_feedbacks
  FOR SELECT USING (
    knowledge_item_id IN (SELECT id FROM knowledge_items WHERE seller_id = auth.uid())
  );

-- usefulness_score 自動更新トリガー
CREATE OR REPLACE FUNCTION update_usefulness_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE knowledge_items
  SET usefulness_score = (
    SELECT COALESCE(AVG(CASE WHEN useful THEN 1.0 ELSE 0.0 END), 0.0)
    FROM knowledge_feedbacks
    WHERE knowledge_item_id = NEW.knowledge_item_id
  )
  WHERE id = NEW.knowledge_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usefulness_score
AFTER INSERT OR UPDATE ON knowledge_feedbacks
FOR EACH ROW EXECUTE FUNCTION update_usefulness_score();
```

### Step 2: 型定義更新

**変更ファイル**: `src/types/database.types.ts`

`KnowledgeItem` インターフェースに追加:
```ts
metadata: {
  domain?: string;
  experience_type?: string;
  applicable_to?: string[];
  source_type?: string;
} | null;
usefulness_score: number | null;
```

**変更ファイル**: `src/types/knowledge.types.ts`

`KnowledgeFormData` にメタデータフィールドを追加:
```ts
metadata: {
  domain: string;
  experience_type: string;
  applicable_to: string[];
  source_type: string;
};
```

`KnowledgeSearchParams` にメタデータフィルタを追加:
```ts
metadata_domain?: string;
metadata_experience_type?: string;
metadata_applicable_to?: string;
metadata_source_type?: string;
```

### Step 3: 出品フォームにメタデータ入力追加

**変更ファイル**: `src/components/features/ListingForm/BasicInfoStep.tsx`

`BasicInfoData` インターフェースと `onChange` に `metadata` を追加。
フォーム末尾に「詳細メタデータ（任意）」折りたたみセクションを追加:

| フィールド | UI | 選択肢例 |
|---|---|---|
| domain | Select | finance, engineering, marketing, legal, medical, education, other |
| experience_type | Select | case_study, how_to, template, checklist, reference, other |
| applicable_to | Checkbox群 | GPT-4, Claude, Gemini, any |
| source_type | Select | personal_experience, research, industry_standard, other |

`src/app/(main)/list/page.tsx` でフォーム初期値に `metadata: { domain: "", experience_type: "", applicable_to: [], source_type: "" }` を追加。

### Step 4: API レスポンスにメタデータ追加

**変更ファイル**: `src/app/api/v1/knowledge/route.ts`

GET:
- select 句に `metadata`, `usefulness_score` を追加
- クエリパラメータ `metadata_domain`, `metadata_experience_type`, `metadata_applicable_to`, `metadata_source_type` を受け取り、JSONB フィルタを適用:
  ```ts
  if (metadata_domain) {
    query = query.eq("metadata->>domain", metadata_domain);
  }
  ```

POST:
- リクエストボディの `metadata` を INSERT に含める

**変更ファイル**: `src/app/api/v1/knowledge/[id]/route.ts`

GET の select 句に `metadata`, `usefulness_score` を追加。
PATCH で `metadata` の部分更新を許可。

---

## 7.2 エージェント向け品質シグナル

### Step 5: フィードバック API 実装

**新規ファイル**: `src/app/api/v1/knowledge/[id]/feedback/route.ts`

```ts
export const POST = withApiAuth(async (request, user, rateLimit, context) => {
  const { id } = context.params;
  const { useful, usage_context } = await request.json();

  // 購入確認: buyer_id = user.id かつ knowledge_item_id = id のトランザクション存在チェック
  const { data: tx } = await supabase
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("knowledge_item_id", id)
    .eq("status", "confirmed")
    .single();
  if (!tx) return apiError("購入履歴が見つかりません", 403);

  // 既存フィードバック確認（UNIQUE制約でも弾かれるが、先に確認して適切なエラーを返す）
  const { data: existing } = await supabase
    .from("knowledge_feedbacks")
    .select("id")
    .eq("transaction_id", tx.id)
    .single();
  if (existing) return apiError("既にフィードバックを送信済みです", 409);

  // INSERT（トリガーが usefulness_score を自動更新）
  const { error } = await supabase.from("knowledge_feedbacks").insert({
    knowledge_item_id: id,
    buyer_id: user.id,
    transaction_id: tx.id,
    useful,
    usage_context: usage_context ?? null,
  });
  if (error) return apiError("フィードバックの保存に失敗しました", 500);

  return apiSuccess({ message: "フィードバックを送信しました" }, 201);
}, { requiredPermissions: ["write"] });
```

### Step 6: MCP `km_search` 更新

**変更ファイル**: `mcp/src/tools.ts`

`km_search` ツールパラメータに追加:
```ts
metadata_domain: { type: "string", description: "ドメインフィルタ (例: finance, engineering)" },
metadata_experience_type: { type: "string", description: "経験タイプフィルタ (例: case_study, how_to)" },
metadata_source_type: { type: "string", description: "情報ソースフィルタ (例: personal_experience, research)" },
```

**変更ファイル**: `mcp/src/api.ts`

`km_search` の API 呼び出しに `metadata_*` パラメータを追加。
レスポンスに `metadata` と `usefulness_score` をフォーマットして含める:
```
[品質スコア: 0.85] タイトル
タグ: #finance #case_study
メタデータ: ドメイン=finance, 経験タイプ=case_study, ソース=personal_experience
```

---

## 変更ファイル一覧

| ファイル | 種別 | 変更内容 |
|---|---|---|
| `supabase/migrations/20260220000013_phase7_metadata_feedback.sql` | 新規 | metadata/usefulness_score/feedbacks/trigger |
| `src/types/database.types.ts` | 変更 | KnowledgeItem に metadata, usefulness_score 追加 |
| `src/types/knowledge.types.ts` | 変更 | KnowledgeFormData, KnowledgeSearchParams 拡張 |
| `src/components/features/ListingForm/BasicInfoStep.tsx` | 変更 | メタデータ入力セクション追加 |
| `src/app/(main)/list/page.tsx` | 変更 | フォーム初期値に metadata 追加 |
| `src/app/api/v1/knowledge/route.ts` | 変更 | metadata select + JSONB フィルタ + POST body |
| `src/app/api/v1/knowledge/[id]/route.ts` | 変更 | metadata, usefulness_score をレスポンスに含める |
| `src/app/api/v1/knowledge/[id]/feedback/route.ts` | 新規 | フィードバック POST API |
| `mcp/src/tools.ts` | 変更 | km_search にメタデータフィルタ, usefulness_score 表示 |
| `mcp/src/api.ts` | 変更 | metadata フィルタをクエリに追加、レスポンス整形 |

---

## Verification

1. **マイグレーション確認**: `supabase db diff` で差分確認、`supabase db reset` でローカル適用
2. **API テスト**:
   - `GET /api/v1/knowledge?metadata_domain=finance` → フィルタ動作確認
   - `POST /api/v1/knowledge/[id]/feedback` with `useful: true` → 201、`usefulness_score` 更新確認
   - 重複フィードバック → 409
   - 未購入ユーザーのフィードバック → 403
3. **フォーム確認**: `npm run dev` → 出品フォームでメタデータ入力 → DB に保存確認
4. **MCP 確認**: MCP サーバーで `km_search` に `metadata_domain` を渡し、フィルタ結果と `usefulness_score` が返ることを確認
5. **E2E**: `npm run test:e2e:cli-flow` でリグレッション確認
