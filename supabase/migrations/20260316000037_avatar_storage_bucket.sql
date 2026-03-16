-- Phase AVATAR: AV.1 — avatars バケット + RLS ポリシー
-- Public バケット (2MB, JPEG/PNG/WebP)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- SELECT: 全員読み取り可 (public bucket)
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- INSERT: 認証ユーザーが自分の avatar ファイルにのみアップロード可
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text || '/avatar');

-- UPDATE: 自分の avatar ファイルのみ上書き可 (upsert)
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND name = auth.uid()::text || '/avatar');

-- DELETE: 自分の avatar ファイルのみ削除可
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND name = auth.uid()::text || '/avatar');
