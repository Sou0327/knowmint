-- Phase MKT-NOW: メールキャプチャ用テーブル
CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'homepage',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_subscribers_email
  ON email_subscribers(LOWER(email));

-- RLS: service_role のみ書き込み可 (Server Action 経由)
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

-- anon/authenticated からの直接アクセスを禁止
REVOKE ALL ON email_subscribers FROM anon, authenticated;
