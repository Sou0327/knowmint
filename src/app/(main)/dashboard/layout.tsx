import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import DashboardNav from "@/components/dashboard/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col lg:flex-row lg:gap-8">
      <DashboardNav />
      <div className="min-w-0 flex-1 pb-8">{children}</div>
    </div>
  );
}
