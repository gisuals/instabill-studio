import { cn } from "@/lib/utils";
import type { DocMode } from "@/lib/invoice";

interface ModeToggleProps {
  mode: DocMode;
  onChange: (mode: DocMode) => void;
  variant?: "dark" | "light";
}

const MODES: { value: DocMode; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
];

export function ModeToggle({ mode, onChange, variant = "dark" }: ModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Document type"
      className={cn(
        "inline-flex rounded-full p-1",
        variant === "dark" ? "bg-ink-raised" : "w-full bg-secondary",
      )}
    >
      {MODES.map((m) => {
        const active = m.value === mode;
        return (
          <button
            key={m.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(m.value)}
            className={cn(
              "flex-1 rounded-full px-5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-float"
                : variant === "dark"
                  ? "text-ink-muted hover:text-ink-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
