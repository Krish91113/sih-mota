import { useEffect, useMemo, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";

export type FormOption = { value: string; label: string };

export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "dropdown"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "switch"
  | "file"
  | "readonly"
  | "table";

export type FormFieldDef = {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: FormOption[];
  min?: number;
  max?: number;
  maxlength?: number;
  pattern?: string;
  patternMessage?: string;
  when?: { field: string; equals: string };
  value?: string;
  columns?: { key: string; label: string; type?: FormFieldType }[];
};

export type FormSectionDef = {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldDef[];
};

export type FormDefinition = {
  id: string;
  name: string;
  version: string;
  sections: FormSectionDef[];
};

type Scalar = string;
type MultiValue = string[];
type TableValue = Record<string, string>[];
type FieldValue = Scalar | MultiValue | TableValue;
export type FormValues = Record<string, FieldValue>;

export function isDefined(v: FieldValue | undefined): v is FieldValue {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim().length > 0;
}

export function DynamicFormRenderer({
  definition,
  defaults,
  onSubmit,
  onDirty,
  submitLabel = "Continue",
  onCancel,
  showAutosave = true,
}: {
  definition: FormDefinition;
  defaults?: Record<string, string>;
  onSubmit: (values: FormValues) => void;
  onDirty?: (values: FormValues) => void;
  submitLabel?: string;
  onCancel?: () => void;
  showAutosave?: boolean;
}) {
  const [values, setValues] = useState<FormValues>(() => initValues(definition, defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const setValue = (id: string, v: FieldValue) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  useEffect(() => {
    if (!showAutosave) return;
    const t = setTimeout(() => {
      setSaveState("saving");
      const done = setTimeout(() => {
        setSaveState("saved");
        const reset = setTimeout(() => setSaveState("idle"), 2200);
        reset.unref?.();
      }, 600);
      done.unref?.();
    }, 900);
    t.unref?.();
    return () => {
      clearTimeout(t);
      setSaveState("idle");
    };
  }, [values, showAutosave]);

  useEffect(() => {
    onDirty?.(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const visibleSections = useMemo(
    () =>
      definition.sections.map((s) => ({
        ...s,
        fields: s.fields.filter((f) => isVisible(f, values)),
      })),
    [definition, values],
  );

  const validate = () => {
    const next: Record<string, string> = {};
    visibleSections.forEach((s) =>
      s.fields.forEach((f) => {
        const err = fieldError(f, values[f.id]);
        if (err) next[f.id] = err;
      }),
    );
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(values);
  };

  const errorCount = Object.keys(errors).length;
  const requiredTotal = visibleSections.reduce(
    (n, s) => n + s.fields.filter((f) => f.required).length,
    0,
  );
  const filledRequired = visibleSections.reduce(
    (n, s) => n + s.fields.filter((f) => f.required && isDefined(values[f.id])).length,
    0,
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      {visibleSections.map((section, i) => (
        <section
          key={section.id}
          aria-labelledby={`sec-${section.id}`}
          className="rounded-2xl border bg-card shadow-card"
        >
          <header className="border-b border-dashed px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <h2 id={`sec-${section.id}`} className="text-lg">
                  {section.title}
                </h2>
                {section.description ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
                ) : null}
              </div>
            </div>
          </header>
          <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                error={errors[field.id]}
                onChange={(v) => setValue(field.id, v)}
                className={
                  field.type === "table" || field.type === "textarea" || field.type === "switch"
                    ? "sm:col-span-2 lg:col-span-3"
                    : ""
                }
              />
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {showAutosave ? (
              saveState === "saving" ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving draft…
                </span>
              ) : saveState === "failed" ? (
                <span className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="size-3.5" aria-hidden /> Save failed — retry
                </span>
              ) : saveState === "saved" ? (
                <span className="flex items-center gap-1.5 text-leaf">
                  <CheckCircle2 className="size-3.5" aria-hidden /> Draft saved
                </span>
              ) : null
            ) : null}
            <span className="text-xs text-muted-foreground">
              {filledRequired}/{requiredTotal} required fields filled
            </span>
            {errorCount > 0 ? (
              <span className="text-xs font-medium text-destructive">
                {errorCount} error{errorCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                Save draft &amp; exit
              </Button>
            ) : null}
            <Button type="submit">{submitLabel}</Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function isVisible(field: FormFieldDef, values: FormValues): boolean {
  if (!field.when) return true;
  const current = values[field.when.field];
  return Array.isArray(current)
    ? current.includes(field.when.equals)
    : String(current ?? "") === field.when.equals;
}

function fieldError(field: FormFieldDef, value: FieldValue | undefined): string | undefined {
  if (field.required && !isDefined(value)) return "This field is required";
  const v = Array.isArray(value) ? "" : String(value ?? "").trim();
  if (!v) return undefined;
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return "Enter a valid email address";
  if (field.type === "phone" && !/^[6-9]\d{9}$/.test(v))
    return "Enter a valid 10-digit mobile number";
  if (field.type === "number") {
    const n = Number(v);
    if (Number.isNaN(n)) return "Enter a valid number";
    if (field.min !== undefined && n < field.min) return `Minimum allowed is ${field.min}`;
    if (field.max !== undefined && n > field.max) return `Maximum allowed is ${field.max}`;
  }
  if (field.maxlength && v.length > field.maxlength) return `Maximum ${field.maxlength} characters`;
  if (field.pattern && !new RegExp(field.pattern).test(v))
    return field.patternMessage ?? "Invalid format";
  return undefined;
}

function initValues(definition: FormDefinition, defaults?: Record<string, string>): FormValues {
  const out: FormValues = {};
  definition.sections.forEach((s) =>
    s.fields.forEach((f) => {
      if (defaults?.[f.id] !== undefined) {
        out[f.id] = defaults[f.id];
      } else if (f.value !== undefined) {
        out[f.id] = f.value;
      } else if (f.type === "multiselect") {
        out[f.id] = [];
      } else if (f.type === "table") {
        out[f.id] = [];
      } else if (f.type === "checkbox") {
        out[f.id] = "";
      } else {
        out[f.id] = "";
      }
    }),
  );
  return out;
}

/* ------------------------------------------------------------------ */

export function FieldRenderer({
  field,
  value,
  error,
  onChange,
  className,
}: {
  field: FormFieldDef;
  value: FieldValue | undefined;
  error?: string;
  onChange: (v: FieldValue) => void;
  className?: string;
}) {
  const str = Array.isArray(value) ? "" : String(value ?? "");
  const describedBy = error ? `${field.id}-error` : field.help ? `${field.id}-help` : undefined;
  const required = field.required;

  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={field.id} className="text-sm">
        {field.label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>

      {field.type === "text" || field.type === "email" || field.type === "phone" ? (
        <Input
          id={field.id}
          type={field.type === "email" ? "email" : "text"}
          inputMode={field.type === "phone" ? "tel" : undefined}
          maxLength={field.maxlength}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={describedBy}
          className="mt-2"
        />
      ) : field.type === "number" ? (
        <Input
          id={field.id}
          type="number"
          min={field.min}
          max={field.max}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={describedBy}
          className="mt-2"
        />
      ) : field.type === "date" ? (
        <Input
          id={field.id}
          type="date"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={describedBy}
          className="mt-2"
        />
      ) : field.type === "textarea" ? (
        <Textarea
          id={field.id}
          rows={4}
          maxLength={field.maxlength}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={describedBy}
          className="mt-2"
        />
      ) : field.type === "dropdown" ? (
        <Select value={str || undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger id={field.id} className="mt-2 w-full" aria-invalid={!!error}>
            <SelectValue placeholder={field.placeholder ?? "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "multiselect" ? (
        <MultiSelect field={field} value={value} onChange={onChange} />
      ) : field.type === "radio" ? (
        <fieldset className="mt-2">
          <legend className="sr-only">{field.label}</legend>
          <div className="flex flex-wrap gap-2">
            {field.options?.map((o) => (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  str === o.value ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name={field.id}
                  value={o.value}
                  checked={str === o.value}
                  onChange={() => onChange(o.value)}
                  className="accent-[var(--primary)]"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : field.type === "checkbox" ? (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            id={field.id}
            checked={str === "true"}
            onCheckedChange={(c) => onChange(c === true ? "true" : "")}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
          <span className="text-muted-foreground">{field.help ?? "Tick to confirm"}</span>
        </label>
      ) : field.type === "switch" ? (
        <div className="mt-3 flex items-center gap-3">
          <Switch
            id={field.id}
            checked={str === "true"}
            onCheckedChange={(c) => onChange(c === true ? "true" : "false")}
          />
          {field.help ? <span className="text-sm text-muted-foreground">{field.help}</span> : null}
        </div>
      ) : field.type === "file" ? (
        <div className="mt-2">
          <input
            id={field.id}
            type="file"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent/80"
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
        </div>
      ) : field.type === "readonly" ? (
        <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {field.value ?? field.placeholder}
        </p>
      ) : field.type === "table" ? (
        <DynamicTable field={field} value={value} onChange={onChange} />
      ) : null}

      {field.help && !error ? (
        <p id={`${field.id}-help`} className="mt-1.5 text-xs text-muted-foreground">
          {field.help}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${field.id}-error`}
          role="alert"
          className="mt-1.5 flex items-center gap-1 text-xs text-destructive"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : null}
    </div>
  );
}

function MultiSelect({
  field,
  value,
  onChange,
}: {
  field: FormFieldDef;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
}) {
  const selected = ((value as MultiValue) ?? []).map(String);
  return (
    <div className="mt-2 space-y-1.5">
      {field.options?.map((o) => {
        const checked = selected.includes(o.value);
        return (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => {
                const next = c ? [...selected, o.value] : selected.filter((s) => s !== o.value);
                onChange(next);
              }}
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

function DynamicTable({
  field,
  value,
  onChange,
}: {
  field: FormFieldDef;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
}) {
  const rows = ((value as TableValue) ?? []) as TableValue;
  const addRow = () => onChange([...rows, {}]);
  const updateCell = (rowIndex: number, key: string, cellValue: string) => {
    const next = rows.map((r, i) => (i === rowIndex ? { ...r, [key]: cellValue } : r));
    onChange(next);
  };
  const removeRow = (rowIndex: number) => onChange(rows.filter((_, i) => i !== rowIndex));
  return (
    <div className="mt-2 overflow-x-auto">
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              {field.columns?.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
                >
                  {c.label}
                </th>
              ))}
              <th className="w-10 px-3 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                {field.columns?.map((c) => (
                  <td key={c.key} className="px-2 py-2">
                    <Input
                      aria-label={`${field.label} — ${c.label} row ${i + 1}`}
                      value={row[c.key] ?? ""}
                      onChange={(e) => updateCell(i, c.key, e.target.value)}
                      className="h-8"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => removeRow(i)}
                    aria-label={`Remove row ${i + 1}`}
                  >
                    <Trash2 className="size-4 text-muted-foreground" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={(field.columns?.length ?? 1) + 1}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  No entries yet — add a row to begin.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addRow}>
        <Plus className="size-3.5" aria-hidden /> Add row
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
