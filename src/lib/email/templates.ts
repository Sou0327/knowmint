/**
 * KnowMint メールテンプレート
 * DQ 風カラー: 背景 #1a1a2e, テキスト #f0e6c8, 金色 #ffd700, シアン #00ffff
 */

const BASE_STYLE = `
  body { background: #1a1a2e; color: #f0e6c8; font-family: 'Courier New', monospace; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 32px auto; padding: 24px; border: 2px solid #ffd700;
               box-shadow: 0 0 16px rgba(255,215,0,0.3); }
  .header { color: #ffd700; font-size: 18px; font-weight: bold; margin-bottom: 16px;
            border-bottom: 1px solid #ffd700; padding-bottom: 8px; }
  .body { line-height: 1.7; }
  .highlight { color: #00ffff; }
  .gold { color: #ffd700; }
  .link { color: #ffd700; text-decoration: none; }
  .footer { margin-top: 24px; font-size: 12px; color: #888; border-top: 1px solid #333;
            padding-top: 12px; }
`.trim();

function safeSubject(s: string): string {
  // メールヘッダインジェクション防止: 改行文字を除去
  return s.replace(/[\r\n]/g, " ");
}

/** siteUrl が http(s) スキーム以外の場合はデフォルトにフォールバック */
function safeSiteUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "https://knowmint.shop";
    }
    return url;
  } catch {
    return "https://knowmint.shop";
  }
}

function wrapHtml(title: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${BASE_STYLE}</style></head><body><div class="container">
${content}
<div class="footer">KnowMint &mdash; Human Knowledge Marketplace</div>
</div></body></html>`;
}

export function purchaseCompletedEmailHtml(opts: {
  sellerName: string;
  itemTitle: string;
  amount: number;
  token: string;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const { sellerName, itemTitle, amount, token, siteUrl } = opts;
  const subject = safeSubject(`[KnowMint] ナレッジが購入されました: ${itemTitle}`);
  const html = wrapHtml(subject, `
<div class="header">&#x2694; KnowMint &#x2014; 購入通知</div>
<div class="body">
  <p><span class="gold">${escapeHtml(sellerName)}</span> さん、おめでとうございます！</p>
  <p>あなたのナレッジが購入されました。</p>
  <p><strong>タイトル:</strong> ${escapeHtml(itemTitle)}</p>
  <p><strong>金額:</strong> <span class="highlight">${amount} ${token}</span></p>
  <p><a href="${safeSiteUrl(siteUrl)}/library" class="link">&#x25B6; ライブラリで確認する</a></p>
</div>`);
  const text = `KnowMint 購入通知\n\n${sellerName}さん、ナレッジが購入されました。\nタイトル: ${itemTitle}\n金額: ${amount} ${token}\n\n${siteUrl}/library`;
  return { subject, html, text };
}

export function apiKeyCreatedEmailHtml(opts: {
  keyName: string;
  permissions: string[];
}): { subject: string; html: string; text: string } {
  const { keyName, permissions } = opts;
  const subject = "[KnowMint] APIキーが作成されました";
  const html = wrapHtml(subject, `
<div class="header">&#x1F511; KnowMint &#x2014; APIキー作成通知</div>
<div class="body">
  <p>新しいAPIキーが作成されました。</p>
  <p><strong>キー名:</strong> <span class="highlight">${escapeHtml(keyName)}</span></p>
  <p><strong>権限:</strong> <span class="gold">${permissions.map(escapeHtml).join(", ")}</span></p>
  <p>身に覚えのない場合は、すぐにキーを削除してください。</p>
</div>`);
  const text = `KnowMint APIキー作成通知\n\nキー名: ${keyName}\n権限: ${permissions.join(", ")}\n\n身に覚えのない場合はすぐにキーを削除してください。`;
  return { subject, html, text };
}

export function apiKeyDeletedEmailHtml(opts: {
  keyName: string;
}): { subject: string; html: string; text: string } {
  const { keyName } = opts;
  const subject = "[KnowMint] APIキーが削除されました";
  const html = wrapHtml(subject, `
<div class="header">&#x1F5D1; KnowMint &#x2014; APIキー削除通知</div>
<div class="body">
  <p>APIキーが削除されました。</p>
  <p><strong>キー名:</strong> <span class="highlight">${escapeHtml(keyName)}</span></p>
  <p>このキーは今後使用できません。</p>
</div>`);
  const text = `KnowMint APIキー削除通知\n\nキー名: ${keyName}\n\nこのキーは今後使用できません。`;
  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
