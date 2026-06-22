'use client';

import Script from 'next/script';
import { META_PIXEL_ID } from '@/lib/meta-pixel';

/**
 * Meta (Facebook) Pixel base — carga el snippet oficial + dispara PageView.
 *
 * Montado una sola vez en el root layout: cubre TODAS las páginas (alumno,
 * cursos, auth, landing). Los eventos custom (Lead, ViewContent, Purchase,
 * CompleteRegistration) se disparan desde el código de cada flow usando
 * los helpers de `@/lib/meta-pixel`.
 *
 * Solo se monta en producción — en dev no contaminamos el reporte de Meta
 * con tests. Si querés probar localmente cambialo a `if (false)`.
 */
export default function MetaPixel() {
  if (process.env.NODE_ENV !== 'production') return null;
  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
