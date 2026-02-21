'use client';

import Link from 'next/link';

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
  return (
    <aside className="w-full md:w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
          カテゴリ
        </h2>
        <nav aria-label="カテゴリナビゲーション">
          <ul className="space-y-1">
            {categories.map((category) => {
              const isActive = category.slug === currentSlug;

              return (
                <li key={category.id}>
                  <Link
                    href={`/category/${category.slug}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
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
