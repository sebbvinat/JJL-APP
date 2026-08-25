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

/**
 * Tasa por defecto: 8%.
 *
 * Hoy hay un solo setter y cobra 8%, asi que va como default en vez de como
 * override por id. Es a proposito: los overrides se cargan por user id y las
 * cuentas se reutilizan, con lo cual un id viejo puede terminar apuntando a
 * otra persona — es lo que paso con el 8% de Agustin Coronel.
 */
export const DEFAULT_COMMISSION_RATE = 0.08;

/**
 * Overrides por user id. Cargar acá los setters con tasa distinta a la
 * default, con el nombre en el comentario.
 *
 * OJO al cargar uno: verificá que el id corresponda HOY a esa persona. Las
 * cuentas se reutilizan (se les cambia el email/nombre), así que un id viejo
 * puede terminar apuntando a otro. Pasó con el override del 8% de Agustín
 * Coronel: su cuenta se reasignó a otra persona y la tasa quedó apuntando al
 * usuario equivocado. Se removió al dejar de trabajar con él.
 */
const RATE_BY_USER: Record<string, number> = {
  // (vacío — todos cobran DEFAULT_COMMISSION_RATE)
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
