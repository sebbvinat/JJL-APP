/**
 * Tasa de comisión del setter por venta.
 *
 * Vive en código a propósito (no en DB):
 *   - Hay 1-2 setters y la tasa cambia rarísimo.
 *   - Así no dependemos de correr una migración para arrancar.
 *   - El monto y la fecha de cada venta SÍ están en `lead_sales`; lo único
 *     que falta es la tasa, que es un parámetro del contrato del setter.
 *
 * La comisión de una venta se calcula con la tasa del setter ASIGNADO al
 * lead (`lead_quiz_responses.assigned_to`). Cuando un setter marca una
 * venta, el lead queda asignado a él — así su comisión sale sola.
 *
 * Si en el futuro hay muchos setters con tasas distintas, mover esto a una
 * columna `users.commission_rate` y leerla acá. La firma de los helpers no
 * cambia.
 */

/** Tasa por defecto: 5%. */
export const DEFAULT_COMMISSION_RATE = 0.05;

/**
 * Overrides por user id. Cargar acá los setters con tasa distinta a la
 * default. Ejemplo: Agustín Coronel cobra 8%.
 */
const RATE_BY_USER: Record<string, number> = {
  // Agustín Coronel — setter, 8%
  '4298fabc-90f0-490f-b428-ca64d09f3b5e': 0.08,
};

/** Tasa (0-1) del setter dado. Default si no tiene override. */
export function commissionRate(userId: string | null | undefined): number {
  if (userId && RATE_BY_USER[userId] != null) return RATE_BY_USER[userId];
  return DEFAULT_COMMISSION_RATE;
}

/** Comisión redondeada de `monto` para el setter dado. */
export function commissionFor(monto: number, userId: string | null | undefined): number {
  return Math.round(monto * commissionRate(userId));
}

/** Tasa en porcentaje entero (8, 5, ...) — para mostrar en la UI. */
export function ratePct(userId: string | null | undefined): number {
  return Math.round(commissionRate(userId) * 100);
}
