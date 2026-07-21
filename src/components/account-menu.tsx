"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Heart, LayoutDashboard, Loader2, LogOut, Package, User2 } from "lucide-react";

import { logout } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { name: string; role: "CUSTOMER" | "MANAGER" | "ADMIN" };

const itemClass = "flex w-full items-center gap-2 text-sm outline-none";

export function AccountMenu({ name, role }: Props) {
  const isStaff = role === "ADMIN" || role === "MANAGER";
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="grid size-10 place-items-center rounded-md transition-colors hover:bg-white/10"
      >
        <User2 className="size-[1.15rem]" strokeWidth={1.7} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/*
          Base UI renders DropdownMenuLabel as a Menu.GroupLabel, which throws
          unless it is inside a Menu.Group — so each labelled block is wrapped.
        */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="kicker block text-muted-foreground">Signed in as</span>
            <span className="mt-1 block truncate font-display text-base">{name}</span>
          </DropdownMenuLabel>

          <DropdownMenuItem>
            <Link href="/account" className={itemClass}>
              <User2 className="size-4" strokeWidth={1.7} />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/account/orders" className={itemClass}>
              <Package className="size-4" strokeWidth={1.7} />
              Orders
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href="/account/wishlist" className={itemClass}>
              <Heart className="size-4" strokeWidth={1.7} />
              Wishlist
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {isStaff && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Link href="/admin" className={itemClass}>
                  <LayoutDashboard className="size-4" strokeWidth={1.7} />
                  Admin
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          data-testid="sign-out"
          disabled={pending}
          // Base UI's MenuItem fires `onClick`, not Radix's `onSelect`. An
          // `onSelect` prop typechecks here — React's div props carry a native
          // select event — but never fires on a click, so the handler was dead.
          closeOnClick={false}
          onClick={() => {
            // Hold the menu open until the session is actually cleared, then
            // navigate ourselves — see the note on `logout()`.
            start(async () => {
              await logout();
              router.push("/");
              router.refresh();
            });
          }}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} />
          ) : (
            <LogOut className="size-4" strokeWidth={1.7} />
          )}
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
