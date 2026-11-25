// The getting-started checklist on a seller's Inicio, in the order that unblocks her: without a
// CLABE nobody can reserve, without a delivery option buyers don't know how to get the garment,
// then a first garment, then telling people about the store. Pure, for tests.

export type ChecklistInput = { hasClabe: boolean; hasDelivery: boolean; productCount: number; sharedStore: boolean };

export type ChecklistStep = { id: "clabe" | "delivery" | "first-garment" | "share"; label: string; hint: string; href: string; done: boolean };

export function sellerChecklist(input: ChecklistInput): { steps: ChecklistStep[]; allDone: boolean; clabeMissing: boolean } {
  const steps: ChecklistStep[] = [
    { id: "clabe", label: "Pon tu CLABE para recibir anticipos", hint: "Sin ella nadie puede apartarte prendas.", href: "/panel/tienda#store-clabe", done: input.hasClabe },
    { id: "delivery", label: "Elige cómo entregas", hint: "Tus puntos fijos o desde qué municipio envías a domicilio.", href: "/panel/tienda", done: input.hasDelivery },
    { id: "first-garment", label: "Sube tu primera prenda", hint: "Fotos, talla y precio.", href: "/panel/prendas/nueva", done: input.productCount > 0 },
    { id: "share", label: "Comparte tu bazar", hint: "En tus grupos de Facebook o tu estado de WhatsApp.", href: "#compartir-tienda", done: input.sharedStore },
  ];
  return { steps, allDone: steps.every((step) => step.done), clabeMissing: !input.hasClabe };
}
