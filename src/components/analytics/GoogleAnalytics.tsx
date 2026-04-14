import Script from 'next/script';

const GA_ID = 'G-2GS1HSGSDE';

export default function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            linker: {
              domains: ['jiujitsulatino.com', 'alumno.jiujitsulatino.com']
            }
          });
        `}
      </Script>
    </>
  );
}
