"use client";

import Link from "next/link";
import { MunicipalitySelect } from "@/components/shop/municipality-select";
import { WEEKDAYS_SHORT } from "@/features/couriers/constants";
import { formatPriceMXN } from "@/features/products/format-price";
import { couriersFor, homeFeeFor, offersOnlyArranged, type CourierOption, type DeliveryDraft, type SellerDeliveryOptions } from "@/features/shop/checkout-steps";

const radio = "flex min-h-11 items-center gap-3 text-sm text-stone-800";
const smallLabel = "block text-xs uppercase tracking-[0.14em] text-stone-600";

// Step 2 of reserving ("Entrega"), and what a buyer fills in again on /cuenta when her courier
// says no. First "¿Necesitas recolección?"; then either the couriers who reach her
// municipality, or the seller's own options (fixed point, home delivery priced by zone).
export function DeliveryStep({ idPrefix, options, draft, onChange, excludedCourierIds = [], allowCourier = true }: {
  idPrefix: string;
  options: SellerDeliveryOptions;
  draft: DeliveryDraft;
  onChange: (next: DeliveryDraft) => void;
  // Couriers who already said no to this reservation (or the one she is waiting on).
  excludedCourierIds?: readonly string[];
  // False once a reservation used up its courier requests.
  allowCourier?: boolean;
}) {
  const offersCourier = allowCourier && options.couriers.length > 0;
  const wantsCourier = offersCourier && draft.wantsCourier;
  const set = (patch: Partial<DeliveryDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="flex flex-col gap-4">
      {offersCourier && (
        <fieldset>
          <legend className="font-condensed text-base font-bold uppercase text-stone-900">¿Necesitas recolección?</legend>
          <p className="mt-1 text-sm text-stone-600">Una persona verificada recoge tus prendas en la tienda, en un punto fijo, y te las lleva a tu municipio. Acepta o rechaza cada entrega. <Link href="/recolectoras" className="text-pine underline underline-offset-4">Ver quién entrega</Link></p>
          <div className="mt-2 flex flex-col sm:flex-row sm:gap-6">
            <label className={radio}>
              <input type="radio" name={`${idPrefix}-wants-courier`} checked={!wantsCourier} onChange={() => set({ wantsCourier: false })} className="size-4 accent-pine" />
              No, gracias
            </label>
            <label className={radio}>
              <input type="radio" name={`${idPrefix}-wants-courier`} checked={wantsCourier} onChange={() => set({ wantsCourier: true })} className="size-4 accent-pine" />
              Sí, quiero recolección
            </label>
          </div>
        </fieldset>
      )}

      {wantsCourier ? (
        <CourierPicker idPrefix={idPrefix} options={options} draft={draft} set={set} excludedCourierIds={excludedCourierIds} />
      ) : (
        <SellerOptions idPrefix={idPrefix} options={options} draft={draft} set={set} />
      )}

      {(wantsCourier || draft.choice === "home") && !offersOnlyArranged(options) && (
        <div>
          <label htmlFor={`${idPrefix}-address`} className={smallLabel}>Dirección de entrega</label>
          <textarea id={`${idPrefix}-address`} value={draft.address} onChange={(event) => set({ address: event.target.value })} maxLength={300} rows={2} placeholder="Calle, número, colonia y municipio" className="mt-1 w-full border border-stone-300 bg-white p-2 text-sm" />
        </div>
      )}
    </div>
  );
}

function SellerOptions({ idPrefix, options, draft, set }: { idPrefix: string; options: SellerDeliveryOptions; draft: DeliveryDraft; set: (patch: Partial<DeliveryDraft>) => void }) {
  if (offersOnlyArranged(options)) {
    return <p className="text-sm text-stone-700">Esta tienda acuerda la entrega contigo por WhatsApp después de apartar.</p>;
  }
  const homeFee = homeFeeFor(options, draft.municipality);
  const homeFees = options.homeDelivery ? Object.values(options.homeDelivery.feesByMunicipality) : [];
  return (
    <fieldset>
      <legend className="font-condensed text-base font-bold uppercase text-stone-900">¿Cómo la recibes?</legend>
      <div className="mt-2 flex flex-col">
        {options.points.map((point) => (
          <label key={point.id} className={radio}>
            <input type="radio" name={`${idPrefix}-delivery`} value={`point:${point.id}`} checked={draft.choice === `point:${point.id}`} onChange={(event) => set({ choice: event.target.value })} className="size-4 accent-pine" />
            <span>Punto fijo: <strong>{point.name}</strong> <span className="text-stone-600">· sin costo</span></span>
          </label>
        ))}
        {options.homeDelivery && (
          <label className={radio}>
            <input type="radio" name={`${idPrefix}-delivery`} value="home" checked={draft.choice === "home"} onChange={(event) => set({ choice: event.target.value })} className="size-4 accent-pine" />
            <span>
              Envío a domicilio{homeFees.length > 0 && <> · <strong>desde {formatPriceMXN(Math.min(...homeFees))}</strong></>}
              <span className="text-stone-600"> según tu municipio{options.homeDelivery.note ? ` (${options.homeDelivery.note})` : ""}</span>
            </span>
          </label>
        )}
      </div>

      {draft.choice === "home" && options.homeDelivery && (
        <div className="mt-3 space-y-2 border-l-2 border-pine pl-4">
          <MunicipalitySelect id={`${idPrefix}-municipality`} label="Tu municipio" value={draft.municipality} onChange={(municipality) => set({ municipality })} />
          {draft.municipality && homeFee === null && (
            <p className="text-sm text-stone-700">Todavía no hay tarifa de envío de {options.homeDelivery.origin} a {draft.municipality}. Elige otra forma de entrega.</p>
          )}
          {homeFee !== null && (
            <p className="text-sm text-stone-800">Envío aprox. <strong>{formatPriceMXN(homeFee)}</strong> <span className="text-stone-600">(de {options.homeDelivery.origin} a {draft.municipality})</span></p>
          )}
          <p className="text-xs text-stone-600">Es un precio aproximado según tu municipio. La tienda puede ajustarlo antes de que le pagues el anticipo (por ejemplo, si tu dirección queda lejos) y lo verías en tu cuenta. Se paga al recibir, junto con el resto.</p>
        </div>
      )}
    </fieldset>
  );
}

