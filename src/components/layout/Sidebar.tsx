'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

interface SidebarProps {
  categories: Category[];
  currentSlug?: string;
}

export function Sidebar({ categories, currentSlug }: SidebarProps) {
  const t = useTranslations('Home');
  return (
    <aside className="w-full md:w-64 bg-dq-window-bg border-r-2 border-dq-border">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-dq-gold mb-4">
          {t('categories')}
        </h2>
        <nav aria-label="Category navigation">
          <ul className="space-y-1">
            {categories.map((category) => {
              const isActive = category.slug === currentSlug;

              return (
                <li key={category.id}>
                  <Link
                    href={`/category/${category.slug}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-colors ${
                      isActive
                        ? 'bg-dq-surface text-dq-gold'
                        : 'text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {isActive && (
                      <span className="dq-cursor text-dq-gold">▶</span>
                    )}
                    <span className="text-xl" role="img" aria-label={category.name}>
                      {category.icon}
                    </span>
                    <span className="text-sm font-medium">{category.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
