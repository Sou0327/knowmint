'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'km-theme';

function getOsTheme(mq: MediaQueryList): Theme {
  return mq.matches ? 'dark' : 'light';
}

/**
 * DOM クラスを source of truth とする。
 * 外部変更（OS / 別タブ）は subscribe のハンドラが DOM も更新するため、
 * snapshot は常に DOM を読めば正しい値が得られる。
 */
function getThemeSnapshot(): Theme {
  const root = document.documentElement;
  if (root.classList.contains('dark')) return 'dark';
  if (root.classList.contains('light')) return 'light';
  // FOUC script が付与するため通常はここに到達しないが、念のため fallback
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

function getServerSnapshot(): Theme {
  return 'dark';
}

function setDomTheme(theme: Theme) {
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(theme);
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  // OS テーマ変更: localStorage に保存値がない場合のみ追従し DOM も更新
  const handleMqChange = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored !== 'dark' && stored !== 'light') {
        setDomTheme(getOsTheme(mq));
      }
    } catch {
      // localStorage 不可: OS テーマに追従
      setDomTheme(getOsTheme(mq));
    }
    callback();
  };

  // 別タブでの localStorage 変更 / 削除 / clear
  // e.key === null は localStorage.clear() を示す
  const handleStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    const newTheme = e.newValue;
    if (newTheme === 'dark' || newTheme === 'light') {
      setDomTheme(newTheme);
    } else {
      // 削除 / クリア → OS 追従
      setDomTheme(getOsTheme(mq));
    }
    callback();
  };

  window.addEventListener('km-theme-change', callback);
  window.addEventListener('storage', handleStorage);
  mq.addEventListener('change', handleMqChange);

  return () => {
    window.removeEventListener('km-theme-change', callback);
    window.removeEventListener('storage', handleStorage);
    mq.removeEventListener('change', handleMqChange);
  };
}

function applyTheme(theme: Theme) {
  setDomTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // QuotaExceededError 等: DOM への反映は完了済みなので続行
  }
  window.dispatchEvent(new Event('km-theme-change'));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);
  const t = useTranslations('Nav');

  const toggle = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  return (
    // aria-label は SSR/CSR で同一の静的ラベルを使用（hydration mismatch を防ぐ）
    // アイコンのみ suppressHydrationWarning で不一致を許容（hydration 直後に修正される）
    // role="switch" + aria-checked でスクリーンリーダーに現在のテーマ状態を伝える
    // aria-label は静的（SSR/CSR で同一）。aria-checked が動的状態を担う
    <button
      type="button"
      role="switch"
      aria-checked={theme === 'dark'}
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 text-dq-text-sub hover:text-dq-gold transition-colors"
      aria-label={t('themeToggle')}
      title={theme === 'dark' ? t('themeToggleToLight') : t('themeToggleToDark')}
    >
      <span aria-hidden="true" suppressHydrationWarning>
        {theme === 'dark' ? '☀' : '☾'}
      </span>
    </button>
  );
}
