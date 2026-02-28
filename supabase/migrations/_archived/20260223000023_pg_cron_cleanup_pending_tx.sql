-- pg_cron 拡張は Supabase Dashboard → Database → Extensions から有効化必須
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 30分ごとに pending → failed に更新 (Vercel Cron の代替)
SELECT cron.schedule(
  'cleanup-pending-tx',
  '*/30 * * * *',
  $$
    UPDATE public.transactions
    SET    status     = 'failed',
           updated_at = NOW()
    WHERE  status     = 'pending'
      AND  created_at < NOW() - INTERVAL '30 minutes';
  $$
);
