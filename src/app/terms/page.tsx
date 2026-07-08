import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Condiciones de servicio | Social Inbox MVP",
  description: "Condiciones de servicio de Social Inbox MVP.",
};

const publicAppUrl = "https://social-inbox-mvp.vercel.app";
const contactEmail = "axiona.hub@gmail.com";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900 sm:px-8 lg:px-10">
      <article className="mx-auto max-w-3xl rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Social Inbox MVP
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          Condiciones de servicio
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Ultima actualizacion: 8 de julio de 2026
        </p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            Estas condiciones regulan el uso de Social Inbox MVP, una aplicacion web para
            conectar cuentas autorizadas de Facebook e Instagram y administrar comentarios,
            mensajes, DMs y acciones de moderacion desde una bandeja unificada.
          </p>
          <p>
            La aplicacion es operada por Axiona Hub International LLC para uso interno y
            operativo. Al usar la aplicacion, aceptas estas condiciones.
          </p>
        </section>

        <TermsSection title="Uso permitido">
          <ul className="list-disc space-y-2 pl-5">
            <li>Usar la aplicacion solo con cuentas, paginas y perfiles que tienes derecho a administrar.</li>
            <li>Responder mensajes y comentarios de forma legal, respetuosa y conforme a las politicas de Meta.</li>
            <li>Usar las acciones de moderacion solo para fines legitimos de administracion de comunidad.</li>
            <li>Mantener seguras las credenciales y accesos conectados a la aplicacion.</li>
          </ul>
        </TermsSection>

        <TermsSection title="Uso prohibido">
          <ul className="list-disc space-y-2 pl-5">
            <li>No usar la aplicacion para spam, abuso, suplantacion, acoso o actividades ilegales.</li>
            <li>No conectar cuentas sobre las que no tienes autorizacion suficiente.</li>
            <li>No intentar extraer, vender o compartir datos personales fuera de los fines operativos de la herramienta.</li>
            <li>No interferir con la seguridad, disponibilidad o integridad de la aplicacion.</li>
          </ul>
        </TermsSection>

        <TermsSection title="Servicios de terceros">
          <p>
            La aplicacion depende de servicios de terceros como Meta, Supabase y Vercel. El uso
            de Facebook e Instagram esta sujeto tambien a las politicas, permisos, limites y
            condiciones de Meta. Algunas funciones pueden dejar de estar disponibles si Meta
            cambia permisos, APIs, revisiones o reglas de acceso.
          </p>
        </TermsSection>

        <TermsSection title="Datos y privacidad">
          <p>
            El tratamiento de datos se describe en nuestra{" "}
            <Link className="font-medium text-slate-950 underline" href="/privacy">
              Politica de privacidad
            </Link>
            . Al usar la aplicacion, autorizas el procesamiento de datos necesarios para operar
            el inbox, sincronizar cuentas conectadas y ejecutar acciones solicitadas dentro de la
            herramienta.
          </p>
        </TermsSection>

        <TermsSection title="Disponibilidad">
          <p>
            Social Inbox MVP se entrega en una etapa operativa temprana. Trabajamos para mantener
            la aplicacion disponible y funcional, pero no garantizamos disponibilidad continua,
            ausencia total de errores ni compatibilidad permanente con cambios externos de Meta u
            otros proveedores.
          </p>
        </TermsSection>

        <TermsSection title="Responsabilidad del usuario">
          <p>
            El usuario es responsable por los mensajes, respuestas, comentarios, acciones de
            moderacion y decisiones operativas ejecutadas desde la aplicacion. Antes de realizar
            acciones sensibles, como bloquear usuarios o eliminar comentarios, debes confirmar que
            la accion corresponde a tus politicas internas.
          </p>
        </TermsSection>

        <TermsSection title="Cambios en estas condiciones">
          <p>
            Podemos actualizar estas condiciones cuando sea necesario por cambios tecnicos,
            legales, operativos o de proveedores. La fecha de ultima actualizacion indicara la
            version vigente.
          </p>
        </TermsSection>

        <TermsSection title="Contacto">
          <p>
            Para consultas sobre estas condiciones, escribe a{" "}
            <a className="font-medium text-slate-950 underline" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            .
          </p>
        </TermsSection>

        <div className="mt-8 border-t border-slate-200 pt-5 text-sm">
          <Link className="font-medium text-slate-950 underline" href="/">
            Volver a la aplicacion
          </Link>
          <p className="mt-3 text-slate-500">URL publica: {publicAppUrl}/terms</p>
        </div>
      </article>
    </main>
  );
}

function TermsSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}
