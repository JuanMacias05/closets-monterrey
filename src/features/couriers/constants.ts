// Must match private.is_known_municipality in 20261118000300_couriers.sql, which the couriers,
// the buyer's and seller's municipalities and the zone rates (20261123000100) all check against.
export const MUNICIPALITIES = [
  "Monterrey",
  "San Nicolás de los Garza",
  "Guadalupe",
  "Apodaca",
  "General Escobedo",
  "Santa Catarina",
  "San Pedro Garza García",
  "García",
  "Juárez",
] as const;

// Index = Postgres day number stored in couriers.days (0 = domingo).
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

// Courier requests (20261124000100). Mirrors of the database rules, for the copy on screen;
// the database enforces them.
// How long a courier has to accept or reject before the request expires.
export const COURIER_REQUEST_HOURS = 2;
// After a courier says no (or doesn't answer), how long the buyer has to choose again.
export const COURIER_RETRY_HOURS = 12;
// Requests one reservation can send in all, so a hold can't be stretched courier after courier.
export const MAX_COURIER_REQUESTS = 3;

// Quick picks for the courier's "Rechazar"; she can also type her own or give none.
export const COURIER_REJECT_REASONS = ["No paso por ahí ese día", "Ya tengo la ruta llena", "Queda muy lejos de mi ruta"] as const;
