export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-dq-bg bg-[radial-gradient(circle_at_1px_1px,_rgb(255_255_255_/_0.03)_1px,_transparent_0)] bg-[size:24px_24px]">
      <div className="w-full max-w-md px-6 py-12">{children}</div>
    </div>
  );
}
