/** Shared shape for `useActionState` form actions. */
export type FormState = {
  ok: boolean;
  message?: string;
  /** Field-level messages keyed by input name. */
  errors?: Record<string, string[]>;
};

export const initialFormState: FormState = { ok: false };

export function fieldErrors(errors: Record<string, string[] | undefined>): FormState {
  const cleaned: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (value?.length) cleaned[key] = value;
  }
  return { ok: false, errors: cleaned };
}
