import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Star, Shield, Truck, Check, MessageCircle, Package, RotateCcw, Flame } from "lucide-react";
import { TRENDING_PRODUCTS } from "./LandingPage";
import { ACTIVE_PROMOTIONS } from "../lib/promotions";
import { getProxiedImageUrl } from "../lib/utils";

const NL = String.fromCharCode(10);
// Numero de respaldo: el REAL del negocio, no el sandbox de Twilio. Antes aqui
// habia un 14155238886 fijo (numero de pruebas), asi que todo cliente que tocaba
// "Lo quiero" desde la ficha del producto le escribia a un numero que no atiende.
const WA_FALLBACK = "15072233213";

// Convierte la descripcion en vinetas de beneficio: cada frase es un punto.
const toBullets = (description: string): string[] =>
  description
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 12)
    .slice(0, 6);

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = useMemo(() => TRENDING_PRODUCTS.find((p) => p.id === id), [id]);

  // La barra fija de compra aparece al pasar el primer CTA, para no taparlo
  // cuando ya esta a la vista.
  // El numero se lee de la configuracion de la tienda, igual que hace la landing,
  // para que cambiarlo en un solo sitio valga para toda la web.
  const [waNumber, setWaNumber] = useState(WA_FALLBACK);
  useEffect(() => {
    fetch("/api/public/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.whatsappNumber) setWaNumber(String(d.whatsappNumber).replace(/\D/g, "")); })
      .catch(() => { /* se queda el de respaldo */ });
  }, []);

  const [mostrarBarra, setMostrarBarra] = useState(false);
  useEffect(() => {
    const onScroll = () => setMostrarBarra(window.scrollY > 420);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (product) document.title = product.name + " | Jan Sel Shop";
  }, [product]);

  const combos = useMemo(
    () => (product ? ACTIVE_PROMOTIONS.filter((c) => c.productIds.includes(product.id)) : []),
    [product]
  );

  if (!product) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <Package size={48} className="text-amber-400" />
        <h1 className="text-2xl font-black">Ese producto ya no está disponible</h1>
        <p className="text-slate-400 text-sm">Puede que lo hayamos agotado o cambiado de referencia.</p>
        <button
          onClick={() => navigate("/landing")}
          className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl"
        >
          Ver el catálogo
        </button>
      </div>
    );
  }

  const ahorro = product.originalPrice - product.price;
  const descuento = Math.round((1 - product.price / product.originalPrice) * 100);
  const bullets = toBullets(product.description);
  // Barra de existencias: comunica escasez con el dato real, sin inventarlo.
  const stockPct = Math.max(8, Math.min(100, Math.round((product.stock / 60) * 100)));

  const comprar = () => {
    const msg = [
      "Hola Jan Sel Shop! Vengo de la página del producto.",
      "",
      "Me interesa: *" + product.name + "*",
      "Precio: $" + product.price.toLocaleString() + " COP",
      "",
      "¿Tienen disponible para envío hoy?",
    ].join(NL);
    window.open("https://wa.me/" + waNumber + "?text=" + encodeURIComponent(msg), "_blank");
  };

  return (
    // El padding inferior deja aire para que la barra fija no tape el contenido.
    <div className="min-h-screen bg-black text-white pb-28 sm:pb-0">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Volver</span>
          </Link>
          <span className="text-[10px] font-mono tracking-[0.2em] text-amber-400 uppercase">Jan Sel Shop</span>
        </div>
      </header>

      {/* Franja de confianza: lo primero que ve alguien que llega de un anuncio y
          todavia no conoce la tienda. */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-b border-amber-500/20">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[11px] sm:text-xs font-bold">
          <span className="flex items-center gap-1.5 text-emerald-400"><Truck size={13} /> Envío GRATIS</span>
          <span className="text-white/20">•</span>
          <span className="flex items-center gap-1.5 text-amber-300"><Shield size={13} /> Pagas al recibir</span>
          <span className="text-white/20">•</span>
          <span className="flex items-center gap-1.5 text-sky-300"><RotateCcw size={13} /> Garantía 30 días</span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-5 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
          {/* Imagen: en móvil se limita la altura para que el precio y el botón
              queden a la vista sin tener que hacer scroll. */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative">
            <div className="relative w-full h-[46vh] max-h-[380px] sm:h-auto sm:aspect-square rounded-3xl overflow-hidden bg-white/5 border border-white/10">
              <img
                src={getProxiedImageUrl(product.imageUrl)}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = "/images/logo.jpeg"; }}
              />
            </div>
            <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider bg-amber-500 text-black px-3 py-1.5 rounded-full shadow-lg">
              {product.badge}
            </span>
            <motion.span
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="absolute top-3 right-3 text-sm font-black bg-red-500 text-white px-3 py-1.5 rounded-full shadow-lg"
            >
              -{descuento}%
            </motion.span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-mono tracking-[0.25em] text-amber-400 uppercase">{product.category}</span>
              <h1 className="text-2xl sm:text-4xl font-black leading-tight mt-1">{product.name}</h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={14} className={n <= Math.round(product.rating) ? "text-amber-400 fill-amber-400" : "text-slate-700"} />
                ))}
              </div>
              <span className="text-white text-xs font-bold">{product.rating}</span>
              <span className="text-slate-400 text-xs">· {product.reviews} personas ya lo compraron</span>
            </div>

            {/* Precio: el bloque más importante de la página en móvil. */}
            <div className="glass-card rounded-3xl border border-amber-500/25 p-4">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-slate-500 line-through text-base">${product.originalPrice.toLocaleString()}</span>
                <span className="text-4xl sm:text-5xl font-black text-gradient-gold leading-none">
                  ${product.price.toLocaleString()}
                </span>
              </div>
              <p className="text-emerald-400 text-sm font-black mt-1.5">
                🎉 Te ahorras ${ahorro.toLocaleString()} COP
              </p>
              <p className="text-slate-400 text-[11px] mt-1">Precio con envío incluido · Pagas cuando lo recibas</p>
            </div>

            {/* CTA principal, arriba del pliegue en móvil */}
            <motion.button
              onClick={comprar}
              whileTap={{ scale: 0.97 }}
              animate={{ boxShadow: ["0 0 0 rgba(251,191,36,0)", "0 0 26px rgba(251,191,36,0.4)", "0 0 0 rgba(251,191,36,0)"] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm sm:text-base uppercase tracking-widest py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-2"
            >
              <MessageCircle size={19} />
              Lo quiero — Pedir ahora
            </motion.button>
            <p className="text-center text-slate-500 text-[11px] -mt-1">
              Te responde una persona en minutos · Sin pagar nada por adelantado
            </p>

            {/* Existencias con el dato real del inventario */}
            <div className="glass-card rounded-2xl border border-white/10 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                  <Flame size={13} /> Quedan {product.stock} unidades
                </span>
                <span className="text-[10px] text-slate-500">Stock limitado</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 to-red-500"
                  initial={{ width: 0 }}
                  animate={{ width: stockPct + "%" }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>
            </div>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{product.description}</p>

            {bullets.length > 0 && (
              <ul className="space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <Check size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: <Truck size={17} />, t: "Envío gratis", s: "A toda Colombia" },
                { icon: <Shield size={17} />, t: "Garantía", s: "30 días" },
                { icon: <RotateCcw size={17} />, t: "Contra entrega", s: "Pagas al recibir" },
              ].map((x, i) => (
                <div key={i} className="glass-card rounded-2xl border border-white/10 py-3 px-1 flex flex-col items-center gap-1">
                  <span className="text-amber-400">{x.icon}</span>
                  <span className="text-[10px] text-white font-black uppercase leading-tight">{x.t}</span>
                  <span className="text-[9px] text-slate-500 leading-tight">{x.s}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {combos.length > 0 && (
          <section className="mt-12 sm:mt-16">
            <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tight mb-1">
              Llévalo en <span className="text-gradient-gold">combo y ahorra más</span>
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mb-5">Estos combos lo incluyen a mejor precio.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {combos.map((c) => (
                <div key={c.id} className="glass-card rounded-3xl border border-amber-500/20 p-4 flex flex-col gap-3">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 px-3 py-1.5 rounded-full self-start">
                    {c.badge}
                  </span>
                  <div>
                    <h3 className="font-black leading-tight">{c.name}</h3>
                    <p className="text-amber-400/90 text-xs font-bold mt-0.5">{c.tagline}</p>
                  </div>
                  <ul className="space-y-1">
                    {c.productIds.map((pid) => {
                      const p = TRENDING_PRODUCTS.find((x) => x.id === pid);
                      return p ? (
                        <li key={pid} className="text-slate-400 text-xs flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5">✓</span>
                          <span>{p.name}</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                  <div className="mt-auto">
                    <div className="flex items-baseline gap-2">
                      <span className="text-slate-500 line-through text-xs">${c.originalPrice.toLocaleString()}</span>
                      <span className="text-xl font-black text-gradient-gold">${c.promoPrice.toLocaleString()}</span>
                    </div>
                    <p className="text-emerald-400 text-[11px] font-bold">
                      Ahorras ${(c.originalPrice - c.promoPrice).toLocaleString()}
                    </p>
                    <Link
                      to="/landing#combos"
                      className="block text-center mt-3 bg-white/5 border border-amber-500/30 text-amber-300 font-black text-[10px] uppercase tracking-widest py-3 rounded-2xl hover:bg-amber-500/10 transition-colors"
                    >
                      Ver combo
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 sm:mt-16">
          <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tight mb-5">
            También te puede <span className="text-gradient-gold">interesar</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {TRENDING_PRODUCTS.filter((p) => p.id !== product.id).slice(0, 4).map((p) => (
              <Link key={p.id} to={"/producto/" + p.id} className="glass-card rounded-2xl border border-white/10 overflow-hidden hover:border-amber-400/40 transition-colors">
                <div className="aspect-square bg-white/5">
                  <img
                    src={getProxiedImageUrl(p.imageUrl)}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = "/images/logo.jpeg"; }}
                  />
                </div>
                <div className="p-2.5 sm:p-3">
                  <p className="text-[11px] sm:text-xs font-bold leading-snug line-clamp-2">{p.name}</p>
                  <p className="text-gradient-gold font-black text-sm mt-1">${p.price.toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* Barra fija de compra: en un celular el botón queda siempre al alcance del
          pulgar, sin importar cuánto haya bajado el visitante. Es lo que más
          levanta la conversión en móvil. */}
      <motion.div
        initial={{ y: 120 }}
        animate={{ y: mostrarBarra ? 0 : 120 }}
        transition={{ type: "spring", damping: 22 }}
        className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-black/90 backdrop-blur-xl border-t border-amber-500/25 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[10px] text-slate-500 line-through leading-none">
              ${product.originalPrice.toLocaleString()}
            </p>
            <p className="text-lg font-black text-gradient-gold leading-tight">
              ${product.price.toLocaleString()}
            </p>
          </div>
          <button
            onClick={comprar}
            className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <MessageCircle size={16} />
            Lo quiero
          </button>
        </div>
      </motion.div>
    </div>
  );
}
