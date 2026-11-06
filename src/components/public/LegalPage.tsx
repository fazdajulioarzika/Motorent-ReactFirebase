import type { ReactNode } from "react";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-neutral-600">{children}</div>
    </section>
  );
}

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 text-sm leading-relaxed">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
        <p className="mt-1 text-neutral-500">Terakhir diperbarui: {updated}</p>
      </div>
      {children}
    </div>
  );
}
