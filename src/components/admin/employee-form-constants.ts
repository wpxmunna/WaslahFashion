/**
 * Plain-value exports for `employee-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { EmployeeFormValues } from "./employee-form";

export const emptyEmployeeValues: EmployeeFormValues = {
  code: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  nationalId: "",
  address: "",
  city: "",
  departmentId: "",
  designation: "",
  employmentType: "FULL_TIME",
  hireDate: "",
  terminationDate: "",
  basicSalary: "0",
  bankName: "",
  bankAccount: "",
  mobileBanking: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  status: "ACTIVE",
  notes: "",
};

export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
];

export const EMPLOYEE_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "RESIGNED", label: "Resigned" },
];
