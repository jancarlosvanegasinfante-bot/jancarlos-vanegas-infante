import React, { useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Star, Shield, Truck, Check, MessageCircle, Package, RotateCcw } from "lucide-react";
import { TRENDING_PRODUCTS } from "./LandingPage";
import { ACTIVE_PROMOTIONS } from "../lib/promotions";
import { getProxiedImageUrl } from "../lib/utils";

const NL = String.fromCharCode(10);
const WA_FALLBACK = "14155238886";

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

  useEffect(() => {
    window.scrollTo(0, 0);
    if (product) document.title = product.name + " | Jan Sel Shop";
  }, [product]);

  // Combos que incluyen este producto (venta cruzada).
  const combos = useMemo(
    () => (product ? ACTIVE_PROMOTIONS.filter((c) => c.productIds.includes(product.id)) : []),
    [product]
  );

  if (!product) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <Package size={48} className="text-amber-400" />
        <h1 className="text-2xl font-black">Ese producto ya no esta disponible</h1>
        <p className="text-slate-400 text-sm">Puede que lo hayamos agotado o cambiado de referencia.</p>
        <button
          onClick={() => navigate("/landing")}
          className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-2xl"
        >
          Ver el catalogo
        </button>
      </div>
    );
  }

  const ahorro = product.originalPrice - product.price;
  const descuento = Math.round((1 - product.price / product.originalPrice) * 100);
  const bullets = toBullets(product.description);

  const comprar = () => {
    const msg = [
      "Hola Jan Sel Shop! Vengo de la pagina del producto.",
      "",
      "Me interesa: *" + product.name + "*",
      "Precio: $" + product.price.toLocaleString() + " COP",
      "",
      "Tienen disponible para envio hoy?",
    ].join(NL);
    window.open("https://wa.me/" + WA_FALLBACK + "?text=" + encodeURIComponent(msg), "_blank");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Barra superior */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Volver al catalogo</span>
          </Link>
          <span className="text-[10px] font-mono tracking-[0.2em] text-amber-400 uppercase">Jan Sel Shop</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Imagen */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative">
            <div className="aspect-square rounded-3xl overflow-hidden bg-white/5 border border-white/10">
              <img
                src={getProxiedImageUrl(product.imageUrl)}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = "/images/logo.jpeg"; }}
              />
            </div>
            <span className="absolute top-4 left-4 text-[10px] font-black uppercase tracking-wider bg-amber-500/90 text-black px-3 py-1.5 rounded-full">
              {product.badge}
            </span>
            <span className="absolute top-4 right-4 text-xs font-black bg-red-500 text-white px-3 py-1.5 rounded-full">
              -{descuento}%
            </span>
          </motion.div>

          {/* Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-5">
            <div>
              <span className="text-[10px] font-mono tracking-[0.25em] text-amber-400 uppercase">{product.category}</span>
              <h1 className="text-3xl sm:text-4xl font-black leading-tight mt-1">{product.name}</h1>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={15} className={n <= Math.round(product.rating) ? "text-amber-400 fill-amber-400" : "text-slate-700"} />
                ))}
              </div>
              <span className="text-slate-400 text-xs">{product.rating} · {product.reviews} opiniones</span>
            </div>

            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-slate-500 line-through text-lg">${product.originalPrice.toLocaleString()}</span>
                <span className="text-4xl font-black text-gradient-gold">${product.price.toLocaleString()}</span>
              </div>
              <p className="text-emerald-400 text-sm font-bold mt-1">Ahorras ${ahorro.toLocaleString()} COP</p>
            </div>

            <p className="text-slate-300 leading-relaxed">{product.description}</p>

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

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Package size={14} className="text-amber-400" />
              <span>Quedan {product.stock} unidades</span>
            </div>

            <button
              onClick={comprar}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm uppercase tracking-widest py-4 rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} />
              Pedir por WhatsApp
            </button>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: <Truck size={16} />, t: "Envio gratis" },
                { icon: <Shield size={16} />, t: "Garantia 30 dias" },
                { icon: <RotateCcw size={16} />, t: "Pago al recibir" },
              ].map((x, i) => (
                <div key={i} className="glass-card rounded-2xl border border-white/10 py-3 flex flex-col items-center gap-1">
                  <span className="text-amber-400">{x.icon}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{x.t}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Combos que incluyen este producto */}
        {combos.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-1">
              Llevalo en <span className="text-gradient-gold">combo y ahorra mas</span>
            </h2>
            <p className="text-slate-400 text-sm mb-6">Estos combos incluyen este producto a mejor precio.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {combos.map((c) => (
                <div key={c.id} className="glass-card rounded-3xl border border-amber-500/20 p-5 flex flex-col gap-3">
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

        {/* Otros productos */}
        <section className="mt-16">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-6">
            Tambien te puede <span className="text-gradient-gold">interesar</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <div className="p-3">
                  <p className="text-xs font-bold leading-snug line-clamp-2">{p.name}</p>
                  <p className="text-gradient-gold font-black text-sm mt-1">${p.price.toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
