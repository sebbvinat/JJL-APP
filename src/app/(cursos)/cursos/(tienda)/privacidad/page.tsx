import type { Metadata } from 'next';
import LightContainer from '@/components/cursos/ui/LightContainer';

export const metadata: Metadata = {
  title: 'Política de Privacidad — JJL Manager',
  description:
    'Política de privacidad de JJL Manager, herramienta interna de administración de las cuentas de Jiu Jitsu Latino en Meta.',
};

export default function PrivacidadPage() {
  return (
    <LightContainer size="narrow" className="py-16 sm:py-24">
      <article>
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-cursos-red">
          Legal
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-cursos-ink sm:text-4xl">
          Política de Privacidad — JJL Manager
        </h1>
        <p className="mt-3 text-[14px] text-cursos-muted">
          Última actualización: 27 de mayo de 2026
        </p>

        <p className="mt-8 text-[15.5px] leading-relaxed text-cursos-ink-soft">
          JJL Manager es una aplicación interna desarrollada para la
          administración de las cuentas oficiales de Jiu Jitsu Latino en Meta
          (Facebook, Instagram) y sus campañas publicitarias. No es una
          aplicación de consumo final disponible al público general.
        </p>

        <Section title="1. Información que la app procesa">
          <p>
            JJL Manager accede únicamente a datos de las páginas, cuentas de
            Instagram y cuentas publicitarias propiedad de Jiu Jitsu Latino,
            autorizadas explícitamente por sus administradores. Los datos
            procesados incluyen:
          </p>
          <ul>
            <li>
              Contenido publicado en las cuentas de Instagram de Jiu Jitsu
              Latino (posts, reels, historias, métricas asociadas).
            </li>
            <li>
              Métricas agregadas de campañas publicitarias en Meta Ads
              (impresiones, clics, gastos, conversiones).
            </li>
            <li>
              Información administrativa de las páginas y cuentas conectadas.
            </li>
          </ul>
          <p>
            La aplicación <strong>no recolecta datos personales de seguidores,
            visitantes, clientes ni de terceros</strong>.
          </p>
        </Section>

        <Section title="2. Uso de la información">
          <p>La información se utiliza exclusivamente para:</p>
          <ul>
            <li>
              Publicar y gestionar contenido orgánico en las cuentas de
              Instagram oficiales de Jiu Jitsu Latino.
            </li>
            <li>
              Crear, monitorear y optimizar campañas publicitarias propias en
              Meta.
            </li>
            <li>Generar reportes internos de rendimiento.</li>
          </ul>
        </Section>

        <Section title="3. Compartición de datos">
          <p>
            JJL Manager no comparte, vende ni transfiere datos a terceros. La
            información se mantiene exclusivamente dentro del ecosistema de
            herramientas internas de Jiu Jitsu Latino y de la plataforma de
            Meta.
          </p>
        </Section>

        <Section title="4. Almacenamiento y seguridad">
          <p>
            Los datos accedidos por la aplicación se almacenan únicamente de
            forma temporal para procesamiento operativo. No se mantienen bases
            de datos de usuarios finales. Los tokens de acceso y credenciales
            se almacenan de forma segura.
          </p>
        </Section>

        <Section title="5. Derechos">
          <p>
            Los administradores autorizados de las cuentas de Jiu Jitsu Latino
            pueden revocar el acceso de la aplicación en cualquier momento
            desde la configuración de su cuenta de Meta Business.
          </p>
        </Section>

        <Section title="6. Contacto">
          <p>
            Para consultas sobre esta política de privacidad o sobre el uso de
            datos por parte de JJL Manager:
          </p>
          <ul>
            <li>
              <strong>Email</strong>:{' '}
              <a
                href="mailto:jiujitsulat@gmail.com"
                className="font-semibold text-cursos-red underline-offset-2 hover:underline"
              >
                jiujitsulat@gmail.com
              </a>
            </li>
            <li>
              <strong>Negocio</strong>: Jiu Jitsu Latino
            </li>
          </ul>
        </Section>
      </article>
    </LightContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-cursos-ink sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-[15.5px] leading-relaxed text-cursos-ink-soft [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:text-cursos-ink">
        {children}
      </div>
    </section>
  );
}
