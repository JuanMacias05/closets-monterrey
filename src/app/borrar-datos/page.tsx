import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { LEGAL_CONTACT } from "@/features/legal/legal-contact";

export const metadata = { title: "Borrar mis datos | Closets Monterrey" };

// Data-deletion instructions. Meta requires this URL (or a deletion callback) before a
// Facebook login can go live, so it also covers data that came from Facebook. Deletion is
// handled by hand for now: there is no self-service "delete my account" button yet.
export default function DataDeletionPage() {
  return (
    <LegalPage title="Borrar mis datos">
      <p>Puedes pedir que borremos tu cuenta y tus datos personales cuando quieras.</p>

      <LegalSection title="Cómo pedirlo">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Escríbenos a <a href={`mailto:${LEGAL_CONTACT.email}?subject=Borrar%20mi%20cuenta`} className="text-pine underline underline-offset-4">{LEGAL_CONTACT.email}</a> con el asunto &ldquo;Borrar mi cuenta&rdquo;.</li>
          <li>Incluye el número de celular con el que entras a la tienda, para encontrar tu cuenta.</li>
          <li>Te confirmamos por ese mismo medio en cuanto esté hecho, en un máximo de 20 días hábiles.</li>
        </ol>
      </LegalSection>

      <LegalSection title="Qué borramos">
        <ul className="list-disc space-y-2 pl-5">
          <li>Tu cuenta y tu número de celular.</li>
          <li>Tu nombre, tu link de Facebook, tus favoritos, tu carrito y tus direcciones.</li>
          <li>Si eres vendedora: tu tienda, tus prendas y sus fotos, tu WhatsApp y tu CLABE.</li>
          <li>Si eres recolectora: tu perfil y tu ruta.</li>
          <li>Si entraste con Facebook: lo que recibimos de Facebook (nombre, foto y correo).</li>
        </ul>
      </LegalSection>

      <LegalSection title="Antes de borrar">
        <p>
          Si tienes un apartado abierto (esperando anticipo o con anticipo pagado), primero hay que terminarlo o cancelarlo con la vendedora,
          para que nadie pierda su dinero ni su prenda.
        </p>
      </LegalSection>

      <LegalSection title="Si entraste con Facebook">
        <p>
          También puedes quitarle el acceso a Closets Monterrey desde Facebook: Configuración y privacidad → Configuración →
          Apps y sitios web → Closets Monterrey → Eliminar. Eso evita que recibamos más datos de Facebook; para borrar lo que ya
          tenemos, escríbenos como se indica arriba.
        </p>
      </LegalSection>

      <p>Más detalles en nuestro <Link href="/privacidad" className="text-pine underline underline-offset-4">Aviso de privacidad</Link>.</p>
    </LegalPage>
  );
}
