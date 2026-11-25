import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { LEGAL_CONTACT } from "@/features/legal/legal-contact";

export const metadata = { title: "Aviso de privacidad | BZRS Monterrey" };

// Privacy notice (aviso de privacidad integral). Every data point listed here must match what
// the app really stores: if a migration adds a personal field, add it here in the same change.
export default function PrivacyPage() {
  return (
    <LegalPage title="Aviso de privacidad">
      <LegalSection title="Quién es responsable de tus datos">
        <p>
          {LEGAL_CONTACT.responsibleName}, con domicilio en {LEGAL_CONTACT.city}, es responsable del tratamiento de los datos personales
          que nos das al usar BZRS Monterrey. Para cualquier tema de privacidad escríbenos a <a href={`mailto:${LEGAL_CONTACT.email}`} className="text-pine underline underline-offset-4">{LEGAL_CONTACT.email}</a>.
        </p>
      </LegalSection>

      <LegalSection title="Qué datos guardamos">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Todas las cuentas:</strong> número de celular (para entrar con un código por SMS).</li>
          <li><strong>Compradoras:</strong> nombre, link de tu perfil de Facebook, prendas favoritas, carrito, apartados, la foto del comprobante de tu anticipo (transferencia o ticket de OXXO) y, si eliges entrega a domicilio o con recolectora, tu dirección y municipio.</li>
          <li><strong>Vendedoras:</strong> nombre de la tienda, foto de perfil, WhatsApp, CLABE y, si la das, tarjeta para depósitos en OXXO para recibir anticipos, puntos de entrega y las fotos y datos de las prendas que publicas.</li>
          <li><strong>Recolectoras:</strong> nombre, municipios donde entregas, días y horario, tarifa y puntos donde recoges.</li>
          <li><strong>Solicitudes de ayuda:</strong> lo que nos escribes cuando pides ayuda con un apartado.</li>
          <li><strong>Historial de apartados:</strong> qué apartaste, montos, estado de la entrega y calificaciones a recolectoras. Con él calculamos un indicador de confianza de compradoras que solo ven las vendedoras.</li>
        </ul>
        <p>No pedimos datos sensibles ni cobramos con tarjeta: los anticipos se pagan directo a la vendedora, por transferencia o en efectivo en OXXO. El número de tarjeta que una vendedora da para OXXO solo sirve para recibir depósitos.</p>
      </LegalSection>

      <LegalSection title="Para qué los usamos">
        <p>Usamos tus datos para:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Crear tu cuenta y dejarte entrar con tu celular.</li>
          <li>Que puedas apartar prendas y que la vendedora sepa con quién trata.</li>
          <li>Coordinar la entrega en un punto, a domicilio o con una recolectora.</li>
          <li>Que la vendedora confirme tu anticipo y, si hay un problema con tu pago, ayudarte a resolverlo.</li>
          <li>Revisar y aprobar cuentas de vendedoras y recolectoras, y cuidar la seguridad de la tienda.</li>
        </ul>
        <p>No usamos tus datos para publicidad ni los vendemos.</p>
      </LegalSection>

      <LegalSection title="Quién más los ve">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Cuando apartas una prenda,</strong> la vendedora ve tu nombre, tu link de Facebook, tu celular y tu indicador de confianza. Tú ves su WhatsApp, su CLABE y, si la dio, su tarjeta para OXXO. La foto de tu comprobante solo la ven tú, esa vendedora y la administración de BZRS Monterrey, y se borra si borras tu cuenta.</li>
          <li><strong>Si eliges recolectora,</strong> ella ve tu nombre, tu dirección, tu municipio y tu celular para entregarte.</li>
          <li><strong>Lo que es público:</strong> el nombre y la foto de cada tienda, sus prendas, y el nombre, municipios y tarifa de las recolectoras verificadas.</li>
        </ul>
        <p>
          Para funcionar usamos proveedores que guardan o procesan datos por nosotros: Supabase (base de datos y fotos), Vercel (el sitio web)
          y Twilio (envío de los códigos por SMS). Sus servidores pueden estar fuera de México. Solo usan tus datos para darnos ese servicio.
        </p>
      </LegalSection>

      <LegalSection title="Tus derechos (ARCO)">
        <p>
          Puedes pedir acceso a tus datos, corregirlos, que los borremos o oponerte a algún uso (derechos ARCO), y retirar tu consentimiento.
          Escríbenos a <a href={`mailto:${LEGAL_CONTACT.email}`} className="text-pine underline underline-offset-4">{LEGAL_CONTACT.email}</a> desde
          cualquier medio donde podamos confirmar que eres tú (por ejemplo, indicando el celular de tu cuenta) y dinos qué necesitas.
          Te respondemos en un máximo de 20 días hábiles.
        </p>
        <p>Para borrar tu cuenta sigue los pasos de <Link href="/borrar-datos" className="text-pine underline underline-offset-4">Borrar mis datos</Link>.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>Solo usamos las cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de rastreo.</p>
      </LegalSection>

      <LegalSection title="Cambios a este aviso">
        <p>Si cambiamos este aviso, publicaremos la nueva versión en esta página con su fecha de actualización.</p>
      </LegalSection>
    </LegalPage>
  );
}
