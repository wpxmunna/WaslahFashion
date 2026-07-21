"use client";

import { useTransition } from "react";
import { LogIn, LogOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  checkInEmployee,
  checkOutEmployee,
  clearAttendance,
  markAllPresent,
  markRemainingAbsent,
  setAttendanceStatus,
} from "@/actions/admin/attendance";
import {
  DataTable,
  EmptyState,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { BadgeTone } from "@/components/admin/ui";
import type { FormState } from "@/actions/types";
import { cn } from "@/lib/utils";

export type AttendanceRow = {
  employeeId: number;
  code: string;
  name: string;
  department: string | null;
  status: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workHours: number;
  overtimeHours: number;
};

const STATUS_TONES: Record<string, BadgeTone> = {
  PRESENT: "success",
  LATE: "warning",
  HALF_DAY: "warning",
  ABSENT: "danger",
  LEAVE: "info",
  HOLIDAY: "neutral",
};

const MARK_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half day" },
  { value: "ABSENT", label: "Absent" },
  { value: "LEAVE", label: "Leave" },
  { value: "HOLIDAY", label: "Holiday" },
];

export function AttendanceDaily({
  date,
  rows,
}: {
  date: string;
  rows: AttendanceRow[];
}) {
  const [pending, start] = useTransition();

  function run(fn: () => Promise<FormState>) {
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.message ?? "Something went wrong");
    });
  }

  const marked = rows.filter((r) => r.status !== null).length;

  return (
    <Panel
      title="Daily sheet"
      description={`${marked} of ${rows.length} active employees marked.`}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => markAllPresent(date))}
          >
            Mark all present
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => markRemainingAbsent(date))}
          >
            Mark rest absent
          </Button>
        </>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No active employees"
          description="Add employees before recording attendance."
        />
      ) : (
        <div className={cn(pending && "opacity-60")}>
          <DataTable>
            <THead>
              <Th>Employee</Th>
              <Th>Status</Th>
              <Th align="center">In</Th>
              <Th align="center">Out</Th>
              <Th align="right">Hours</Th>
              <Th align="right">Overtime</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </THead>
            <TBody>
              {rows.map((row) => (
                <tr key={row.employeeId} className="hover:bg-secondary/40">
                  <Td>
                    <span className="block font-medium">{row.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {row.code}
                      {row.department && ` · ${row.department}`}
                    </span>
                  </Td>
                  <Td>
                    {row.status ? (
                      <StatusBadge
                        label={row.status.replace(/_/g, " ").toLowerCase()}
                        tone={STATUS_TONES[row.status] ?? "neutral"}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Not marked</span>
                    )}
                  </Td>
                  <Td align="center" className="tabular-nums">
                    {row.checkIn ?? "—"}
                  </Td>
                  <Td align="center" className="tabular-nums">
                    {row.checkOut ?? "—"}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {row.workHours > 0 ? row.workHours.toFixed(2) : "—"}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {row.overtimeHours > 0 ? row.overtimeHours.toFixed(2) : "—"}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => checkInEmployee(row.employeeId, date))}
                        aria-label={`Check in ${row.name}`}
                        title="Check in"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-secondary"
                      >
                        <LogIn className="size-3.5" strokeWidth={1.8} />
                        In
                      </button>
                      <button
                        type="button"
                        disabled={pending || !row.checkIn}
                        onClick={() => run(() => checkOutEmployee(row.employeeId, date))}
                        aria-label={`Check out ${row.name}`}
                        title="Check out"
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-secondary disabled:opacity-40"
                      >
                        <LogOut className="size-3.5" strokeWidth={1.8} />
                        Out
                      </button>

                      <label className="contents">
                        <span className="sr-only">{`Set status for ${row.name}`}</span>
                        <select
                          value={row.status ?? ""}
                          disabled={pending}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              run(() =>
                                setAttendanceStatus(row.employeeId, date, value),
                              );
                            }
                          }}
                          className="h-7 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                        >
                          <option value="">Mark…</option>
                          {MARK_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        disabled={pending || row.status === null}
                        onClick={() => run(() => clearAttendance(row.employeeId, date))}
                        aria-label={`Clear record for ${row.name}`}
                        title="Clear record"
                        className="inline-flex size-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-secondary disabled:opacity-40"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={1.8} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        </div>
      )}
    </Panel>
  );
}
