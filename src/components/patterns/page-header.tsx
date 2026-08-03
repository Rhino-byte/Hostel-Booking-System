import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "mb-10 max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {eyebrow ? (
        <p className="text-sm font-medium uppercase tracking-wider text-gold">
          {eyebrow}
        </p>
      ) : null}
      <h1
        className={cn(
          "font-serif text-4xl font-semibold text-primary",
          eyebrow ? "mt-2" : undefined
        )}
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-3 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
