import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-dq-gold font-display">404</h1>
      <p className="text-dq-text-sub">Page not found</p>
      <Link
        href="/"
        className="text-dq-cyan hover:text-dq-gold transition-colors"
      >
        &larr; Back to home
      </Link>
    </div>
  );
}
