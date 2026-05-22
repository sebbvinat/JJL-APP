// Helpers de formato para JJL Cursos.

/** Etiqueta legible del período de acceso. NULL = de por vida. */
export function accesoLabel(meses: number | null): string {
  if (meses == null) return 'Acceso de por vida';
  if (meses % 12 === 0) {
    const anios = meses / 12;
    return `Acceso por ${anios} ${anios === 1 ? 'año' : 'años'}`;
  }
  return `Acceso por ${meses} meses`;
}

/** Precio mostrable: usa precio_label si existe, si no arma desde precio. */
export function priceLabel(
  precioLabel: string | null,
  precio: number | null
): string {
  if (precioLabel) return precioLabel;
  if (precio != null) return `$${precio}`;
  return 'Consultar';
}
