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

function setDomTheme(theme: Theme): boolean {
  const root = document.documentElement;
  // 目的テーマのみ付いている正常状態なら no-op
  if (root.classList.contains(theme) && !root.classList.contains(theme === 'dark' ? 'light' : 'dark')) {
    return false;
  }
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  return true;
}

function subscribe(callback: () => void): () => void {
  // matchMedia 非対応環境用の fallback mq (OS追従なし)
  const hasMatchMedia = typeof window.matchMedia === 'function';
  const mq = hasMatchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  // OS テーマ変更: localStorage に保存値がない場合のみ追従し DOM も更新
  // DOM が実際に変わった場合のみ callback() を呼ぶ (不要な再レンダー防止)
  const handleMqChange = () => {
    if (!mq) return;
    let changed = false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored !== 'dark' && stored !== 'light') {
        changed = setDomTheme(getOsTheme(mq));
      }
    } catch {
      // localStorage 不可: OS テーマに追従
      changed = setDomTheme(getOsTheme(mq));
    }
    if (changed) callback();
  };

  // 別タブでの localStorage 変更 / 削除 / clear
  // e.key === null は localStorage.clear() を示す
  const handleStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    const newTheme = e.newValue;
    const fallback: Theme = mq ? getOsTheme(mq) : 'dark';
    const changed = newTheme === 'dark' || newTheme === 'light'
      ? setDomTheme(newTheme)
      : setDomTheme(fallback); // 削除 / クリア → OS 追従
    if (changed) callback();
  };

  window.addEventListener('km-theme-change', callback);
  window.addEventListener('storage', handleStorage);

  // MediaQueryList.addEventListener は Safari 14+ / Chrome 79+ から対応。
  // 旧環境では deprecated の addListener にフォールバック。
  if (mq) {
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleMqChange);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mq as any).addListener(handleMqChange);
    }
  }

  return () => {
    window.removeEventListener('km-theme-change', callback);
    window.removeEventListener('storage', handleStorage);
    if (mq) {
      if (typeof mq.removeEventListener === 'function') {
        mq.removeEventListener('change', handleMqChange);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mq as any).removeListener(handleMqChange);
      }
    }
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
