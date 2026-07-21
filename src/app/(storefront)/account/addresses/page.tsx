import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { id: "desc" }],
  });

  return (
    <div>
      <h2 className="font-display text-2xl">Delivery addresses</h2>

      {addresses.length === 0 ? (
        <div className="mt-6 border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            No saved addresses yet — the one you enter at checkout will be saved here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="kicker text-muted-foreground">{address.label}</span>
                {address.isDefault && (
                  <span className="kicker bg-accent px-2 py-0.5 text-accent-foreground">
                    Default
                  </span>
                )}
              </div>
              <address className="mt-3 text-sm not-italic leading-relaxed">
                {address.name}
                <br />
                {address.addressLine1}
                {address.addressLine2 && (
                  <>
                    <br />
                    {address.addressLine2}
                  </>
                )}
                <br />
                {[address.city, address.state, address.postalCode]
                  .filter(Boolean)
                  .join(", ")}
                <br />
                {address.country}
                {address.phone && (
                  <>
                    <br />
                    {address.phone}
                  </>
                )}
              </address>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
