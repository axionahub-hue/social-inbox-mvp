import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Politica de privacidad | Social Inbox MVP",
  description: "Politica de privacidad de Social Inbox MVP.",
};

const publicAppUrl = "https://social-inbox-mvp.vercel.app";
const contactEmail = "axiona.hub@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900 sm:px-8 lg:px-10">
      <article className="mx-auto max-w-3xl rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Social Inbox MVP
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          Politica de privacidad
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Ultima actualizacion: 8 de julio de 2026
        </p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            Esta politica describe como Social Inbox MVP trata informacion conectada a cuentas
            de Facebook e Instagram para administrar comentarios, mensajes y respuestas desde
            una bandeja unificada.
          </p>
          <p>
            La aplicacion es operada por Axiona Hub International LLC para uso interno y
            operativo. No vendemos informacion personal ni usamos los datos conectados para
            publicidad de terceros.
          </p>
        </section>

        <PolicySection title="Informacion que podemos procesar">
          <ul className="list-disc space-y-2 pl-5">
            <li>Datos basicos de cuenta conectada, como nombre de pagina, identificador y red.</li>
            <li>Comentarios, mensajes, DMs, fechas, estado de lectura, estado de archivo y acciones de moderacion.</li>
            <li>Identificadores tecnicos necesarios para responder, ocultar, mostrar, eliminar o dar like cuando Meta lo permite.</li>
            <li>Tokens de acceso entregados por Meta para operar las cuentas autorizadas.</li>
            <li>Preferencias internas, como cuentas visibles y respuestas rapidas reutilizables.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Como usamos la informacion">
          <ul className="list-disc space-y-2 pl-5">
            <li>Mostrar conversaciones, comentarios y mensajes en una bandeja de trabajo.</li>
            <li>Permitir respuestas, moderacion, archivo, lectura/no lectura y acciones similares.</li>
            <li>Sincronizar eventos desde Meta mediante OAuth, APIs oficiales y webhooks.</li>
            <li>Diagnosticar errores de conexion, permisos, webhooks y sincronizacion.</li>
            <li>Mantener registros tecnicos necesarios para operar y mejorar la herramienta.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Almacenamiento y seguridad">
          <p>
            Los datos de aplicacion se almacenan en Supabase. Los tokens de Meta se guardan
            cifrados del lado del servidor y no se exponen al navegador. El acceso a la base se
            controla por workspace y por las politicas de seguridad configuradas en Supabase.
          </p>
        </PolicySection>

        <PolicySection title="Comparticion de datos">
          <p>
            No vendemos datos personales. La informacion puede procesarse mediante proveedores
            necesarios para operar la aplicacion, como Vercel para hosting, Supabase para base de
            datos/autenticacion y Meta para Facebook e Instagram. Cada proveedor procesa datos
            segun sus propias politicas y terminos.
          </p>
        </PolicySection>

        <PolicySection title="Datos de Facebook e Instagram">
          <p>
            La aplicacion solo solicita permisos necesarios para conectar cuentas autorizadas,
            leer comentarios/mensajes y ejecutar acciones solicitadas por el usuario dentro de la
            herramienta. Si se revoca el acceso desde Meta o desde la aplicacion, la herramienta
            dejara de sincronizar nuevos datos de esas cuentas.
          </p>
        </PolicySection>

        <PolicySection title="Retencion">
          <p>
            Conservamos datos operativos mientras sean necesarios para administrar el inbox,
            mantener historial de conversaciones, diagnosticar incidencias y cumplir obligaciones
            tecnicas o legales aplicables. Los datos pueden eliminarse a solicitud del usuario
            autorizado.
          </p>
        </PolicySection>

        <PolicySection title="Eliminacion de datos" id="eliminacion-de-datos">
          <p>
            Para solicitar eliminacion de datos asociados a la aplicacion, escribe a{" "}
            <a className="font-medium text-slate-950 underline" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>{" "}
            indicando la cuenta, pagina o perfil conectado que deseas eliminar. Procesaremos la
            solicitud en un plazo razonable y eliminaremos o desconectaremos los datos cuando sea
            tecnicamente posible.
          </p>
          <p className="mt-3">
            Tambien puedes revocar permisos desde la configuracion de Facebook o Instagram. Al
            revocar permisos, la aplicacion pierde acceso para sincronizar nuevos datos.
          </p>
        </PolicySection>

        <PolicySection title="Contacto">
          <p>
            Para preguntas sobre privacidad o datos, escribe a{" "}
            <a className="font-medium text-slate-950 underline" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            .
          </p>
        </PolicySection>

        <div className="mt-8 border-t border-slate-200 pt-5 text-sm">
          <Link className="font-medium text-slate-950 underline" href="/">
            Volver a la aplicacion
          </Link>
          <p className="mt-3 text-slate-500">URL publica: {publicAppUrl}/privacy</p>
        </div>
      </article>
    </main>
  );
}

function PolicySection({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <section className="mt-8" id={id}>
      <h2 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  );
}
