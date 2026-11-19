// Who answers for the personal data the store keeps. The privacy notice and the data-deletion
// page both read from here, and Meta checks both URLs before it lets the Facebook login go live.
//
// IMPORTANT: fill these in before sharing /privacidad or /borrar-datos with anyone (or with
// Meta). A privacy notice with a placeholder for its responsible party doesn't meet Mexican
// data-protection law, which requires the notice to name who is responsible and how to reach them.
export const LEGAL_CONTACT = {
  responsibleName: "[Nombre completo de la persona responsable]",
  email: "[correo@ejemplo.com]",
  city: "Monterrey, Nuevo León, México",
  lastUpdated: "18 de noviembre de 2026",
} as const;

export const LEGAL_CONTACT_IS_PLACEHOLDER = LEGAL_CONTACT.email.startsWith("[");
