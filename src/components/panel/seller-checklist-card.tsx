import Link from "next/link";
import type { ChecklistStep } from "@/features/sellers/seller-checklist";

// "Para empezar" on the seller's Inicio. Disappears once every step is done; while the CLABE is
// missing the card turns amber, because without it nobody can reserve from her.
export function SellerChecklistCard({ steps, clabeMissing }: { steps: ChecklistStep[]; clabeMissing: boolean }) {
  const done = steps.filter((step) => step.done).length;
  return (
    <section aria-labelledby="checklist-title" className={`border-2 p-5 ${clabeMissing ? "border-amber-600 bg-amber-50" : "border-pine bg-white"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="checklist-title" className="font-condensed text-xl font-bold uppercase text-stone-900">Para empezar</h2>
        <p className="text-sm text-stone-600">{done} de {steps.length} listos</p>
      </div>
      {clabeMissing && <p role="alert" className="mt-2 text-sm font-medium text-amber-900">Te falta tu CLABE: sin ella nadie puede apartarte prendas.</p>}
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step.id} data-testid={`checklist-${step.id}`} data-done={step.done ? "true" : "false"}>
            <Link href={step.href} className="flex items-start gap-3 p-2 hover:bg-stone-100">
              <span aria-hidden="true" className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${step.done ? "bg-pine text-white" : "border-2 border-stone-400 text-stone-600"}`}>{step.done ? "✓" : index + 1}</span>
              <span className="min-w-0">
                <span className={`block text-sm ${step.done ? "text-stone-500 line-through" : "font-medium text-stone-900"}`}>{step.label}</span>
                {!step.done && <span className="block text-xs text-stone-600">{step.hint}</span>}
                <span className="sr-only">{step.done ? " (listo)" : " (pendiente)"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
