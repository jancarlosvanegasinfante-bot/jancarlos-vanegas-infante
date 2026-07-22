import * as React from "react";
import { useState, useEffect } from "react";
import { db, collection, onSnapshot, query, orderBy, getDocs } from "../supabase";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShoppingBag, 
  ChevronRight, 
  Star, 
  ShieldCheck, 
  Truck, 
  MessageCircle,
  Zap,
  Info,
  CheckCircle2,
  Phone,
  Video,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Gift,
  Trash2,
  Sparkles,
  ArrowRight
} from "lucide-react";
import toast from "react-hot-toast";
import { ACTIVE_PROMOTIONS } from "../lib/promotions";
import type { PromotionCombo } from "../lib/promotions";
import catalogData from "../catalog.json";
import { getProxiedImageUrl } from "../lib/utils";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  videoUrl?: string;
  category?: string;
  stock?: number;
  storeId?: string;
  provider?: string;
  dropiId?: string;
  cost?: number;
}

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [storesMap, setStoresMap] = useState<Record<string, {name: string, slug: string}>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [officialBotNumber, setOfficialBotNumber] = useState("");

  useEffect(() => {
    fetch("/api/public/config")
      .then(res => res.json())
      .then(data => {
        if (data.whatsappNumber) setOfficialBotNumber(data.whatsappNumber);
      })
      .catch(err => console.error("Error fetching bot config", err));
  }, []);

  useEffect(() => {
    // Fetch stores to map IDs to slugs
    const fetchStores = async () => {
      const snap = await getDocs(collection(db, "stores"));
      const map: Record<string, {name: string, slug: string}> = {};
      snap.docs.forEach(d => {
        map[d.id] = { name: d.data().name, slug: d.data().slug };
      });
      setStoresMap(map);
    };
    fetchStores();

    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      // Enrich Firestore products with supplier metadata from our updated catalog.json
      const enriched = prods.map(p => {
        const catalogMatch = (catalogData.products as Product[]).find(cp => cp.id === p.id);
        if (catalogMatch) {
          return {
            ...p,
            provider: catalogMatch.provider || p.provider,
            dropiId: catalogMatch.dropiId || p.dropiId,
            cost: catalogMatch.cost || p.cost,
            price: p.price || catalogMatch.price
          };
        }
        return p;
      });
      
      setProducts(enriched.length > 0 ? enriched : (catalogData.products as Product[]));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products from Firestore, falling back to local JSON:", error);
      setProducts(catalogData.products as Product[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Cart state
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("jansel_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Error parsing cart", e);
      }
    }
  }, []);

  // Save cart to localStorage
  const saveCart = (newCart: Product[]) => {
    setCart(newCart);
    localStorage.setItem("jansel_cart", JSON.stringify(newCart));
  };

  const addToCart = (product: Product) => {
    // Check if the product has provider metadata. If not, try to look it up in catalogData
    let enrichedProd = { ...product };
    if (!enrichedProd.provider) {
      const match = (catalogData.products as Product[]).find(cp => cp.id === product.id);
      if (match) {
        enrichedProd = {
          ...enrichedProd,
          provider: match.provider,
          dropiId: match.dropiId,
          cost: match.cost
        };
      }
    }

    const updated = [...cart, enrichedProd];
    saveCart(updated);
    toast.success(`¡"${product.name}" añadido al carrito! 🛒`);
  };

  const removeFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    saveCart(updated);
  };

  const decrementCartItem = (productId: string) => {
    const index = cart.findLastIndex(item => item.id === productId);
    if (index !== -1) {
      const updated = [...cart];
      updated.splice(index, 1);
      saveCart(updated);
    }
  };

  const clearCart = () => {
    saveCart([]);
    toast.success("Carrito vaciado 🧹");
  };

  // Group cart items for calculation
  const cartItemCounts = cart.reduce((acc, item) => {
    acc[item.id] = (acc[item.id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueCartItems = cart.filter(
    (item, index, self) => self.findIndex(t => t.id === item.id) === index
  );

  // Count items per provider to detect matching suppliers
  const providerCounts: Record<string, number> = {};
  cart.forEach(item => {
    const p = item.provider || "Otros";
    providerCounts[p] = (providerCounts[p] || 0) + 1;
  });

  // Calculate Consolidated Shipping Discount
  // If the user buys 2 or more products from the same supplier, we deduct $12,000 COP per extra item
  let totalConsolidatedDiscount = 0;
  const activeDiscountProviders: string[] = [];

  Object.entries(providerCounts).forEach(([provider, count]) => {
    if (provider !== "Otros" && count >= 2) {
      totalConsolidatedDiscount += (count - 1) * 12000;
      activeDiscountProviders.push(provider);
    }
  });

  // Supplier Recommendations: find products from the same suppliers in the cart but not currently in the cart
  const cartProviders = Array.from(
    new Set(cart.map(item => item.provider).filter(p => p && p !== "Otros"))
  );

  const sameProviderRecommendations = products
    .filter(p => 
      p.provider && 
      cartProviders.includes(p.provider) && 
      !cart.some(item => item.id === p.id)
    )
    .slice(0, 4);

  const categories = ["Todos", ...Array.from(new Set(products.map(p => p.category || "Otros").filter(Boolean)))];

  const filteredProducts = selectedCategory === "Todos" 
    ? products 
    : products.filter(p => (p.category || "Otros") === selectedCategory);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(price);
  };

  const currentWhatsApp = officialBotNumber || "15072233213"; // Jan Bot Phone

  const getWhatsAppLink = (product: Product) => {
    const storeInfo = product.storeId ? storesMap[product.storeId] : null;
    const storeSlug = storeInfo?.slug || "jansel-shop";
    const storeName = storeInfo?.name || "Jan Sel Shop";
    const msg = `¡Hola Jan! 👋 Vengo de la tienda *${storeName}* ref: #${storeSlug}.\nMe interesó mucho el producto *${product.name}*\n(Proveedor: ${product.provider || "Dropi"}, ID: ${product.dropiId || "N/A"})\n\n¿Todavía te quedan disponibles para pago contraentrega? 📦🚀`;
    return `https://wa.me/${currentWhatsApp}?text=${encodeURIComponent(msg)}`;
  };

  const getCartWhatsAppLink = () => {
    // Generate a beautiful, highly detailed list of items for Jan and the buyer
    const itemsList = uniqueCartItems.map((item, idx) => {
      const qty = cartItemCounts[item.id];
      const supplierStr = item.provider ? ` [Socio: ${item.provider}]` : '';
      return `${idx + 1}. *${item.name}* x${qty} - ${formatPrice(item.price * qty)} (Ref ID: ${item.dropiId || 'Sin ID'}${supplierStr})`;
    }).join('\n');

    const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
    const total = subtotal - totalConsolidatedDiscount;

    const msg = `¡Hola Jan! 👋 Vengo del catálogo Jan Sel Shop.\nQuiero realizar un pedido con despacho consolidado:\n\n` +
      `🛒 *MI PEDIDO:*\n${itemsList}\n\n` +
      `📈 *SUBTOTAL:* ${formatPrice(subtotal)}\n` +
      (totalConsolidatedDiscount > 0 
        ? `🔥 *DESCUENTO MULTI-ENVÍO:* -${formatPrice(totalConsolidatedDiscount)} (Por llevar artículos de un mismo proveedor: ${activeDiscountProviders.join(", ")}) ✨\n` 
        : `💡 *Mismo Proveedor:* Si agregas otro artículo del mismo proveedor a tu carrito, ¡te descontamos ${formatPrice(12000)}!\n`) +
      `💵 *TOTAL NETO A PAGAR:* *${formatPrice(total)}*\n\n` +
      `📍 *MÉTODO:* Pago Contraentrega (Pago al Recibir)\n\n` +
      `¿Me confirmas disponibilidad para despachar en un solo paquete hoy mismo? 🚀📦`;

    return `https://wa.me/${currentWhatsApp}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-dark-accent selection:text-white">
      {/* Header / Hero */}
      <header className="relative py-12 px-6 border-b border-white/5 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-dark-accent rounded-full blur-[120px]" />
          <div className="absolute top-1/2 -right-24 w-96 h-96 bg-dark-green rounded-full blur-[120px]" />
        </div>
        
        <div className="max-w-6xl mx-auto text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <img 
              src="/images/logo.jpg" 
              alt="Jansel Shop Logo" 
              className="w-24 h-24 object-contain rounded-2xl shadow-[0_0_30px_rgba(0,180,255,0.4)] mx-auto hover:scale-105 transition-transform"
              onError={(e) => {
                e.currentTarget.src = "/images/logo.png";
                e.currentTarget.onerror = null;
              }}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6"
          >
            <Zap size={14} className="text-dark-accent" />
            <span className="text-[10px] font-black uppercase tracking-widest">Jan Sel Shop - Catálogo Oficial</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black mb-6 tracking-tighter leading-none italic uppercase"
          >
            Dale <span className="text-dark-accent">Vida</span> a tu <span className="text-dark-green">Bólido</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-neutral-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed"
          >
            Seleccionamos solo lo mejor para que tu vehículo resalte en la calle. 
            Productos premium con despacho hoy mismo y pago al recibir. 📦🚀
          </motion.p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Categories Bar */}
        <div className="flex items-center gap-3 overflow-x-auto pb-8 mb-12 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                selectedCategory === cat 
                  ? "bg-white text-black border-white" 
                  : "bg-white/5 text-neutral-500 border-white/10 hover:border-white/30"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Combos Especiales Section */}
        {selectedCategory === "Todos" && (
          <div className="mb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-red-400">Promociones de Locura 🔥</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-none italic">
                  Combos <span className="text-dark-accent">Cross-Selling</span> Especiales
                </h2>
                <p className="text-neutral-400 text-xs mt-2 max-w-xl">
                  Lleva productos complementarios de un mismo proveedor con descuentos masivos de hasta el 20%. ¡Envío GRATIS y pago contraentrega! 📦🚀
                </p>
              </div>
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                {ACTIVE_PROMOTIONS.length} COMBOS ACTIVOS ⚡
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ACTIVE_PROMOTIONS.map((combo) => {
                return (
                  <div 
                    key={combo.id}
                    className="relative group bg-neutral-900/60 rounded-[2.5rem] border border-red-500/10 hover:border-dark-accent/40 transition-all p-6 flex flex-col justify-between overflow-hidden shadow-2xl animate-fade-in"
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-dark-accent/10 rounded-full blur-2xl group-hover:bg-dark-accent/20 transition-all" />

                    <div>
                      {/* Badge and Discount tag */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className="text-[9px] font-black uppercase bg-dark-accent/20 text-dark-accent px-3 py-1 rounded-full border border-dark-accent/20">
                          {combo.badge}
                        </span>
                        <span className="text-[10px] font-black uppercase bg-red-600 text-white px-2.5 py-1 rounded-lg animate-pulse">
                          AHORRA {combo.discountPercentage}% 💰
                        </span>
                      </div>

                      {/* Images overlap block */}
                      <div className="flex items-center justify-center gap-2 mb-6 bg-black/30 p-4 rounded-3xl border border-white/5 h-36">
                        {combo.productIds.map((pId, idx) => {
                          const prod = products.find(p => p.id === pId);
                          return (
                            <div key={pId} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/10 bg-neutral-800 flex-shrink-0 group-hover:scale-105 transition-transform duration-500">
                              {prod?.imageUrl ? (
                                <img 
                                  src={getProxiedImageUrl(prod.imageUrl)} 
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag size={20} className="text-white/20" />
                                </div>
                              )}
                              {/* Product tag/badge */}
                              <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-extrabold text-neutral-300">
                                #{idx + 1}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <h3 className="text-lg font-black uppercase tracking-tight mb-1 text-white group-hover:text-dark-accent transition-colors leading-tight">
                        {combo.name}
                      </h3>
                      <p className="text-dark-green text-[10px] font-black uppercase tracking-widest mb-3 italic">
                        {combo.tagline}
                      </p>
                      <p className="text-neutral-400 text-xs leading-relaxed line-clamp-3 mb-6 font-medium">
                        {combo.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex flex-col gap-4">
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-[10px] text-neutral-500 line-through font-bold block decoration-red-500">
                            {formatPrice(combo.originalPrice)}
                          </span>
                          <span className="text-2xl font-black text-white tracking-tighter block">
                            {formatPrice(combo.promoPrice)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-black text-dark-green bg-dark-green/10 px-2.5 py-1 rounded-full uppercase block">
                            Envío Gratis 🚛💨
                          </span>
                        </div>
                      </div>

                      <a 
                        href={`https://wa.me/${currentWhatsApp}?text=${encodeURIComponent(
                          `¡Hola Jan! 👋 Vengo del catálogo. Me interesó la súper promo de combo: *${combo.name}* (*${combo.tagline}*) por solo *${formatPrice(combo.promoPrice)}* (ahorro del ${combo.discountPercentage}%). ¿Tienes disponibilidad para envío inmediato?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 bg-dark-green text-black font-black text-[10px] uppercase tracking-widest py-3.5 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-dark-green/10"
                      >
                        Pedir Combo en WhatsApp <Phone size={14} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-96 rounded-3xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={product.id}
                  className="group bg-neutral-900/40 rounded-[2rem] border border-white/5 overflow-hidden hover:border-dark-accent/40 transition-all flex flex-col h-full"
                >
                  {/* Image Area */}
                  <div className="aspect-square relative overflow-hidden bg-black/40">
                    {product.imageUrl ? (
                      <img 
                        src={getProxiedImageUrl(product.imageUrl)} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (!e.currentTarget.src.endsWith('/images/logo.jpeg')) {
                            e.currentTarget.src = '/images/logo.jpeg';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                        <ShoppingBag className="text-white/10" size={48} />
                      </div>
                    )}
                    
                    {/* Badge Promo */}
                    <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                      <div className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-xl animate-pulse">
                        -30% HOY 🔥
                      </div>
                      <div className="bg-white/10 backdrop-blur-md text-white text-[8px] font-black px-2 py-1 rounded-full border border-white/20">
                        ÚLTIMAS UNIDADES 📦
                      </div>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-dark-accent uppercase tracking-widest">Garantizado ✅</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2 tracking-tight group-hover:text-dark-accent transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-neutral-400 text-xs leading-relaxed line-clamp-3 mb-4 font-medium">
                        {product.description}
                      </p>
                    </div>

                    <div className="flex flex-col gap-4 mt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[12px] text-neutral-500 line-through font-bold decoration-red-500/50">
                            {formatPrice(product.price * 1.4)}
                          </p>
                          <p className="text-3xl font-black text-white tracking-tighter">
                            {formatPrice(product.price)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1 text-dark-green bg-dark-green/10 px-2 py-1 rounded-lg mb-1">
                            <Truck size={12} />
                            <span className="text-[9px] font-black uppercase">Envío Grátis</span>
                          </div>
                          <span className="text-[8px] text-dark-accent font-black uppercase">Ahorras {formatPrice(product.price * 0.4)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => {
                            addToCart(product);
                            setIsCartOpen(true);
                          }}
                          className="flex items-center justify-center gap-2 bg-dark-green text-black font-black text-[10px] uppercase tracking-widest py-3 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-dark-green/10 cursor-pointer"
                        >
                          Lo quiero <ShoppingCart size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            if (product.videoUrl) window.open(product.videoUrl, '_blank');
                            else toast("¡Pronto tendremos video de este producto! ✨");
                          }}
                          className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:border-white/30 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-2xl transition-all"
                        >
                          Ver Video <Video size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer Features */}
      <footer className="bg-black/40 border-t border-white/5 mt-20 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-dark-accent/10 flex items-center justify-center text-dark-accent mx-auto md:mx-0">
                <Truck size={24} />
              </div>
              <h4 className="font-bold uppercase tracking-widest text-xs">Pago Contraentrega</h4>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Pides hoy y pagas solamente cuando el producto llegue a la puerta de tu casa. Sin riesgos.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-dark-green/10 flex items-center justify-center text-dark-green mx-auto md:mx-0">
                <ShieldCheck size={24} />
              </div>
              <h4 className="font-bold uppercase tracking-widest text-xs">Garantía de Calidad</h4>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Todos nuestros productos son probados y certificados. Si no te sirve, te lo cambiamos.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto md:mx-0">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-bold uppercase tracking-widest text-xs">Soporte VIP</h4>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Atención personalizada por WhatsApp antes, durante y después de tu compra.
              </p>
            </div>
          </div>
          
          <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
              © 2026 JANSEL SHOP - MEDELLÍN, COLOMBIA
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-neutral-600 hover:text-white transition-colors"><Star size={18} /></a>
              <a href="#" className="text-neutral-600 hover:text-white transition-colors"><MessageCircle size={18} /></a>
            </div>
          </div>
        </div>
      </footer>

      {/* FLOATING CART BUTTON */}
      <AnimatePresence>
        {cart.length > 0 && !isCartOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-3 bg-dark-green text-black px-6 py-4 rounded-full font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-dark-green/30 cursor-pointer border border-white/10"
            id="floating-cart-btn"
          >
            <div className="relative">
              <ShoppingCart size={20} />
              <span className="absolute -top-2.5 -right-2.5 bg-red-600 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce border border-[#0a0a0a]">
                {cart.length}
              </span>
            </div>
            Ver Carrito 🛒
          </motion.button>
        )}
      </AnimatePresence>

      {/* SLIDING CART DRAWER */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 cursor-pointer"
              id="cart-backdrop"
            />

            {/* Side sheet */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-[#0f0f0f] border-l border-white/5 shadow-2xl z-50 flex flex-col justify-between select-none overflow-hidden"
              id="cart-drawer"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-dark-green/10 text-dark-green border border-dark-green/20">
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-tight leading-none">Mi Carrito</h3>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1 block">
                      {cart.length} {cart.length === 1 ? 'artículo' : 'artículos'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button 
                      onClick={clearCart}
                      className="p-2 rounded-xl text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-all text-xs font-bold uppercase tracking-widest border border-transparent hover:border-red-500/10"
                    >
                      Vaciar
                    </button>
                  )}
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all border border-white/5"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Items List (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-neutral-500 border border-white/10">
                      <ShoppingBag size={28} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white uppercase tracking-tight">Tu carrito está vacío</h4>
                      <p className="text-neutral-500 text-xs mt-1 max-w-[240px] mx-auto">
                        Agrega productos del catálogo para armar tu combo y ahorrar en el envío.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="bg-white text-black font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                    >
                      Explorar Catálogo <ArrowRight size={12} className="inline ml-1" />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* LIST OF CART ITEMS */}
                    <div className="space-y-3">
                      {uniqueCartItems.map((item) => {
                        const count = cartItemCounts[item.id];
                        return (
                          <div 
                            key={item.id}
                            className="bg-neutral-900/50 rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
                                {item.imageUrl ? (
                                  <img 
                                    src={getProxiedImageUrl(item.imageUrl)} 
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                    📦
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-black text-xs text-white truncate uppercase tracking-tight">
                                  {item.name}
                                </h4>
                                {item.provider && (
                                  <span className="text-[9px] text-dark-accent font-black uppercase tracking-wider block mt-0.5">
                                    Socio: {item.provider}
                                  </span>
                                )}
                                <span className="text-xs text-neutral-400 font-bold block mt-1">
                                  {formatPrice(item.price)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Quantity selectors */}
                              <div className="flex items-center bg-black/40 border border-white/5 rounded-lg p-1">
                                <button 
                                  onClick={() => decrementCartItem(item.id)}
                                  className="p-1 text-neutral-400 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="px-2.5 text-xs font-black text-white">
                                  {count}
                                </span>
                                <button 
                                  onClick={() => addToCart(item)}
                                  className="p-1 text-neutral-400 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* DYNAMIC SUPPLIER SHIPPING DISCOUNT NOTICE */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/20 to-neutral-900 border border-red-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-red-400">
                        <Sparkles size={16} className="animate-spin duration-1000" />
                        <h4 className="font-black text-[10px] uppercase tracking-wider">
                          Estrategia de Despacho Inteligente 🚚
                        </h4>
                      </div>
                      
                      {activeDiscountProviders.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs text-neutral-300 leading-normal">
                            🎉 ¡Súper ahorro de envío activo! Has agregado varios productos de un mismo proveedor: <strong className="text-white">{activeDiscountProviders.join(", ")}</strong>.
                          </p>
                          <p className="text-xs text-dark-green font-black uppercase tracking-wider">
                            Descuento Multi-Envío Aplicado: -{formatPrice(totalConsolidatedDiscount)} COP! 🔥
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-neutral-400 leading-normal">
                            Compra inteligente: si compras varios artículos del <span className="text-white font-bold">mismo proveedor</span>, Jan puede enviarlos en un <span className="text-white font-bold">solo paquete</span> y te descontamos <strong className="text-dark-green font-black">{formatPrice(12000)} COP</strong> del envío de cada producto extra.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* SAME PROVIDER RECOMMENDATIONS (UPSELL ACTION) */}
                    {sameProviderRecommendations.length > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black uppercase text-dark-accent tracking-widest flex items-center gap-1.5 font-sans">
                            <Gift size={12} /> Sugerencias de Mismo Proveedor
                          </span>
                          <span className="text-[8px] text-neutral-500 font-extrabold uppercase">
                            ¡Ahorras Envío! 📦
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {sameProviderRecommendations.map(rec => (
                            <div 
                              key={rec.id}
                              className="bg-white/5 border border-white/5 hover:border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-3 group/rec transition-all"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-9 h-9 rounded-lg overflow-hidden bg-black/20 flex-shrink-0">
                                  {rec.imageUrl ? (
                                    <img 
                                      src={getProxiedImageUrl(rec.imageUrl)} 
                                      alt={rec.name}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="text-[10px] font-bold text-white truncate uppercase tracking-tight group-hover/rec:text-dark-accent transition-colors">
                                    {rec.name}
                                  </h5>
                                  <span className="text-[9px] text-neutral-400 font-black block mt-0.5">
                                    {formatPrice(rec.price)}
                                  </span>
                                </div>
                              </div>
                              <button 
                                onClick={() => addToCart(rec)}
                                className="flex-shrink-0 bg-dark-green text-black font-black text-[8px] uppercase tracking-wider py-1.5 px-3 rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                              >
                                + Agregar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Checkout Block */}
              {cart.length > 0 && (
                <div className="p-6 bg-black/40 border-t border-white/5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
                      <span>Subtotal de artículos</span>
                      <span className="text-white font-bold">
                        {formatPrice(cart.reduce((sum, item) => sum + item.price, 0))}
                      </span>
                    </div>
                    {totalConsolidatedDiscount > 0 && (
                      <div className="flex items-center justify-between text-xs text-dark-green font-bold">
                        <span>Ahorro Despacho Consolidado 🔥</span>
                        <span>-{formatPrice(totalConsolidatedDiscount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-sm font-black uppercase text-white tracking-tight">Total a Pagar en Casa</span>
                      <span className="text-xl font-black text-white tracking-tighter">
                        {formatPrice(cart.reduce((sum, item) => sum + item.price, 0) - totalConsolidatedDiscount)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <a 
                      href={getCartWhatsAppLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-dark-green text-black font-black text-xs uppercase tracking-widest py-4 rounded-2xl hover:scale-[1.01] active:scale-95 transition-all shadow-lg shadow-dark-green/20"
                    >
                      Pedir por WhatsApp <Phone size={14} />
                    </a>
                    <p className="text-[9px] text-center text-neutral-500 font-bold uppercase tracking-wider">
                      🚛 Envíos rápidos por Dropi | 💵 Pago contraentrega garantizado
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Utility for tailwind classes if not imported
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
