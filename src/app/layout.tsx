import { Geist, Geist_Mono, DotGothic16 } from "next/font/google";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import "./globals.css";

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic",
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type Props = {
  children: React.ReactNode;
};

export default async function RootLayout({ children }: Props) {
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* テーマ初期化: localStorage 保存値を優先、未設定はダーク固定。FOUC を防ぐためインライン実行 */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `(function(){var t='dark';try{var s=localStorage.getItem('km-theme');if(s==='dark'||s==='light')t=s;}catch(e){}document.documentElement.classList.add(t);})();` }} />
      </head>
      <body
        className={`${dotGothic.variable} ${geistSans.variable} ${geistMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
