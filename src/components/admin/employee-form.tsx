"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createEmployee, updateEmployee } from "@/actions/admin/employees";
import { initialFormState } from "@/actions/types";
import {
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { CURRENCY } from "@/lib/config";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from "./employee-form-constants";

export type EmployeeFormValues = {
  id?: number;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  nationalId: string;
  address: string;
  city: string;
  departmentId: string;
  designation: string;
  employmentType: string;
  hireDate: string;
  terminationDate: string;
  basicSalary: string;
  bankName: string;
  bankAccount: string;
  mobileBanking: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: string;
  notes: string;
};

export function EmployeeForm({
  values,
  departments,
  photoUrl,
}: {
  values: EmployeeFormValues;
  departments: { id: number; name: string }[];
  photoUrl?: string | null;
}) {
  const isEdit = typeof values.id === "number";
  const action = isEdit ? updateEmployee.bind(null, values.id as number) : createEmployee;

  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Personal details">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="code"
                label="Employee code"
                required
                hint="Unique within the store, e.g. EMP-001."
                defaultValue={values.code}
                errors={e.code}
              />
              <SelectField
                name="gender"
                label="Gender"
                placeholder="Not specified"
                options={[
                  { value: "MALE", label: "Male" },
                  { value: "FEMALE", label: "Female" },
                  { value: "OTHER", label: "Other" },
                ]}
                defaultValue={values.gender}
                errors={e.gender}
              />
              <TextField
                name="firstName"
                label="First name"
                required
                defaultValue={values.firstName}
                errors={e.firstName}
              />
              <TextField
                name="lastName"
                label="Last name"
                defaultValue={values.lastName}
                errors={e.lastName}
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                defaultValue={values.email}
                errors={e.email}
              />
              <TextField
                name="phone"
                label="Phone"
                type="tel"
                defaultValue={values.phone}
                errors={e.phone}
              />
              <TextField
                name="dateOfBirth"
                label="Date of birth"
                type="date"
                defaultValue={values.dateOfBirth}
                errors={e.dateOfBirth}
              />
              <TextField
                name="nationalId"
                label="National ID"
                defaultValue={values.nationalId}
                errors={e.nationalId}
              />
              <TextareaField
                name="address"
                label="Address"
                rows={2}
                defaultValue={values.address}
                errors={e.address}
                className="sm:col-span-2"
              />
              <TextField
                name="city"
                label="City"
                defaultValue={values.city}
                errors={e.city}
              />
            </div>
          </Panel>

          <Panel title="Employment">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <SelectField
                name="departmentId"
                label="Department"
                placeholder="Unassigned"
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                defaultValue={values.departmentId}
                errors={e.departmentId}
              />
              <TextField
                name="designation"
                label="Designation"
                defaultValue={values.designation}
                errors={e.designation}
              />
              <SelectField
                name="employmentType"
                label="Employment type"
                options={EMPLOYMENT_TYPES}
                defaultValue={values.employmentType}
                errors={e.employmentType}
              />
              <SelectField
                name="status"
                label="Status"
                options={EMPLOYEE_STATUSES}
                defaultValue={values.status}
                errors={e.status}
              />
              <TextField
                name="hireDate"
                label="Hire date"
                type="date"
                required
                defaultValue={values.hireDate}
                errors={e.hireDate}
              />
              <TextField
                name="terminationDate"
                label="Termination date"
                type="date"
                hint="Leave blank while employed."
                defaultValue={values.terminationDate}
                errors={e.terminationDate}
              />
              <TextareaField
                name="notes"
                label="Notes"
                rows={3}
                defaultValue={values.notes}
                errors={e.notes}
                className="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Pay and banking">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="basicSalary"
                label={`Basic salary (${CURRENCY.code})`}
                type="number"
                step="0.01"
                min="0"
                defaultValue={values.basicSalary}
                errors={e.basicSalary}
                hint="Monthly gross basic, before components."
              />
              <TextField
                name="bankName"
                label="Bank name"
                defaultValue={values.bankName}
                errors={e.bankName}
              />
              <TextField
                name="bankAccount"
                label="Bank account"
                defaultValue={values.bankAccount}
                errors={e.bankAccount}
              />
              <TextField
                name="mobileBanking"
                label="Mobile banking"
                hint="bKash / Nagad number, used when there is no bank account."
                defaultValue={values.mobileBanking}
                errors={e.mobileBanking}
              />
            </div>
          </Panel>

          <Panel title="Emergency contact">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="emergencyContactName"
                label="Contact name"
                defaultValue={values.emergencyContactName}
                errors={e.emergencyContactName}
              />
              <TextField
                name="emergencyContactPhone"
                label="Contact phone"
                type="tel"
                defaultValue={values.emergencyContactPhone}
                errors={e.emergencyContactPhone}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Photo">
            <div className="space-y-4 p-5">
              {photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  className="aspect-square w-full rounded-md object-cover"
                />
              )}
              <TextField
                name="photoFile"
                label="Upload a photo"
                type="file"
                accept="image/*"
                errors={e.photoFile}
              />
              <TextField
                name="photoUrl"
                label="…or paste an image URL"
                type="url"
                placeholder="https://…"
                errors={e.photoUrl}
              />
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/employees" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save employee" : "Create employee"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
