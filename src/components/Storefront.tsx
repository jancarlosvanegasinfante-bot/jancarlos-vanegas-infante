import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { ShoppingBag, Star, Shield, Search, ChevronRight, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export default function Storefront() {
  const { slug } = useParams();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    const fetchStore = async () => {
      try {
        const qStore = query(collection(db, "stores"), where("slug", "==", slug));
        const snapStore = await getDocs(qStore);
        if (!snapStore.empty) {
          const storeData = { id: snapStore.docs[0].id, ...snapStore.docs[0].data() };
          setStore(storeData);

          const qProd = query(collection(db, "products"), where("storeId", "==", storeData.id));
          const prodSnap = await getDocs(qProd);
          const prods = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setProducts(prods);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchStore();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-6 text-center">
        <h1 className="text-3xl font-black text-neutral-800 mb-2">Tienda no encontrada</h1>
        <p className="text-neutral-500">La URL que buscas no pertenece a ninguna tienda registrada.</p>
      </div>
    );
  }

  const handleWhatsAppContact = (productName?: string) => {
    let msg = `Hola, vengo de la tienda ref: #${store.slug} `;
    if (productName) {
      msg += `Estoy interesado en el producto: ${productName}.`;
    } else {
      msg += `Quisiera más información sobre los servicios.`;
    }
    const phone = officialBotNumber || store.phone || "14155238886";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const themeColor = store.themeColor || "#4F46E5";

  return (
    <div className="min-h-screen bg-neutral-50 font-sans" style={{ '--theme-color': themeColor } as any}>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl"
              style={{ backgroundColor: themeColor }}
            >
              {store.name?.charAt(0).toUpperCase()}
            </div>
            <h1 className="font-extrabold text-xl text-neutral-900 tracking-tight">{store.name}</h1>
          </div>
          <button 
            onClick={() => handleWhatsAppContact()}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            style={{ backgroundColor: themeColor }}
          >
            <MessageCircle size={16} fill="currentColor" />
            Contactar Asesor
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white py-16 px-4 mb-8">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-4xl md:text-5xl font-black text-neutral-900 tracking-tight">
            Bienvenido a {store.name}
          </h2>
          <p className="text-lg text-neutral-500 max-w-xl mx-auto leading-relaxed">
            {store.description || "Descubre nuestro catálogo de productos y servicios."}
          </p>
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-24">
        <div className="flex items-center gap-2 mb-8 text-neutral-900">
          <ShoppingBag className="w-6 h-6" />
          <h3 className="text-2xl font-black tracking-tight">Nuestro Catálogo</h3>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border dashed border-neutral-200">
            <h4 className="text-neutral-400 font-bold mb-2">Aún no hay productos</h4>
            <p className="text-neutral-400 text-sm">El dueño de la tienda agregará productos pronto.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((p, idx) => (
              <motion.div 
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-3xl overflow-hidden border border-neutral-100 hover:shadow-xl transition-shadow group flex flex-col"
              >
                <div className="aspect-[4/3] bg-neutral-100 overflow-hidden relative">
                  {p.imageUrl ? (
                    <img 
                      src={p.imageUrl} 
                      alt={p.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
                      <ShoppingBag size={48} />
                    </div>
                  )}
                  {p.stock <= 0 && (
                     <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                       Agotado
                     </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-neutral-50 px-2 py-1 rounded-md">
                      {p.category || 'Producto'}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-neutral-900 leading-tight mb-2 line-clamp-2">{p.name}</h4>
                  <p className="text-xs text-neutral-500 line-clamp-2 mb-4 grow">{p.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <div className="font-black text-lg" style={{ color: themeColor }}>
                      ${(p.price || 0).toLocaleString()}
                    </div>
                    <button 
                      onClick={() => handleWhatsAppContact(p.name)}
                      disabled={p.stock <= 0}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95",
                        p.stock <= 0 ? "opacity-50 cursor-not-allowed bg-neutral-300" : ""
                      )}
                      style={{ backgroundColor: p.stock > 0 ? themeColor : undefined }}
                    >
                      <ShoppingBag size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
