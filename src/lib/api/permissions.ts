export const ALLOWED_PERMISSIONS = ["read", "write", "admin"] as const;
export type Permission = typeof ALLOWED_PERMISSIONS[number];

export const PERMISSION_OPTIONS = [
  { value: "read", label: "読み取り", description: "ナレッジ検索・取得" },
  { value: "write", label: "書き込み", description: "ナレッジ作成・更新" },
  { value: "admin", label: "管理者", description: "全権限" },
] as const;
