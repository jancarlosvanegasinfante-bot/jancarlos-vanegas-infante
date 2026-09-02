import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

// Política de tratamiento de datos, redactada sobre lo que la tienda hace DE
// VERDAD: los campos que pide el formulario, los píxeles que carga, el bot de
// WhatsApp y el código anónimo de visitante. Una plantilla genérica describiría
// tratamientos que no ocurren y omitiría los que sí.
//
// Cumple lo que pide la Ley 1581 de 2012 y el Decreto 1377 de 2013: quién es el
// responsable, qué datos, para qué, con quién se comparten, cuáles son los
// derechos del titular y por dónde ejercerlos.

const WHATSAPP = "15072233213";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-lg font-black text-white">{titulo}</h2>
      <div className="space-y-2.5 text-slate-300 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Privacidad() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Política de Privacidad | Jansel Shop";
  }, []);

  return (
    <div className="min-h-screen bg-[#070810] text-white">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        <Link
          to="/landing"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Volver a la tienda
        </Link>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="text-emerald-400" size={20} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Política de Privacidad</h1>
        </div>
        <p className="text-slate-500 text-sm mb-10">
          Última actualización: 2 de septiembre de 2026
        </p>

        <div className="space-y-9">
          <Seccion titulo="Quiénes somos">
            <p>
              <strong className="text-white">Jansel Shop</strong> es una tienda de venta de productos por internet
              en Colombia. Somos los responsables del tratamiento de los datos personales que nos entregas
              a través de esta página y de nuestro WhatsApp.
            </p>
            <p>
              Puedes contactarnos por WhatsApp al{" "}
              <a
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 font-semibold hover:underline"
              >
                +{WHATSAPP}
              </a>{" "}
              para cualquier asunto relacionado con tus datos.
            </p>
          </Seccion>

          <Seccion titulo="Qué datos recogemos">
            <p>Solo pedimos lo necesario para despacharte un pedido:</p>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-slate-600">
              <li><strong className="text-white">Nombre y apellido</strong> — para la guía de envío</li>
              <li><strong className="text-white">Número de celular</strong> — para coordinar la entrega y responderte</li>
              <li><strong className="text-white">Ciudad y dirección</strong> — para llevarte el producto</li>
              <li><strong className="text-white">Punto de referencia</strong> — opcional, para que el mensajero te encuentre</li>
            </ul>
            <p>
              <strong className="text-white">No pedimos ni guardamos datos de tarjetas</strong>. Nuestro medio
              principal es el pago contra entrega: pagas en efectivo cuando recibes.
            </p>
          </Seccion>

          <Seccion titulo="Datos de navegación">
            <p>
              Cuando entras a la tienda registramos, de forma <strong className="text-white">anónima</strong>, qué
              productos se ven, qué se agrega al carrito y en qué punto se abandona un pedido. Nos sirve para
              encontrar y arreglar lo que no funciona bien.
            </p>
            <p>
              Para eso guardamos en tu navegador un <strong className="text-white">código al azar</strong> (por
              ejemplo <span className="font-mono text-slate-400">v_a7f3k2</span>) que enlaza esos pasos entre sí.
              Ese código <strong className="text-white">no contiene tu nombre, ni tu correo, ni tu teléfono</strong>, y
              desaparece si borras los datos de tu navegador.
            </p>
            <p>
              También usamos los píxeles de <strong className="text-white">Meta (Facebook e Instagram)</strong> y
              de <strong className="text-white">TikTok</strong> para medir nuestra publicidad. Puedes limitarlos
              desde la configuración de privacidad de esas plataformas o con un bloqueador en tu navegador.
            </p>
          </Seccion>

          <Seccion titulo="Para qué usamos tus datos">
            <ul className="list-disc pl-5 space-y-1.5 marker:text-slate-600">
              <li>Preparar, despachar y hacerle seguimiento a tu pedido</li>
              <li>Contactarte por WhatsApp para confirmar la entrega o resolver dudas</li>
              <li>Avisarte de ofertas y productos nuevos, si no nos pides lo contrario</li>
              <li>Entender cómo se usa la tienda para mejorarla</li>
            </ul>
            <p>
              <strong className="text-white">Nunca vendemos tus datos</strong> ni se los entregamos a terceros para
              que te ofrezcan cosas.
            </p>
          </Seccion>

          <Seccion titulo="Con quién los compartimos">
            <p>Solo con quienes hacen falta para que tu pedido llegue y la tienda funcione:</p>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-slate-600">
              <li><strong className="text-white">Transportadoras</strong> (Servientrega, Envía, Coordinadora, Interrapidísimo) — tu nombre, teléfono y dirección, para entregarte</li>
              <li><strong className="text-white">Nuestro proveedor de despacho</strong> — para preparar el envío</li>
              <li><strong className="text-white">Twilio</strong> — la plataforma con la que funciona nuestro WhatsApp</li>
              <li><strong className="text-white">Meta y TikTok</strong> — datos de navegación para medir publicidad, no tu dirección ni tu pedido</li>
              <li><strong className="text-white">Supabase y Railway</strong> — donde vive nuestra base de datos y nuestro sitio</li>
            </ul>
          </Seccion>

          <Seccion titulo="Tus derechos">
            <p>
              La Ley 1581 de 2012 te da derecho a <strong className="text-white">conocer, actualizar, rectificar
              y suprimir</strong> tus datos, y a <strong className="text-white">revocar</strong> el permiso que nos
              diste para usarlos.
            </p>
            <p>
              Para ejercerlos, escríbenos por WhatsApp al{" "}
              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola, quiero ejercer mis derechos sobre mis datos personales.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 font-semibold hover:underline"
              >
                +{WHATSAPP}
              </a>
              . Te respondemos en un plazo máximo de <strong className="text-white">10 días hábiles</strong>, como
              exige la ley.
            </p>
            <p>
              Si quieres dejar de recibir nuestros mensajes, basta con responder{" "}
              <strong className="text-white">"NO ESCRIBIR"</strong> por WhatsApp y no volvemos a contactarte.
            </p>
          </Seccion>

          <Seccion titulo="Cuánto tiempo los guardamos">
            <p>
              Conservamos los datos de tu pedido mientras sean necesarios para la entrega, la garantía de 30 días
              y las obligaciones contables. Después de eso, los eliminamos o los dejamos sin posibilidad de
              identificarte. Si nos pides que los borremos antes, lo hacemos.
            </p>
          </Seccion>

          <Seccion titulo="Menores de edad">
            <p>
              Nuestra tienda está dirigida a mayores de 18 años. No recogemos datos de menores a propósito. Si
              eres su padre, madre o acudiente y crees que tenemos datos de un menor, escríbenos y los borramos.
            </p>
          </Seccion>

          <Seccion titulo="Si crees que no cumplimos">
            <p>
              Puedes presentar una queja ante la{" "}
              <strong className="text-white">Superintendencia de Industria y Comercio (SIC)</strong>, que es la
              autoridad de protección de datos en Colombia:{" "}
              <a
                href="https://www.sic.gov.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                www.sic.gov.co
              </a>
              . Aun así, te pedimos que primero nos escribas a nosotros: casi todo se resuelve de una.
            </p>
          </Seccion>

          <Seccion titulo="Cambios">
            <p>
              Si cambiamos esta política, actualizamos la fecha de arriba. Los cambios importantes te los
              avisamos por WhatsApp si eres cliente nuestro.
            </p>
          </Seccion>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5">
          <Link
            to="/landing"
            className="inline-flex items-center gap-2 bg-amber-400 text-black font-black px-5 py-3 rounded-xl text-sm hover:bg-amber-300 transition-colors"
          >
            <ArrowLeft size={16} /> Volver a la tienda
          </Link>
        </div>
      </div>
    </div>
  );
}
