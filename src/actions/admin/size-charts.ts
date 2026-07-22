"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { parseSizeChartText } from "@/lib/size-chart";
import { fieldErrors, type FormState } from "@/actions/types";

const nameSchema = z.string().trim().min(2, "Enter a name").max(120);

/** Validate the name + parse the textarea into a chart, collecting errors. */
function read(formData: FormData) {
  const name = nameSchema.safeParse(formData.get("name"));
  const chart = parseSizeChartText(formData.get("data") as string | null);

  const errors: Record<string, string[]> = {};
  if (!name.success) errors.name = z.flattenError(name.error).formErrors;
  if (!chart) errors.data = ["Add a headings row and at least one size row."];

  return { ok: name.success && !!chart, name: name.data, chart, errors };
}

export async function createSizeChart(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = read(formData);
  if (!parsed.ok) {
    return { ...fieldErrors(parsed.errors), message: "Please check the highlighted fields." };
  }

  const created = await prisma.sizeChart.create({
    data: { storeId: DEFAULT_STORE_ID, name: parsed.name!, data: parsed.chart! },
    select: { id: true },
  });

  revalidatePath("/admin/size-charts");
  redirect(`/admin/size-charts/${created.id}?created=1`);
}

export async function updateSizeChart(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.sizeChart.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That size chart no longer exists." };

  const parsed = read(formData);
  if (!parsed.ok) {
    return { ...fieldErrors(parsed.errors), message: "Please check the highlighted fields." };
  }

  await prisma.sizeChart.update({
    where: { id },
    data: { name: parsed.name!, data: parsed.chart! },
  });

  revalidatePath("/admin/size-charts");
  revalidatePath(`/admin/size-charts/${id}`);
  revalidatePath("/shop");
  return { ok: true, message: "Size chart saved." };
}

export async function deleteSizeChart(id: number): Promise<FormState> {
  await requireStaff();

  const chart = await prisma.sizeChart.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!chart) return { ok: false, message: "That size chart no longer exists." };

  // Products reference it with a nullable FK (onDelete: SetNull), so deleting a
  // chart simply unassigns it from any products still using it.
  await prisma.sizeChart.delete({ where: { id } });

  revalidatePath("/admin/size-charts");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true, message: "Size chart deleted." };
}
