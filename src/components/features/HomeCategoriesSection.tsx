// F-9: Home page 分割 — Categories セクション
import { Link } from "@/i18n/navigation";
import LucideIcon from "@/components/ui/LucideIcon";
import { getCategoryDisplayName } from "@/lib/i18n/category";
import type { useTranslations } from "next-intl";

type TranslationsHome = ReturnType<typeof useTranslations<"Home">>;
type TranslationsTypes = ReturnType<typeof useTranslations<"Types">>;

const CATEGORY_ICONS: Record<string, string> = {
  business: "Briefcase",
  "technology-it": "Laptop",
  "design-creative": "Palette",
  "education-learning": "GraduationCap",
  lifestyle: "Leaf",
  prompt: "MessageSquare",
  tool_def: "Settings",
  dataset: "BarChart3",
  api: "Plug",
  general: "BookOpen",
};

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface HomeCategoriesSectionProps {
  tHome: TranslationsHome;
  tTypes: TranslationsTypes;
  categories: Category[];
  categoryCounts: Record<string, number>;
}

export function HomeCategoriesSection({
  tHome,
  tTypes,
  categories,
  categoryCounts,
}: HomeCategoriesSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="shrink-0 font-display text-xl font-bold text-dq-gold">
          {tHome("categories")}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-dq-border to-transparent" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${cat.slug}`}
            className="group rounded-sm dq-window-sm dq-window-hover p-4 text-center"
          >
            <LucideIcon name={CATEGORY_ICONS[cat.slug] ?? "BookOpen"} className="mx-auto mb-2 text-dq-gold" size={28} />
            <span className="text-sm font-medium text-dq-text-sub transition-colors group-hover:text-dq-gold">
              {getCategoryDisplayName(tTypes, cat.slug, cat.name)}
            </span>
            {(categoryCounts[cat.id] ?? 0) > 0 && (
              <span className="text-xs text-dq-text-muted">
                ({categoryCounts[cat.id]})
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
