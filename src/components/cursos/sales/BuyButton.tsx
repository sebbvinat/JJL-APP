import { clsx } from 'clsx';
import { lightButtonClasses, type LightButtonSize } from '../ui/LightButton';

// CTA de compra. Lleva al link de pago externo (Mercado Pago / Stripe).
// Si todavía no hay link cargado, queda visible pero inerte.
interface BuyButtonProps {
  paymentUrl?: string | null;
  label?: string;
  size?: LightButtonSize;
  fullWidth?: boolean;
}

export default function BuyButton({
  paymentUrl,
  label = 'Comprar ahora',
  size = 'lg',
  fullWidth = true,
}: BuyButtonProps) {
  if (paymentUrl) {
    return (
      <a
        href={paymentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={lightButtonClasses('primary', size, fullWidth)}
      >
        {label}
      </a>
    );
  }
  return (
    <span
      title="Link de pago próximamente"
      className={clsx(lightButtonClasses('primary', size, fullWidth), 'cursor-not-allowed opacity-55')}
    >
      {label}
    </span>
  );
}
