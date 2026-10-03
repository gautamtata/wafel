import type { ReactNode } from "react";

type FieldProps = { label: string; hint?: string; htmlFor?: string; children: ReactNode };

export function Field({ label, hint, htmlFor, children }: FieldProps) {
  const Heading = htmlFor ? "label" : "p";
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <Heading htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Heading>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
