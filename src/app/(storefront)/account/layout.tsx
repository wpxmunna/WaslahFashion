import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { AccountNav } from "@/components/account-nav";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/account");

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <header>
        <p className="kicker text-[color:var(--accent)]">Your account</p>
        <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-tight tracking-tight">
          {user.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        <div className="rule-gold mt-5" />
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
        <AccountNav />
        <div>{children}</div>
      </div>

      <p className="mt-16 text-xs text-muted-foreground">
        Need help?{" "}
        <Link href="/" className="link-wipe">
          Get in touch
        </Link>
        .
      </p>
    </div>
  );
}