function CourierPicker({ idPrefix, options, draft, set, excludedCourierIds }: {
  idPrefix: string; options: SellerDeliveryOptions; draft: DeliveryDraft; set: (patch: Partial<DeliveryDraft>) => void; excludedCourierIds: readonly string[];
}) {
  const here = couriersFor(options, draft.municipality, excludedCourierIds);
  const chosen = here.find((courier) => courier.id === draft.courierId);
  return (
    <div className="space-y-3 border-l-2 border-pine pl-4">
      <MunicipalitySelect id={`${idPrefix}-municipality`} label="Tu municipio" value={draft.municipality} onChange={(municipality) => set({ municipality, courierId: "" })} />
      {draft.municipality && here.length === 0 && (
        <p className="text-sm text-stone-700">
          Nadie{excludedCourierIds.length > 0 ? " más" : ""} recolecta en {draft.municipality} para esta tienda todavía. Elige &ldquo;No, gracias&rdquo; para ver las otras formas de entrega.
        </p>
      )}
      {here.length > 0 && (
        <fieldset>
          <legend className={smallLabel}>Quién recolecta en {draft.municipality}</legend>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {here.map((courier) => (
              <li key={courier.id}>
                <CourierChoice name={`${idPrefix}-courier`} courier={courier} checked={draft.courierId === courier.id} onPick={() => set({ courierId: courier.id })} />
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      {chosen && (
        <fieldset>
          <legend className={smallLabel}>¿Cómo pagas la tarifa de {formatPriceMXN(chosen.feeMxn)}?</legend>
          <label className={radio}>
            <input type="radio" name={`${idPrefix}-fee`} checked={draft.feePayment === "on_delivery"} onChange={() => set({ feePayment: "on_delivery" })} className="size-4 accent-pine" />
            A quien recolecta, al recibir (efectivo o transferencia)
          </label>
          <label className={radio}>
            <input type="radio" name={`${idPrefix}-fee`} checked={draft.feePayment === "with_deposit"} onChange={() => set({ feePayment: "with_deposit" })} className="size-4 accent-pine" />
            Incluida en mi anticipo a la tienda
          </label>
        </fieldset>
      )}
    </div>
  );
}

// One courier as a selectable card: what a buyer compares (verified, fee, rating, where she
// collects, which days).
function CourierChoice({ name, courier, checked, onPick }: { name: string; courier: CourierOption; checked: boolean; onPick: () => void }) {
  const days = courier.days.map((day) => WEEKDAYS_SHORT[day]).join(", ");
  return (
    <label className="flex h-full cursor-pointer gap-3 border border-stone-300 bg-white p-3 text-sm text-stone-700 transition-colors hover:border-stone-500 has-[:checked]:border-2 has-[:checked]:border-pine has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pine motion-reduce:transition-none">
      <input type="radio" name={name} value={courier.id} checked={checked} onChange={onPick} className="mt-1 size-4 shrink-0 accent-pine" />
      <span className="min-w-0 space-y-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-stone-900">{courier.fullName}</strong>
          <span className="bg-pine px-1.5 py-0.5 font-condensed text-xs font-bold uppercase text-white">✓ Identidad verificada</span>
        </span>
        <span className="block font-semibold text-stone-900">{formatPriceMXN(courier.feeMxn)} por entrega</span>
        <span className="block">
          {courier.rating !== null ? <><span aria-hidden="true">★</span> {courier.rating.toFixed(1)} · </> : "Sin calificaciones · "}
          {courier.deliveries} {courier.deliveries === 1 ? "entrega" : "entregas"}
        </span>
        <span className="block">Recoge en {courier.pointNames.join(", ") || "—"}</span>
        {days && <span className="block">Entrega {days}{courier.timeWindow ? ` · ${courier.timeWindow}` : ""}</span>}
      </span>
    </label>
  );
}
