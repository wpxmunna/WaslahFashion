import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { AdminSidebar } from "@/components/admin/sidebar";
import { AccountMenu } from "@/components/account-menu";
import { requireStaff } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Waslah admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every admin route inherits this gate, so no page can be reached without it.
  const user = await requireStaff();
  const isFullAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-screen bg-secondary/30">
      <AdminSidebar isFullAdmin={isFullAdmin} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <p className="text-sm text-muted-foreground">
              {user.name}
              <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] capitalize">
                {user.role.toLowerCase()}
              </span>
            </p>

            <div className="flex items-center gap-1">
              <Link
                href="/"
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                View store
                <ExternalLink className="size-3.5" strokeWidth={1.7} />
              </Link>
              <div className="text-foreground">
                <AccountMenu name={user.name} role={user.role} />
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
