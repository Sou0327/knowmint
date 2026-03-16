"use client";

import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  label: string;
}

export default function MarkAllReadButton({ label }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        if (authError) console.error("[notifications] auth failed:", authError.message);
        return;
      }

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) {
        console.error("[notifications] mark all read failed:", error.message);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("[notifications] mark all read failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleMarkAllRead}
      disabled={loading}
      className="text-sm text-dq-cyan transition-colors hover:text-dq-gold disabled:opacity-50"
    >
      {loading ? "..." : label}
    </button>
  );
}
