import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { saveBleisureRequest } from "@/lib/bleisure.functions";

export type BleisureRequest = {
  businessCity: string;
  fixedStartDate: string;
  fixedEndDate: string;
  companyCoversAccommodation: boolean;
  extraDays: number;
  extraDaysPlacement: "before" | "after" | "both";
  leisureBudgetUsd: number;
  travelStyle: "relax" | "adventure" | "culture_food" | "mix";
  withSomeone: boolean;
};

const step1Schema = z.object({
  businessCity: z.string().trim().min(1, "City is required").max(100),
  fixedStartDate: z.string().min(1, "Start date required"),
  fixedEndDate: z.string().min(1, "End date required"),
  companyCoversAccommodation: z.boolean(),
}).refine((v) => v.fixedStartDate <= v.fixedEndDate, {
  message: "End date must be after start date",
  path: ["fixedEndDate"],
});

const step2Schema = z.object({
  extraDays: z.coerce.number().int().min(0).max(60),
  extraDaysPlacement: z.enum(["before", "after", "both"]),
  leisureBudgetUsd: z.coerce.number().min(0).max(1_000_000),
  travelStyle: z.enum(["relax", "adventure", "culture_food", "mix"]),
  withSomeone: z.boolean(),
});

const initial: BleisureRequest = {
  businessCity: "",
  fixedStartDate: "",
  fixedEndDate: "",
  companyCoversAccommodation: false,
  extraDays: 2,
  extraDaysPlacement: "after",
  leisureBudgetUsd: 500,
  travelStyle: "mix",
  withSomeone: false,
};

export function BleisureIntake({
  onSubmit,
}: {
  onSubmit?: (bleisureRequest: BleisureRequest) => void | Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<BleisureRequest>(initial);
  const [submitting, setSubmitting] = useState(false);
  const save = useServerFn(saveBleisureRequest);

  const update = <K extends keyof BleisureRequest>(k: K, v: BleisureRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const next = () => {
    const r = step1Schema.safeParse(form);
    if (!r.success) return toast.error(r.error.issues[0].message);
    setStep(2);
  };

  const submit = async () => {
    const r = step2Schema.safeParse(form);
    if (!r.success) return toast.error(r.error.issues[0].message);
    setSubmitting(true);
    try {
      const bleisureRequest: BleisureRequest = { ...form };
      const saved = (await save({ data: bleisureRequest })) as {
        id: string;
        createdAt: string;
      };
      await onSubmit?.({ ...bleisureRequest, id: saved.id } as BleisureRequest & {
        id: string;
      });
      toast.success("Bleisure preferences saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <StepDot active={step >= 1} label="Business" done={step > 1} />
        <div className="h-px flex-1 bg-border" />
        <StepDot active={step >= 2} label="Leisure" />
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your business trip</h2>

          <Field label="Business trip city">
            <input
              type="text"
              value={form.businessCity}
              onChange={(e) => update("businessCity", e.target.value)}
              placeholder="e.g. Singapore"
              maxLength={100}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fixed start date">
              <input
                type="date"
                value={form.fixedStartDate}
                onChange={(e) => update("fixedStartDate", e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Fixed end date">
              <input
                type="date"
                value={form.fixedEndDate}
                onChange={(e) => update("fixedEndDate", e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Toggle
            label="Company covers accommodation"
            value={form.companyCoversAccommodation}
            onChange={(v) => update("companyCoversAccommodation", v)}
          />

          <div className="flex justify-end pt-2">
            <button
              onClick={next}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Next <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Add some leisure</h2>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Extra days">
              <input
                type="number"
                min={0}
                max={60}
                value={form.extraDays}
                onChange={(e) => update("extraDays", Number(e.target.value))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="When to add them">
              <div className="flex gap-1">
                {(["before", "after", "both"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update("extraDaysPlacement", p)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs capitalize ${
                      form.extraDaysPlacement === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Leisure budget (USD)">
            <input
              type="number"
              min={0}
              value={form.leisureBudgetUsd}
              onChange={(e) => update("leisureBudgetUsd", Number(e.target.value))}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Travel style">
            <select
              value={form.travelStyle}
              onChange={(e) =>
                update("travelStyle", e.target.value as BleisureRequest["travelStyle"])
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="relax">Relax</option>
              <option value="adventure">Adventure</option>
              <option value="culture_food">Culture / Food</option>
              <option value="mix">Mix</option>
            </select>
          </Field>

          <Toggle
            label="Traveling with someone"
            value={form.withSomeone}
            onChange={(v) => update("withSomeone", v)}
            offLabel="Solo"
            onLabel="With someone"
          />

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
  offLabel = "No",
  onLabel = "Yes",
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  offLabel?: string;
  onLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-md px-3 py-1 text-xs ${
            !value ? "bg-muted font-medium" : "text-muted-foreground"
          }`}
        >
          {offLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-md px-3 py-1 text-xs ${
            value ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground"
          }`}
        >
          {onLabel}
        </button>
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="size-3" /> : label[0]}
      </div>
      <span className={`text-xs ${active ? "font-medium" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
