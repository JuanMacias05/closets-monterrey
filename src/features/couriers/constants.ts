// Must match private.is_known_municipality in 20261118000300_couriers.sql.
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
