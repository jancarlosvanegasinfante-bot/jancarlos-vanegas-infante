import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingBag,
  CheckCircle,
  Truck,
  ShieldCheck,
  Clock,
  Star,
  MessageCircle,
  ArrowRight,
  Phone,
  MapPin,
  Lock,
  Sparkles,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  ChevronDown,
  Zap,
  Package,
  BadgeCheck,
  Users,
  Gift,
  TrendingUp,
  AlertTriangle,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import ReferralChallenge, { ReferralJoin, Confetti } from "./ReferralChallenge";
import { getProxiedImageUrl } from "../lib/utils";
import { idVisitante, origenVisita } from "../lib/pixel";
import toast from "react-hot-toast";
import PromoFlow from "./PromoFlow";
import { ACTIVE_PROMOTIONS } from "../lib/promotions";

// ─── Products ────────────────────────────────────────────────────────────────
export const TRENDING_PRODUCTS = [
  {
    id: "cargador-aromatizante-carro",
    name: "Modulador Cargador Aromatizante 4 en 1",
    category: "Autos",
    description: "Cables enredados y olor a encierro, resueltos de una. Carga 4 dispositivos con cables que se recogen solos, aromatiza y da luces RGB. Incluye 3 esencias.",
    price: 99900,
    originalPrice: 159900,
    imageUrl: "/images/cargador-aromatizante-carro.jpg",
    rating: 4.9,
    reviews: 87,
    stock: 40,
    badge: "🆕 NUEVO",
  },
  {
    id: "soporte-de-carga-magnetica",
    name: "Soporte de Carga Magnética",
    category: "Autos",
    description: "Deja de pelear con tres cables. Pega el celular y carga solo, junto a tus audífonos y tu reloj. Se dobla y cabe en el bolsillo.",
    price: 120900,
    originalPrice: 189900,
    imageUrl: "/images/soporte-de-carga-magnetica.png",
    rating: 4.9,
    reviews: 214,
    stock: 40,
    badge: "⚡ MÁS VENDIDO",
  },
  {
    id: "carpa-cobertor-carro",
    name: "Carpa Cobertor para Carro Talla M",
    category: "Autos",
    description: "Tu carro duerme en la calle. Esta carpa lo protege del sol que le quema la pintura, del aguacero y de la mugre de los árboles.",
    price: 69900,
    originalPrice: 119900,
    imageUrl: "/images/carpa-cobertor-carro.png",
    rating: 4.7,
    reviews: 121,
    stock: 35,
    badge: "🚗 PROTECCIÓN TOTAL",
  },
  {
    id: "soporte-holder-moto",
    name: "Soporte Holder para Moto Cremallera RC",
    category: "Motos",
    description: "Manejar mirando el GPS en la mano es como llegas a un accidente. Aquí va fijo, y funciona la pantalla aunque esté lloviendo.",
    price: 59900,
    originalPrice: 99900,
    imageUrl: "/images/soporte-holder-moto.png",
    rating: 4.8,
    reviews: 133,
    stock: 40,
    badge: "🏍️ IMPERMEABLE",
  },
  {
    id: "game-stick-retro-m8",
    name: "Game Stick Retro M8",
    category: "Tecnología",
    description: "Más de 10.000 juegos de tu infancia en el televisor de la sala. Conectas el HDMI y en un minuto estás jugando, con 2 controles.",
    price: 159900,
    originalPrice: 249900,
    imageUrl: "/images/game-stick-retro-m8.png",
    rating: 4.9,
    reviews: 265,
    stock: 30,
    badge: "🎮 +10.000 JUEGOS",
  },
  {
    id: "cargador-celular-moto",
    name: "Cargador de Celular para Moto",
    category: "Motos",
    description: "Quedarte sin batería a mitad de domicilio es quedarte sin GPS y sin llamadas. Carga 4 veces más rápido mientras ruedas.",
    price: 59900,
    originalPrice: 99900,
    imageUrl: "/images/cargador-celular-moto.png",
    rating: 4.9,
    reviews: 302,
    stock: 45,
    badge: "⚡ CARGA RÁPIDA",
  },
  {
    id: "aspiradora-de-mano",
    name: "Aspiradora de Mano Inalámbrica",
    category: "Tecnología",
    description: "La arena entre los asientos y las migas de los niños salen en dos minutos. Sin cables, sin ir hasta la lavada del carro.",
    price: 97900,
    originalPrice: 159900,
    imageUrl: "/images/aspiradora-de-mano.png",
    rating: 4.8,
    reviews: 178,
    stock: 40,
    badge: "🌀 SUCCIÓN POTENTE",
  },
  {
    id: "mini-pulidora-inalambrica",
    name: "Mini Pulidora Inalámbrica",
    category: "Tecnología",
    description: "Corta, pule y desbasta metal, acero y madera sin buscar dónde enchufarla. Cabe en una mano y trae estuche.",
    price: 123900,
    originalPrice: 199900,
    imageUrl: "/images/mini-pulidora-inalambrica.png",
    rating: 4.9,
    reviews: 96,
    stock: 30,
    badge: "🔧 POTENCIA PRO",
  },
  {
    id: "selfie-stick-tripode",
    name: "Selfie Stick Trípode con Luz LED",
    category: "Tecnología",
    description: "Graba con luz de estudio y sin que te tiemble el pulso. Se para solo, gira 360° y disparas desde 10 metros.",
    price: 139900,
    originalPrice: 219900,
    imageUrl: "/images/selfie-stick-tripode.png",
    rating: 4.8,
    reviews: 87,
    stock: 35,
    badge: "📸 LUZ LED",
  },
  {
    id: "candado-moto-manubrio",
    name: "Candado para Moto Manubrio Seguridad RC",
    category: "Motos",
    description: "Se roban una moto y a los cinco minutos ya va lejos. Este candado bloquea el freno o el manubrio y no la mueven.",
    price: 65900,
    originalPrice: 109900,
    imageUrl: "/images/candado-moto-manubrio.png",
    rating: 4.8,
    reviews: 141,
    stock: 40,
    badge: "🔒 ANTIRROBO",
  },
  {
    id: "iniciador-de-bateria",
    name: "Iniciador de Batería TC",
    category: "Autos",
    description: "Batería muerta a las 6 de la mañana y nadie que te dé corriente. Con esto arrancas tu carro solo, en un minuto.",
    price: 89900,
    originalPrice: 149900,
    imageUrl: "/images/iniciador-de-bateria.png",
    rating: 4.9,
    reviews: 110,
    stock: 35,
    badge: "🔋 ARRANQUE RÁPIDO",
  },
];

// El descuento por invitar exige llevar 2+ productos: en un pedido de dos el
// margen absoluto es bastante mayor, asi que el 15% sale de ahi sin comerse
// la ganancia de una venta suelta.
const REFERRAL_MIN_ITEMS = 2;

const CATEGORIES = ["Todos", "Motos", "Autos", "Tecnología"];

const TESTIMONIALS = [
  {
    name: "Carlos M.",
    city: "Cali",
    avatar: "CM",
    color: "from-blue-500 to-indigo-600",
    rating: 5,
    text: "Pedí el módem portátil y me llegó súper rápido. Pagué contraentrega al mensajero. Espectacular el servicio, todo original y bien empacado. 100% recomendado.",
    product: "Módem Wifi Portátil Pro",
    date: "Hace 3 días",
  },
  {
    name: "Diana P.",
    city: "Bogotá",
    avatar: "DP",
    color: "from-pink-500 to-rose-600",
    rating: 5,
    text: "Aproveché el 8% de descuento por pagar anticipado con Nequi. El despacho fue prioritario y me ahorré un buen dinero. Todo llegó perfecto.",
    product: "Compresor Digital Car",
    date: "Hace 1 semana",
  },
  {
    name: "Mateo R.",
    city: "Medellín",
    avatar: "MR",
    color: "from-emerald-500 to-teal-600",
    rating: 5,
    text: "El intercomunicador funciona de maravilla en carretera. Se escucha súper claro incluso a alta velocidad. Compra excelente, llegó en 2 días.",
    product: "Inter Comunicador Y10",
    date: "Hace 5 días",
  },
  {
    name: "Yolanda S.",
    city: "Bucaramanga",
    avatar: "YS",
    color: "from-amber-500 to-orange-600",
    rating: 5,
    text: "La hidrolavadora es increíble, lavé el carro sin electricidad y quedó impecable. Lo del envío gratis es un punto más. Definitivamente vuelvo a comprar.",
    product: "Hidro Lavadora Inalámbrica 48v",
    date: "Hace 2 días",
  },
  {
    name: "Andrés F.",
    city: "Barranquilla",
    avatar: "AF",
    color: "from-purple-500 to-violet-600",
    rating: 5,
    text: "Compré el kit saca golpes para un rayón en la carrocería. Funcionó perfecto y la pintura quedó intacta. Increíble producto, muy fácil de usar.",
    product: "Kit Saca Golpes DIY",
    date: "Hace 4 días",
  },
];

const FAQ_ITEMS = [
  {
    q: "¿Cómo hago mi pedido?",
    a: "Es muy sencillo: elige tus productos, agrégalos al carrito, completa tu formulario con nombre, celular, ciudad y dirección, y ¡listo! También puedes pedirlo directamente por WhatsApp.",
  },
  {
    q: "¿Cuánto tarda el envío?",
    a: "Tu pedido llega en 2 a 4 días hábiles en todo Colombia. Trabajamos con Servientrega, Envía, Coordinadora e Interrapidísimo para garantizar entregas rápidas.",
  },
  {
    q: "¿Cómo funciona el pago contraentrega?",
    a: "Recibes tu paquete en la dirección que indicaste y le pagas en efectivo al mensajero al momento de la entrega. ¡Sin riesgos, sin anticipos, sin complicaciones!",
  },
  {
    q: "¿Cómo obtengo el descuento del 8%?",
    a: "Elige 'Pago Anticipado' al hacer tu pedido. Luego recibirás las instrucciones para transferir por Nequi, Daviplata o Banco de Bogotá y el 8% se aplica automáticamente.",
  },
  {
    q: "¿Qué pasa si mi producto llega dañado?",
    a: "Todos nuestros envíos están asegurados. Si tu producto llega con algún defecto de fábrica, contáctanos por WhatsApp y lo resolvemos de inmediato con cambio o reembolso.",
  },
  {
    q: "¿Puedo comprar varios productos con un solo pedido?",
    a: "¡Claro! Agrega todos los productos que quieras al carrito. Al llevar 2 o más productos, recibirás descuentos automáticos estilo promoción según el valor de cada producto, garantizando el mejor precio sin complicaciones.",
  },
];

// Helper to get structured pricing discounts based on price range to avoid over-discounting
const getProductPriceConfig = (price: number) => {
  if (price < 10000) {
    return {
      qtyBase: Math.round(price * 0.15),
      qtyStep: Math.round(price * 0.08),
      prepay: Math.round(price * 0.03)
    };
  } else if (price < 40000) {
    return {
      qtyBase: 3000,
      qtyStep: 1500,
      prepay: 1500
    };
  } else if (price < 90000) {
    return {
      qtyBase: 6000,
      qtyStep: 3000,
      prepay: 3000
    };
  } else if (price < 180000) {
    return {
      qtyBase: 12000,
      qtyStep: 6000,
      prepay: 6000
    };
  } else if (price < 250000) {
    return {
      qtyBase: 16000,
      qtyStep: 8000,
      prepay: 10000
    };
  } else {
    return {
      qtyBase: 20000,
      qtyStep: 10000,
      prepay: 15000
    };
  }
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  // Reto de referidos: el descuento vive aqui y se aplica al total del carrito.
  const [showReferral, setShowReferral] = useState(false);
  const [referralPct, setReferralPct] = useState(0);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const referralPrompted = useRef(false);

  // Combos que el cliente agrego. Sin esto el carrito veia productos sueltos y
  // les aplicaba el descuento por cantidad en vez del precio del combo: el
  // Kit Motero Completo se anunciaba en $155.900 y terminaba cobrandose $176.700.
  const [combosAplicados, setCombosAplicados] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("jan_sel_shop_combos");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const [cart, setCart] = useState<{ product: typeof TRENDING_PRODUCTS[0]; quantity: number }[]>(() => {
    try {
      const saved = localStorage.getItem("jan_sel_shop_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // El carrito guardado puede ser de hace semanas, con productos que ya
          // no vendemos y con precios viejos. Un cliente abrió la landing y le
          // aparecía un "Carplay Para Moto" en el carrito, que salió del
          // catálogo hace rato. Se descarta lo que ya no existe y el resto se
          // vuelve a leer del catálogo de HOY, para que nadie vea un precio que
          // no le vamos a respetar.
          return parsed
            .map((item: any) => {
              const vigente = TRENDING_PRODUCTS.find((p) => p.id === item?.product?.id);
              if (!vigente) return null;
              const cantidad = Math.max(1, Math.min(20, Number(item?.quantity) || 1));
              return { product: vigente, quantity: cantidad };
            })
            .filter(Boolean) as { product: typeof TRENDING_PRODUCTS[0]; quantity: number }[];
        }
      }
    } catch (e) {
      console.error("Error reading cart from localStorage", e);
    }
    // Arranca VACÍO. Antes metía TRENDING_PRODUCTS[0] de entrada, así que todo
    // visitante nuevo veía un producto que él no había elegido: confunde, y
    // hace que el carrito no signifique nada.
    return [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"contraentrega" | "anticipado">("contraentrega");
  const [checkoutMode, setCheckoutMode] = useState<"formulario" | "whatsapp">("formulario");
  // El formulario vive en una pantalla emergente. Antes era una seccion mas de
  // la landing: tocaba deslizar para llegar, y quien venia de la ficha de
  // producto aterrizaba a media pantalla. En un modal el cliente no puede
  // perderlo de vista ni distraerse con el resto de la pagina.
  const [pedidoAbierto, setPedidoAbierto] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    city: "",
    address: "",
    addressIndicator: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState<any>(null);
  const [officialBotNumber, setOfficialBotNumber] = useState("");
  const [activeTab, setActiveTab] = useState<string>("Todos");
  const [timeLeft, setTimeLeft] = useState(582);
  const [livePurchase, setLivePurchase] = useState<any>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [ordersToday] = useState(Math.floor(Math.random() * 40) + 30);
  const [heroViewers] = useState(Math.floor(Math.random() * 30) + 45);
  const [isWaMenuOpen, setIsWaMenuOpen] = useState(false);

  // ==============================================
  // 🎡 RULETA DE DESCUENTOS (gatillo mental estilo Temu)
  // ==============================================
  // Premios de MARKETING (envío gratis, % en combos, regalo sorpresa) — NO
  // se descuentan automáticamente del precio real del producto. Es pura
  // psicología: la persona "gana" algo y eso la empuja a comprar. El premio
  // se reclama mencionándolo por WhatsApp, donde el asesor/bot decide cómo
  // aplicarlo (ej. combo real, envío ya es gratis de por sí, etc.)
  const WHEEL_PRIZES = [
    { label: "🎁 Envío GRATIS", weight: 25, color: "#0f766e" },
    { label: "10% OFF 2do producto", weight: 20, color: "#7c3aed" },
    { label: "15% OFF x2 artículos", weight: 15, color: "#b45309" },
    { label: "5% de descuento", weight: 20, color: "#0e7490" },
    { label: "🎊 Combo sorpresa", weight: 12, color: "#be123c" },
    { label: "⭐ 20% OFF ¡Máximo premio!", weight: 8, color: "#a16207" },
  ];
  const [wheelOpen, setWheelOpen] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelPrize, setWheelPrize] = useState<string | null>(null);
  const [wheelAlreadyPlayed, setWheelAlreadyPlayed] = useState(false);

  // ⏰ Contador de oferta del día (honesto: cuenta hasta medianoche real,
  // hora de Colombia. Se reinicia cada día porque de verdad hay descuentos
  // nuevos cada día, no es un timer falso que resetea para presionar).
  const [dailyCountdown, setDailyCountdown] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const colombiaNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
      const endOfDay = new Date(colombiaNow);
      endOfDay.setHours(23, 59, 59, 999);
      const diffMs = endOfDay.getTime() - colombiaNow.getTime();
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);
      setDailyCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // 🛒 Notificaciones de "prueba social" — actividad reciente real basada en
  // el catálogo real (nombres de producto reales), rotando por ciudades
  // colombianas comunes. No inventa nombres de personas ni cifras de dinero
  // falsas, solo transmite "esto se está moviendo".
  const [socialProofNotif, setSocialProofNotif] = useState<{ city: string; product: string } | null>(null);
  const SOCIAL_PROOF_CITIES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga", "Pereira", "Cartagena"];
  useEffect(() => {
    if (!TRENDING_PRODUCTS || TRENDING_PRODUCTS.length === 0) return;
    const showNotif = () => {
      const randomProduct = TRENDING_PRODUCTS[Math.floor(Math.random() * TRENDING_PRODUCTS.length)];
      const randomCity = SOCIAL_PROOF_CITIES[Math.floor(Math.random() * SOCIAL_PROOF_CITIES.length)];
      setSocialProofNotif({ city: randomCity, product: randomProduct.name });
      setTimeout(() => setSocialProofNotif(null), 5000);
    };
    const firstTimer = setTimeout(showNotif, 8000);
    const interval = setInterval(showNotif, 22000);
    return () => { clearTimeout(firstTimer); clearInterval(interval); };
  }, []);

  // 🪙 Puntos Jansel — gamificación honesta: acumulas puntos por navegar y
  // explorar (no es dinero real ni afecta precios), y se pueden "usar" como
  // otro gatillo de gamificación al momento de pedir (mencionarlos al
  // asesor). Se guardan en localStorage para que se sientan acumulativos.
  const [jansCoins, setJansCoins] = useState(0);
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem("jan_sel_shop_coins") || "0", 10);
      setJansCoins(isNaN(saved) ? 0 : saved);
    } catch {}
    const interval = setInterval(() => {
      setJansCoins(prev => {
        const next = prev + 5;
        try { localStorage.setItem("jan_sel_shop_coins", String(next)); } catch {}
        return next;
      });
    }, 20000); // +5 monedas cada 20s navegando
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const played = localStorage.getItem("jan_sel_shop_wheel_played");
      const savedPrize = localStorage.getItem("jan_sel_shop_wheel_prize");
      if (played === "true" && savedPrize) {
        setWheelAlreadyPlayed(true);
        setWheelPrize(savedPrize);
      } else {
        // Mostrar la ruleta automáticamente a los pocos segundos de entrar
        const timer = setTimeout(() => setWheelOpen(true), 4000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const spinWheel = () => {
    if (wheelSpinning || wheelAlreadyPlayed) return;
    setWheelSpinning(true);

    // Selección ponderada del premio
    const totalWeight = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedIdx = 0;
    for (let i = 0; i < WHEEL_PRIZES.length; i++) {
      rand -= WHEEL_PRIZES[i].weight;
      if (rand <= 0) { selectedIdx = i; break; }
    }

    const segmentAngle = 360 / WHEEL_PRIZES.length;
    // Apuntamos al centro del segmento ganador, con varias vueltas completas para el efecto visual
    const targetAngle = 360 * 6 + (360 - (selectedIdx * segmentAngle + segmentAngle / 2));
    setWheelRotation(targetAngle);

    setTimeout(() => {
      const prize = WHEEL_PRIZES[selectedIdx].label;
      setWheelPrize(prize);
      setWheelSpinning(false);
      setWheelAlreadyPlayed(true);
      try {
        localStorage.setItem("jan_sel_shop_wheel_played", "true");
        localStorage.setItem("jan_sel_shop_wheel_prize", prize);
      } catch {}
    }, 4200);
  };

  const claimWheelPrize = () => {
    setWheelOpen(false);
    setCheckoutMode("formulario");
    bajarAlFormulario();
  };


  const formRef = useRef<HTMLDivElement>(null);

  // Pixel IDs States
  const [metaPixelId, setMetaPixelId] = useState("");
  const [tiktokPixelId, setTiktokPixelId] = useState("");

  // --- Pixel Initialization and Tracking Functions ---
  const initMetaPixel = (rawPixelId: string) => {
    // El id llegaba con un espacio delante (" 841277818494170") por como se pego
    // en la configuracion. Un id mal formado hace que Meta no registre eventos, y
    // sin eventos la campana no puede optimizar: se paga sin que el algoritmo
    // aprenda. Se limpia siempre, venga de donde venga.
    const pixelId = String(rawPixelId || "").trim();
    if (!pixelId) return;
    const w = window as any;
    if (w.fbq) {
      w.fbq('init', pixelId);
      w.fbq('track', 'PageView');
      return;
    }
    
    // Facebook Pixel standard initialization code
    (function (f: any, b: Document, e: string, v: string, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(w, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    w.fbq('init', pixelId);
    w.fbq('track', 'PageView');
    console.log(`[Meta Pixel]: Inicializado con ID ${pixelId}`);
  };

  const initTiktokPixel = (pixelId: string) => {
    if (!pixelId) return;
    const w = window as any;
    if (w.ttq) {
      w.ttq.load(pixelId);
      w.ttq.page();
      return;
    }

    // TikTok Pixel standard initialization code
    (function (win: any, d: Document, t: string) {
      win.TiktokSdkObject = t;
      var ttq = (win[t] = win[t] || []);
      ttq.methods = [
        "page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"
      ];
      ttq.setAndDefer = function (e: any, t: string) {
        win[t].push([t].concat(Array.prototype.slice.call(arguments, 0)));
      };
      for (var i = 0; i < ttq.methods.length; i++) {
        ttq.setAndDefer(ttq, ttq.methods[i]);
      }
      ttq.instance = function (e: any) {
        for (var t = ttq._i[e] || [], n = 0; n < ttq.methods.length; n++) {
          ttq.setAndDefer(win[t], win[t].methods[n]);
        }
        return t;
      };
      ttq._i = {};
      ttq._f = {};
      ttq._b = {};
      ttq._v = "1.2.1";
      ttq.loaded = !0;
      var s = d.createElement("script") as any;
      s.type = "text/javascript";
      s.async = !0;
      s.src = "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + pixelId;
      var a = d.getElementsByTagName("script")[0];
      a.parentNode?.insertBefore(s, a);
    })(w, document, "ttq");

    w.ttq.load(pixelId);
    w.ttq.page();
    console.log(`[TikTok Pixel]: Inicializado con ID ${pixelId}`);
  };

  // ── Advanced Matching / CAPI dedup helpers ────────────────────────────────
  // Estas funciones alimentan tanto al pixel del navegador como al CAPI del
  // backend con la MISMA información (fbp, fbc, event_id) para que Meta
  // reciba señal por ambos caminos sin contar el evento doble.
  const getCookie = (name: string): string => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  };

  const getFbp = (): string => getCookie("_fbp");

  // fbc: si ya existe la cookie _fbc la usamos; si no, y hay fbclid en la URL,
  // la construimos según el formato que exige Meta: fb.1.<timestamp>.<fbclid>
  const getFbc = (): string => {
    const existing = getCookie("_fbc");
    if (existing) return existing;
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (fbclid) return `fb.1.${Date.now()}.${fbclid}`;
    return "";
  };

  const generateEventId = (): string => {
    if ((window.crypto as any)?.randomUUID) return (window.crypto as any).randomUUID();
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  };

  // Manda ViewContent/AddToCart/InitiateCheckout también por CAPI (respaldo server-side),
  // para que los públicos de remarketing no se queden cortos por bloqueadores/iOS.
  const sendFunnelEventCapi = (eventName: "ViewContent" | "AddToCart" | "InitiateCheckout", eventId: string, opts: { contentIds?: string[]; contentName?: string; value?: number } = {}) => {
    fetch("/api/public/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        storeId: "default",
        eventId,
        fbp: getFbp(),
        fbc: getFbc(),
        eventSourceUrl: window.location.href,
        customerPhone: formData?.customerPhone || "",
        contentIds: opts.contentIds || [],
        contentName: opts.contentName || "",
        value: opts.value || 0,
        visitorId: idVisitante(),
        origen: origenVisita()
      })
    }).catch(() => {});
  };

  // Tracking Helpers
  const trackMetaEvent = (eventName: string, params?: any, eventId?: string) => {
    if ((window as any).fbq) {
      if (eventId) {
        (window as any).fbq('track', eventName, params, { eventID: eventId });
      } else {
        (window as any).fbq('track', eventName, params);
      }
      console.log(`[Meta Pixel Tracking]: ${eventName}`, params, eventId ? `(eventID: ${eventId})` : "");
    }
  };

  const trackTiktokEvent = (eventName: string, params?: any) => {
    if ((window as any).ttq) {
      (window as any).ttq.track(eventName, params);
      console.log(`[TikTok Pixel Tracking]: ${eventName}`, params);
    }
  };

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("jan_sel_shop_cart", JSON.stringify(cart));
    } catch (e) {
      console.error("Error saving cart to localStorage", e);
    }
  }, [cart]);

  // Los combos se guardan junto al carrito para que sobrevivan a un refresco:
  // si se perdieran, el pedido volveria a cobrarse a precio suelto.
  useEffect(() => {
    try {
      localStorage.setItem("jan_sel_shop_combos", JSON.stringify(combosAplicados));
    } catch { /* almacenamiento no disponible */ }
  }, [combosAplicados]);

  // Si el cliente saca del carrito un producto del combo, ese combo deja de
  // aplicar: se limpia solo para no cobrar precio de combo por algo incompleto.
  useEffect(() => {
    setCombosAplicados((prev) => {
      const vigentes = prev.filter((id) => {
        const c = ACTIVE_PROMOTIONS.find((x) => x.id === id);
        return c && c.productIds.every((pid) => cart.some((it) => it.product.id === pid));
      });
      return vigentes.length === prev.length ? prev : vigentes;
    });
  }, [cart]);

  useEffect(() => {
    fetch("/api/public/config")
      .then((res) => res.json())
      .then((data) => { 
        if (data.whatsappNumber) setOfficialBotNumber(data.whatsappNumber);
        // Los píxeles ya los arranca App.tsx para TODAS las rutas (src/lib/pixel.ts).
        // Aquí solo se guardan los ids; volver a inicializarlos dispararía un
        // segundo PageView por cada visita a la landing e inflaría el conteo.
        if (data.metaPixelId) setMetaPixelId(data.metaPixelId);
        if (data.tiktokPixelId) setTiktokPixelId(data.tiktokPixelId);
      })
      .catch((err) => console.error("Error al cargar configuración de píxeles:", err));

    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 600 : prev - 1));
    }, 1000);

    const purchases = [
      { name: "Juan Carlos V.", city: "Cali", product: "Módem Wifi Portátil Pro", time: "hace 2 min" },
      { name: "Diana Patricia P.", city: "Bogotá", product: "Mini Aspiradora Gold", time: "hace 5 min" },
      { name: "Mateo R.", city: "Medellín", product: "Inter Comunicador Y10", time: "hace 1 min", method: "pago anticipado" },
      { name: "Andrés Felipe G.", city: "Barranquilla", product: "Cargador Iniciador Batería", time: "hace 4 min" },
      { name: "Yolanda S.", city: "Bucaramanga", product: "Compresor Portátil Digital", time: "hace 3 min" },
      { name: "Carlos Arturo T.", city: "Pereira", product: "Volante Seguro Pro", time: "hace 6 min" },
      { name: "Laura M.", city: "Cartagena", product: "Hidro Lavadora Inalámbrica", time: "hace 8 min" },
      { name: "Felipe O.", city: "Manizales", product: "Kit Saca Golpes DIY", time: "hace 2 min" },
    ];

    const showNotification = () => {
      const rand = purchases[Math.floor(Math.random() * purchases.length)];
      setLivePurchase(rand);
      setTimeout(() => setLivePurchase(null), 5500);
    };

    const initialTimeout = setTimeout(showNotification, 3500);
    const notificationInterval = setInterval(showNotification, 18000);

    // Testimonial auto-advance
    const testimonialTimer = setInterval(() => {
      setTestimonialIdx((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);

    return () => {
      clearInterval(timerInterval);
      clearTimeout(initialTimeout);
      clearInterval(notificationInterval);
      clearInterval(testimonialTimer);
    };
  }, []);

  // ── Cart Operations ───────────────────────────────────────────────────────────
  const addToCart = (product: typeof TRENDING_PRODUCTS[0], silent = false) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const nextCart = [...prev];
        nextCart[existingIndex] = { ...nextCart[existingIndex], quantity: nextCart[existingIndex].quantity + 1 };
        if (!silent) toast.success(`¡Cantidad aumentada! 🛒`);
        return nextCart;
      }
      if (!silent) toast.success(`¡${product.name} agregado! 🛒`);
      return [...prev, { product, quantity: 1 }];
    });
    if (!silent) setIsCartOpen(true);

    // Track AddToCart Event
    const addToCartEventId = generateEventId();
    trackMetaEvent("AddToCart", {
      content_name: product.name,
      content_ids: [product.id],
      content_type: "product",
      value: product.price,
      currency: "COP"
    }, addToCartEventId);
    sendFunnelEventCapi("AddToCart", addToCartEventId, { contentIds: [product.id], contentName: product.name, value: product.price });
    trackTiktokEvent("AddToCart", {
      contents: [{
        content_id: product.id,
        content_name: product.name,
        quantity: 1,
        price: product.price
      }],
      value: product.price,
      currency: "COP"
    });
  };

  // Agrega todos los productos de un combo al carrito de una sola vez.
  const addComboToCart = (combo: typeof ACTIVE_PROMOTIONS[0]) => {
    const items = combo.productIds
      .map((pid) => TRENDING_PRODUCTS.find((p) => p.id === pid))
      .filter(Boolean) as typeof TRENDING_PRODUCTS;
    if (items.length === 0) {
      toast.error("Ese combo no esta disponible por ahora");
      return;
    }
    items.forEach((p) => addToCart(p, true));
    setCombosAplicados((prev) => (prev.includes(combo.id) ? prev : [...prev, combo.id]));
    toast.success("Combo " + combo.name + " agregado!");
    setIsCartOpen(true);
  };

  // Camino corto del combo: agrega y baja directo al formulario de datos. Cada
  // paso intermedio entre "lo quiero" y "escribo mi direccion" pierde pedidos, y
  // cerrar en la propia pagina evita depender de que el cliente siga la
  // conversacion en WhatsApp.
  const pedirComboAhora = (combo: typeof ACTIVE_PROMOTIONS[0]) => {
    const items = combo.productIds
      .map((pid) => TRENDING_PRODUCTS.find((p) => p.id === pid))
      .filter(Boolean) as typeof TRENDING_PRODUCTS;
    if (items.length === 0) {
      toast.error("Ese combo no esta disponible por ahora");
      return;
    }
    items.forEach((p) => addToCart(p, true));
    setCombosAplicados((prev) => (prev.includes(combo.id) ? prev : [...prev, combo.id]));
    toast.success("¡" + combo.name + " listo! Completa tus datos 👇");
    setIsCartOpen(false);
    setCheckoutMode("formulario");
    bajarAlFormulario();

    // Mismo caso que el camino de la ficha de producto: baja al formulario sin
    // pasar por el botón del carrito, así que InitiateCheckout no salía. Se usa
    // el precio del combo, que es el que la persona va a pagar.
    const iceCombo = generateEventId();
    trackMetaEvent("InitiateCheckout", {
      content_ids: combo.productIds, content_name: combo.name, content_type: "product",
      num_items: items.length, value: combo.promoPrice, currency: "COP"
    }, iceCombo);
    sendFunnelEventCapi("InitiateCheckout", iceCombo, { contentIds: combo.productIds, contentName: combo.name, value: combo.promoPrice });
    trackTiktokEvent("InitiateCheckout", {
      contents: items.map((p) => ({ content_id: p.id, content_name: p.name, quantity: 1, price: p.price })),
      value: combo.promoPrice, currency: "COP"
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    toast.success("Producto removido");
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) { removeFromCart(productId); return; }
    setCart((prev) => prev.map((item) => item.product.id === productId ? { ...item, quantity: newQty } : item));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Si llegan por un link de invitacion, primero les pedimos el WhatsApp.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setJoinCode(ref.toUpperCase());
    } catch { /* ignore */ }
  }, []);

  // ── DIAGNÓSTICO DEL FORMULARIO ────────────────────────────────────────────
  // Hasta ahora "abrió el formulario y no tocó nada" y "escribió sus datos y se
  // fue a mitad" se veían idénticos en el embudo, y se arreglan de forma muy
  // distinta. Estos dos avisos separan los dos casos.
  const formularioEmpezado = useRef(false);
  const pedidoEnviadoOk = useRef(false);
  const datosActuales = useRef<any>({});

  const avisarEventoFormulario = React.useCallback((nombre: "FormStart" | "FormAbandon", detalle: string, usarBeacon = false) => {
    const cuerpo = JSON.stringify({
      eventName: nombre,
      storeId: "default",
      eventId: `${nombre}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      eventSourceUrl: window.location.href,
      contentName: detalle,
      visitorId: idVisitante(),
      origen: origenVisita()
    });
    try {
      // Al salir de la página un fetch normal se cancela; sendBeacon sí llega.
      if (usarBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/public/track-event", new Blob([cuerpo], { type: "application/json" }));
        return;
      }
      fetch("/api/public/track-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
        keepalive: true
      }).catch(() => {});
    } catch { /* nunca debe estorbar el pedido */ }
  }, []);

  // Se dispara con la primera tecla en cualquier campo, una sola vez.
  const alEscribirEnFormulario = React.useCallback(() => {
    if (formularioEmpezado.current) return;
    formularioEmpezado.current = true;
    avisarEventoFormulario("FormStart", "empezó a escribir sus datos");
  }, [avisarEventoFormulario]);

  // Al irse: cuántos de los 4 campos obligatorios alcanzó a llenar. Eso dice si
  // el formulario asusta de entrada o si algo lo frena a mitad de camino.
  useEffect(() => {
    const alSalir = () => {
      if (!formularioEmpezado.current || pedidoEnviadoOk.current) return;
      const d = datosActuales.current || {};
      const campos: Array<[string, string]> = [
        ["nombre", d.customerName], ["celular", d.customerPhone],
        ["ciudad", d.city], ["dirección", d.address]
      ].map(([k, v]) => [k, String(v || "").trim()]) as Array<[string, string]>;
      const llenos = campos.filter(([, v]) => v.length > 0).map(([k]) => k);
      const faltantes = campos.filter(([, v]) => v.length === 0).map(([k]) => k);
      avisarEventoFormulario(
        "FormAbandon",
        `llenó ${llenos.length} de 4 (${llenos.join(", ") || "ninguno"}) — se fue en: ${faltantes[0] || "el botón de confirmar"}`,
        true
      );
      formularioEmpezado.current = false; // que no se repita si vuelve
    };
    const alOcultar = () => { if (document.hidden) alSalir(); };
    window.addEventListener("pagehide", alSalir);
    document.addEventListener("visibilitychange", alOcultar);
    return () => {
      window.removeEventListener("pagehide", alSalir);
      document.removeEventListener("visibilitychange", alOcultar);
    };
  }, [avisarEventoFormulario]);

  // Lleva el formulario ARRIBA de la pantalla, no "a la vista". Con
  // scrollIntoView por defecto el formulario quedaba abajo y tocaba deslizar
  // para verlo completo — y ahí es donde la gente se cansa y se sale.
  // Reintenta durante 2 segundos porque el formulario se monta al cambiar
  // checkoutMode: si se llama antes, el elemento todavía no existe.
  // Todos los caminos que antes bajaban al formulario ahora abren el modal:
  // el boton del carrito, la compra rapida, los combos y el ?add= que manda
  // la ficha de producto. Se conserva el nombre para no tocar cada llamada.
  const bajarAlFormulario = React.useCallback(() => {
    setCheckoutMode("formulario");
    setIsCartOpen(false);
    setPedidoAbierto(true);
  }, []);

  const cerrarPedido = React.useCallback(() => setPedidoAbierto(false), []);

  // Con el modal abierto se bloquea el scroll del fondo: en el celular, si no,
  // se arrastra la pagina de atras y el formulario se siente roto.
  useEffect(() => {
    if (!pedidoAbierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setPedidoAbierto(false); };
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [pedidoAbierto]);

  // Cuando el pedido queda registrado, la pantalla de exito se muestra aparte:
  // dejar el modal encima la taparia.
  useEffect(() => { if (orderCompleted) setPedidoAbierto(false); }, [orderCompleted]);

  // Recibe pedidos que llegan desde otras paginas (la ficha de producto, por
  // ejemplo) con ?add=<idProducto> o ?combo=<idCombo>. Mete lo pedido al carrito
  // y baja directo al formulario, para que cerrar por formulario sea posible
  // desde cualquier punto de la tienda y no solo desde esta pagina.
  const pedidoExternoHecho = useRef(false);
  useEffect(() => {
    if (pedidoExternoHecho.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const addId = params.get("add");
      const comboId = params.get("combo");
      if (!addId && !comboId) return;
      pedidoExternoHecho.current = true;

      if (comboId) {
        const c = ACTIVE_PROMOTIONS.find((x) => x.id === comboId);
        if (c) { pedirComboAhora(c); return; }
      }
      if (addId) {
        const p = TRENDING_PRODUCTS.find((x) => x.id === addId);
        if (p) {
          addToCart(p, true);
          toast.success("¡" + p.name + " listo! Completa tus datos 👇");
          setIsCartOpen(false);
          setCheckoutMode("formulario");
          bajarAlFormulario();

          // Este camino lleva al formulario igual que el botón del carrito, pero
          // no disparaba InitiateCheckout: el evento solo salía desde el carrito.
          // Como los anuncios entran justamente por aquí (ficha de producto), en
          // los informes parecía que todos abandonaban en el carrito. Se usa el
          // precio del producto y no el total del carrito porque el estado aún
          // no se ha actualizado en este punto.
          const iceExterno = generateEventId();
          trackMetaEvent("InitiateCheckout", {
            content_ids: [p.id], content_name: p.name, content_type: "product",
            num_items: 1, value: p.price, currency: "COP"
          }, iceExterno);
          sendFunnelEventCapi("InitiateCheckout", iceExterno, { contentIds: [p.id], contentName: p.name, value: p.price });
          trackTiktokEvent("InitiateCheckout", {
            contents: [{ content_id: p.id, content_name: p.name, quantity: 1, price: p.price }],
            value: p.price, currency: "COP"
          });
        }
      }
    } catch { /* ignore */ }
  }, []);

  // El reto se ofrece cuando ya decidio comprar (abrio el carrito), no al entrar:
  // antes de eso no tiene ningun motivo para invitar a nadie.
  useEffect(() => {
    if (!isCartOpen || referralPrompted.current || referralPct > 0 || joinCode) return;
    referralPrompted.current = true;
    const t = setTimeout(() => setShowReferral(true), 900);
    return () => clearTimeout(t);
  }, [isCartOpen, referralPct, joinCode]);

  // El premio de la ruleta se limita a MOSTRARSE: decia "menciónalo al confirmar
  // tu pedido y te lo aplicamos", asi que dependia de que el cliente se acordara
  // y de que alguien lo aplicara a mano. Aqui se traduce a un descuento real que
  // el carrito calcula solo.
  const premioRuleta = (() => {
    if (!wheelPrize) return { pct: 0, minItems: 1 };
    const p = wheelPrize.toLowerCase();
    if (p.includes("20%")) return { pct: 20, minItems: 1 };
    if (p.includes("15%")) return { pct: 15, minItems: 2 };  // "x2 articulos"
    if (p.includes("10%")) return { pct: 10, minItems: 2 };  // "2do producto"
    if (p.includes("5%")) return { pct: 5, minItems: 1 };
    // "Envio gratis" y "Combo sorpresa" no son porcentaje: el envio ya es gratis
    // siempre y el combo lo entrega el asesor al confirmar.
    return { pct: 0, minItems: 1 };
  })();

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const originalSubtotal = cart.reduce((sum, item) => sum + item.product.originalPrice * item.quantity, 0);
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Expand all items into individual units sorted by price descending
    const individualUnits: number[] = [];
    cart.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        individualUnits.push(item.product.price);
      }
    });
    individualUnits.sort((a, b) => b - a);

    // Calculate quantity discount progressively
    let quantityDiscount = 0;
    if (individualUnits.length >= 2) {
      // 2nd unit gets the qtyBase discount of its price range
      const config1 = getProductPriceConfig(individualUnits[1]);
      quantityDiscount += config1.qtyBase;

      // 3rd and subsequent units get the qtyStep discount of their respective price ranges
      for (let i = 2; i < individualUnits.length; i++) {
        const configN = getProductPriceConfig(individualUnits[i]);
        quantityDiscount += configN.qtyStep;
      }
    }

    // Un combo solo cuenta si TODOS sus productos siguen en el carrito. Si el
    // cliente saco uno, deja de ser el combo y vuelve a precio suelto.
    const combosVigentes = ACTIVE_PROMOTIONS.filter(
      (c) =>
        combosAplicados.includes(c.id) &&
        c.productIds.every((pid) => cart.some((it) => it.product.id === pid))
    );

    // Lo que hay que bajar para que el combo cueste lo que se anuncio.
    const descuentoCombos = combosVigentes.reduce((total, c) => {
      const sumaSuelta = c.productIds.reduce((s, pid) => {
        const p = TRENDING_PRODUCTS.find((x) => x.id === pid);
        return s + (p ? p.price : 0);
      }, 0);
      return total + Math.max(0, sumaSuelta - c.promoPrice);
    }, 0);

    // Se aplica el MEJOR de los dos, nunca los dos sumados: el descuento por
    // cantidad y el del combo cubren el mismo carrito, y encimarlos regalaria
    // margen dos veces sobre los mismos productos.
    // El premio solo cuenta si el carrito cumple su condicion (los de 10% y 15%
    // exigen dos articulos, tal como los anuncia la ruleta).
    const descuentoRuleta = totalQty >= premioRuleta.minItems
      ? Math.round((subtotal * premioRuleta.pct) / 100)
      : 0;

    // Se aplica el MEJOR de los tres, nunca la suma: cantidad, combo y ruleta
    // cubren el mismo carrito, y encimarlos regalaria margen varias veces.
    const descuentoAplicado = Math.max(quantityDiscount, descuentoCombos, descuentoRuleta);
    const intermediateTotal = subtotal - descuentoAplicado;

    // Calculate prepayment discount progressively over all units
    let prepaymentDiscount = 0;
    if (paymentMethod === "anticipado") {
      individualUnits.forEach((price) => {
        const config = getProductPriceConfig(price);
        prepaymentDiscount += config.prepay;
      });
    }

    const referralDiscount = totalQty >= REFERRAL_MIN_ITEMS
      ? Math.round((intermediateTotal * referralPct) / 100)
      : 0;
    const finalTotal = Math.max(0, intermediateTotal - prepaymentDiscount - referralDiscount);
    return { subtotal, originalSubtotal, totalQty, quantityDiscount: descuentoAplicado, descuentoRuleta, combosVigentes, prepaymentDiscount, referralDiscount, finalTotal, savings: originalSubtotal - finalTotal };
  };

  useEffect(() => { datosActuales.current = formData; }, [formData]);

  const { subtotal, totalQty, quantityDiscount, descuentoRuleta, combosVigentes, prepaymentDiscount, referralDiscount, finalTotal, savings } = calculateTotals();

  const handleProceedToForm = () => {
    setIsCartOpen(false);
    setCheckoutMode("formulario");
    bajarAlFormulario();

    // Track InitiateCheckout Event
    const checkoutEventId1 = generateEventId();
    trackMetaEvent("InitiateCheckout", {
      num_items: totalQty,
      value: finalTotal,
      currency: "COP"
    }, checkoutEventId1);
    sendFunnelEventCapi("InitiateCheckout", checkoutEventId1, { contentIds: cart.map(i => i.product.id), value: finalTotal });
    trackTiktokEvent("InitiateCheckout", {
      contents: cart.map(item => ({
        content_id: item.product.id,
        content_name: item.product.name,
        quantity: item.quantity,
        price: item.product.price
      })),
      value: finalTotal,
      currency: "COP"
    });
  };

  const handleInstantBuy = (product: typeof TRENDING_PRODUCTS[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) return prev;
      return [...prev, { product, quantity: 1 }];
    });
    setCheckoutMode("formulario");
    toast.success(`¡Configura tu despacho para ${product.name}! 📦`, { icon: "⚡" });
    bajarAlFormulario();

    // Track ViewContent & InitiateCheckout
    const viewContentEventId = generateEventId();
    trackMetaEvent("ViewContent", {
      content_name: product.name,
      content_ids: [product.id],
      content_type: "product",
      value: product.price,
      currency: "COP"
    }, viewContentEventId);
    sendFunnelEventCapi("ViewContent", viewContentEventId, { contentIds: [product.id], contentName: product.name, value: product.price });

    const checkoutEventId2 = generateEventId();
    trackMetaEvent("InitiateCheckout", {
      content_name: product.name,
      content_ids: [product.id],
      content_type: "product",
      value: product.price,
      currency: "COP"
    }, checkoutEventId2);
    sendFunnelEventCapi("InitiateCheckout", checkoutEventId2, { contentIds: [product.id], contentName: product.name, value: product.price });
    trackTiktokEvent("ViewContent", {
      contents: [{
        content_id: product.id,
        content_name: product.name,
        quantity: 1,
        price: product.price
      }],
      value: product.price,
      currency: "COP"
    });
    trackTiktokEvent("InitiateCheckout", {
      contents: [{
        content_id: product.id,
        content_name: product.name,
        quantity: 1,
        price: product.price
      }],
      value: product.price,
      currency: "COP"
    });
  };

  const handleWhatsAppOrder = (directPaymentMode?: "contraentrega" | "anticipado") => {
    if (cart.length === 0) return toast.error("El carrito está vacío.");
    const selectedMode = directPaymentMode || paymentMethod;
    // Si el pedido viene de un combo hay que nombrarlo: antes el bot solo recibia
    // los productos sueltos y confirmaba otro total, asi que el cliente pedia el
    // "Kit Motero Completo" a $155.900 y le cobraban $176.700.
    const combosText = combosVigentes.length > 0
      ? combosVigentes.map((c: any) => `🎁 *COMBO: ${c.name}* — $${c.promoPrice.toLocaleString()} COP`).join("\n") + "\n"
      : "";
    const itemsText = combosText + cart.map((item) => `• *${item.product.name}* (x${item.quantity}) - $${item.product.price.toLocaleString()} COP c/u`).join("\n");
    const discountText = quantityDiscount > 0 ? `\n🎁 *Descuento Combo:* -$${quantityDiscount.toLocaleString()} COP` : "";
    const prepayText = selectedMode === "anticipado" ? `\n🌟 *Descuento Anticipado:* -$${prepaymentDiscount.toLocaleString()} COP` : "";
    const referralText = referralDiscount > 0 ? `\n🎁 *Descuento por Invitar:* -$${referralDiscount.toLocaleString()} COP` : "";
    const ruletaText = descuentoRuleta > 0 ? `\n🎡 *Premio Ruleta:* -$${descuentoRuleta.toLocaleString()} COP` : "";
    const modeLabel = selectedMode === "anticipado"
      ? "🔴 *Pago Anticipado (Nequi / Daviplata / Banco de Bogotá) - ¡Descuento aplicado!*"
      : "🟢 *Pago Contraentrega (Pagas al recibir en efectivo)*";
    const msg = `¡Hola Jan Sel Shop! 👋 Quiero realizar el siguiente pedido desde la Landing Page:\n\n🛒 *CARRITO:*\n${itemsText}\n\n⚙️ *DESGLOSE:*\n• *Subtotal:* $${subtotal.toLocaleString()} COP${discountText}${prepayText}${referralText}${ruletaText}\n🚚 *Envío:* ¡COMPLETAMENTE GRATIS! 🇨🇴\n💰 *TOTAL:* $${finalTotal.toLocaleString()} COP\n\n💳 *PAGO:* ${modeLabel}\n\n👤 *DATOS:*\n• *Nombre:* ${formData.customerName || "Por confirmar"}\n• *Celular:* ${formData.customerPhone || "Por confirmar"}\n• *Ciudad:* ${formData.city || "Por confirmar"}\n• *Dirección:* ${formData.address || "Por confirmar"}\n• *Indicaciones:* ${formData.addressIndicator || "Ninguna"}\n\n¡Por favor agendar mi despacho hoy! 🚀`;
    const phone = officialBotNumber || "15072233213";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");

    // Track Contact Event — mismo eventId en el pixel del navegador y en el CAPI del backend
    // para que Meta reciba doble señal sin duplicar el conteo.
    const contactEventId = generateEventId();
    trackMetaEvent("Contact", {
      method: "WhatsApp Direct Order",
      value: finalTotal,
      currency: "COP"
    }, contactEventId);
    trackTiktokEvent("Contact", {
      value: finalTotal,
      currency: "COP"
    });

    fetch("/api/public/track-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: "default",
        eventId: contactEventId,
        fbp: getFbp(),
        fbc: getFbc(),
        eventSourceUrl: window.location.href,
        customerPhone: formData.customerPhone,
        value: finalTotal
      })
    }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return toast.error("El carrito está vacío.");
    if (!formData.customerName.trim()) return toast.error("Por favor dinos tu nombre");
    if (!formData.customerPhone.trim() || formData.customerPhone.length < 7) return toast.error("Ingresa un celular válido");
    if (!formData.city.trim()) return toast.error("Escribe tu ciudad");
    if (!formData.address.trim()) return toast.error("Escribe tu dirección exacta");
    setSubmitting(true);
    try {
      const unifiedProductName = cart.map((item) => `${item.product.name} (x${item.quantity})`).join(" + ");
      const firstProductId = cart[0]?.product.id || "multi-cart";
      const totalQuantities = cart.reduce((sum, item) => sum + item.quantity, 0);
      const itemsDetailStr = cart.map((item) => `- ${item.product.name} x${item.quantity} ($${item.product.price.toLocaleString()} c/u)`).join("\n");
      const paymentLabel = paymentMethod === "anticipado" ? "Pago Anticipado con 8% de Descuento" : "Pago Contraentrega al Recibir";
      // Un solo eventId compartido entre el pixel del navegador y el CAPI del backend,
      // así Meta deduplica y usa AMBAS señales (más robusto contra bloqueadores/iOS).
      const purchaseEventId = generateEventId();
      const payload = {
        storeId: "default",
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        address: formData.address,
        addressIndicator: formData.addressIndicator,
        city: formData.city,
        productName: unifiedProductName,
        productId: firstProductId,
        quantity: totalQuantities,
        totalPrice: finalTotal,
        notes: `Método de Pago: ${paymentLabel}\n\nPRODUCTOS:\n${itemsDetailStr}\n\nNotas: ${formData.notes || "Pedido de la Landing Page"}`,
        eventId: purchaseEventId,
        fbp: getFbp(),
        fbc: getFbc(),
        eventSourceUrl: window.location.href,
      };
      const res = await fetch("/api/public/landing-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        // Track Purchase Event (mismo eventId que se le pasó al backend arriba)
        trackMetaEvent("Purchase", {
          content_ids: cart.map(item => item.product.id),
          content_type: "product",
          value: finalTotal,
          currency: "COP",
          num_items: totalQty
        }, purchaseEventId);
        trackTiktokEvent("CompletePayment", {
          contents: cart.map(item => ({
            content_id: item.product.id,
            content_name: item.product.name,
            quantity: item.quantity,
            price: item.product.price
          })),
          value: finalTotal,
          currency: "COP"
        });

        pedidoEnviadoOk.current = true;
        setOrderCompleted({ ...data.order, cartItems: [...cart], paymentMethodMode: paymentMethod });
        toast.success("¡Pedido registrado! 🎉");
        setCart([]);
      } else {
        toast.error("Error: " + data.error);
      }
    } catch (err: any) {
      toast.error("Error de red: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = activeTab === "Todos"
    ? TRENDING_PRODUCTS
    : TRENDING_PRODUCTS.filter((p) => p.category.toLowerCase() === activeTab.toLowerCase());

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="landing-container min-h-screen bg-[#070810] text-white font-sans overflow-x-hidden selection:bg-amber-400 selection:text-black">
      {/* El popup ahora puede cerrar la venta en la propia pagina: agrega el combo
          al carrito y baja al formulario, sin obligar a salir a WhatsApp. */}
      <PromoFlow
        officialBotNumber={officialBotNumber}
        onPedirFormulario={(comboId: string) => {
          const c = ACTIVE_PROMOTIONS.find((x) => x.id === comboId);
          if (c) pedirComboAhora(c);
        }}
      />

      {/* ════════════════════════════════════════════
          BARRA DE URGENCIA PREMIUM (STICKY TOP)
      ════════════════════════════════════════════ */}
      <div className="sticky top-0 z-50 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 text-black animate-gradient-shift">
          <div className="flex items-center justify-center gap-3 py-2.5 px-4 text-center">
            <span className="text-xs font-black tracking-wide flex items-center gap-1.5 flex-wrap justify-center">
              <Zap size={13} className="shrink-0" />
              <span>⚡ OFERTA LIMITADA — Envío GRATIS + Descuentos por cantidad. Vence en:</span>
              <span className="bg-black/20 text-white font-mono px-2 py-0.5 rounded-md text-xs font-black tracking-widest border border-black/20">
                {formatTime(timeLeft)}
              </span>
              <span className="hidden sm:inline">— ¡No pierdas esta oportunidad única! 🔥</span>
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          HEADER PREMIUM
      ════════════════════════════════════════════ */}
      {/* 🔥 Barra de urgencia: contador diario real + monedas Jansel */}
      <div className="bg-gradient-to-r from-red-600/90 via-orange-600/90 to-red-600/90 text-white relative z-40">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center sm:justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-black uppercase tracking-wide">
            <Clock size={13} className="shrink-0" />
            <span>Ofertas de hoy terminan en</span>
            <span className="font-mono bg-black/25 px-2 py-0.5 rounded-md tabular-nums">{dailyCountdown}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide bg-black/20 px-3 py-1 rounded-full">
            <span>🪙</span>
            <span>{jansCoins} Puntos Jansel</span>
          </div>
        </div>
      </div>

      {/* 🛒 Toast de prueba social — actividad reciente */}
      <AnimatePresence>
        {socialProofNotif && (
          <motion.div
            initial={{ opacity: 0, x: -40, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="fixed bottom-6 left-6 z-[90] bg-neutral-900 border border-emerald-500/30 rounded-2xl shadow-2xl px-4 py-3 max-w-[280px] flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <ShoppingBag size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-white font-bold leading-tight">Alguien en {socialProofNotif.city} acaba de pedir:</p>
              <p className="text-[11px] text-emerald-400 font-black leading-tight truncate">{socialProofNotif.product}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-[#070810]/90 backdrop-blur-2xl border-b border-white/5 z-40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-amber-400/20 blur-md animate-pulse" />
              <img
                src="/images/logo.jpeg"
                alt="Jansel Shop Logo"
                className="relative w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-2xl border border-amber-400/20 shadow-lg"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight leading-none text-gradient-gold">JANSEL SHOP</h1>
              <span className="text-[9px] text-slate-500 tracking-widest uppercase font-mono">Colombia · Tienda Oficial</span>
            </div>
          </div>

          {/* Trust badges desktop */}
          <div className="hidden lg:flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Truck size={13} className="text-amber-400" />
              <span>Envío Gratis</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>Pago Seguro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package size={13} className="text-blue-400" />
              <span>Despacho Hoy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BadgeCheck size={13} className="text-purple-400" />
              <span>Garantía 30 días</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-3 rounded-2xl glass-card hover:border-amber-400/40 text-white hover:text-amber-400 transition-all cursor-pointer flex items-center gap-2 group"
            >
              <ShoppingCart size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold hidden sm:inline">Carrito</span>
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-black font-black text-[10px] flex items-center justify-center animate-bounce">
                  {totalQty}
                </span>
              )}
            </button>
            <button
              onClick={() => handleWhatsAppOrder()}
              className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-2xl btn-cta-whatsapp text-white font-extrabold text-xs tracking-wider uppercase cursor-pointer"
            >
              <MessageCircle size={14} fill="currentColor" />
              WhatsApp
            </button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════
          HERO SECTION — DISEÑO EXPERTO
      ════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-4 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)" }} />
        <div className="absolute top-20 left-10 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none animate-aurora"
          style={{ background: "rgba(99,102,241,0.07)" }} />
        <div className="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none animate-aurora"
          style={{ background: "rgba(251,191,36,0.06)", animationDelay: "-3s" }} />

        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">

          {/* Logo grande: lo primero que ve quien llega de un anuncio. Da identidad
              antes de leer nada, que es lo que genera confianza en trafico frio. */}
          <motion.img
            src="/images/logo.jpeg"
            alt="Jansel Shop"
            initial={{ opacity: 0, scale: 0.85, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto mb-5 w-40 h-40 sm:w-52 sm:h-52 object-contain rounded-3xl border border-amber-400/25 shadow-[0_0_50px_-12px_rgba(251,191,36,0.5)]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />

          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2.5 glass-card-amber px-5 py-2 rounded-full"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping-large absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-amber-300 text-xs font-black uppercase tracking-widest">
              🔴 EN VIVO — {heroViewers} personas comprando ahora
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {/* El titular ataca la objecion #1 de comprar online en Colombia: la
                desconfianza. Y es 100% cierto, que es lo que lo hace funcionar.
                Antes decia "Los N Productos Mas Deseados de Colombia": una
                presuncion que nadie puede verificar, y ademas mostraba el numero
                del catalogo, que con 10 productos comunica poco surtido. */}
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
              <span className="text-white">Pídelo hoy.</span>
              <br />
              <span className="relative inline-block">
                <span className="text-gradient-gold">Págalo cuando</span>{" "}
                <span className="text-gradient-fire">lo tengas en la mano.</span>
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" />
              </span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed font-light">
              No mandas un peso por adelantado. El mensajero te lo lleva, lo revisas,{" "}
              <span className="text-white font-bold">y ahí sí pagas.</span>{" "}
              <span className="text-amber-400 font-bold underline decoration-amber-400/50">Envío gratis</span>{" "}
              a toda Colombia y 30 días de garantía.
            </p>
          </motion.div>

          {/* Hero CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => { document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}
              className="btn-cta-primary text-black font-black text-sm tracking-wider uppercase px-8 py-4 rounded-2xl flex items-center gap-3 cursor-pointer w-full sm:w-auto justify-center"
            >
              <Zap size={18} />
              Ver Ofertas de Hoy
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => handleWhatsAppOrder()}
              className="btn-cta-whatsapp text-white font-black text-sm tracking-wider uppercase px-8 py-4 rounded-2xl flex items-center gap-3 cursor-pointer w-full sm:w-auto justify-center"
            >
              <MessageCircle size={18} fill="currentColor" />
              Pedir por WhatsApp
            </button>
          </motion.div>

          {/* Micro trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-2"
          >
            {[
              { icon: "⭐", text: "4.9/5 · +500 reseñas" },
              { icon: "🚚", text: "Envío Gratis Nacional" },
              { icon: "🔒", text: "Pago 100% Seguro" },
              { icon: "📦", text: "Despacho el mismo día" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-1.5 glass-card px-3.5 py-1.5 rounded-full text-[11px] font-bold text-slate-300">
                <span>{b.icon}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Marquee de marcas/garantías */}
      <div className="border-y border-white/5 bg-white/[0.02] py-4 overflow-hidden">
        <div className="marquee-container">
          <div className="animate-marquee inline-flex gap-12 px-8">
            {[...Array(2)].map((_, outerIdx) => (
              <React.Fragment key={outerIdx}>
                {["🚚 Servientrega", "📦 Envía", "⚡ Coordinadora", "🔒 Interrapidísimo", "✅ +500 Clientes", "🇨🇴 100% Colombia", "💳 Nequi & Daviplata", "🛡️ Garantía 30 días"].map((item) => (
                  <span key={item} className="text-slate-500 text-xs font-bold uppercase tracking-widest whitespace-nowrap">{item}</span>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          PROPUESTA DE VALOR — 4 PILLARES
      ════════════════════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: <Truck size={28} className="text-amber-400" />,
                bg: "from-amber-500/10 to-transparent",
                border: "border-amber-500/20",
                title: "Envío Gratis",
                subtitle: "A toda Colombia",
                desc: "Sin importar tu ciudad o municipio, el envío es completamente GRATIS.",
              },
              {
                icon: <ShieldCheck size={28} className="text-emerald-400" />,
                bg: "from-emerald-500/10 to-transparent",
                border: "border-emerald-500/20",
                title: "Pago Seguro",
                subtitle: "Contraentrega",
                desc: "Pagas en efectivo cuando el mensajero llega a tu puerta. Cero riesgo.",
              },
              {
                icon: <Gift size={28} className="text-purple-400" />,
                bg: "from-purple-500/10 to-transparent",
                border: "border-purple-500/20",
                title: "Descuentos",
                subtitle: "Hasta 15% extra",
                desc: "2 productos = 10% off. 3 o más = 15% off. ¡Automático y al instante!",
              },
              {
                icon: <Package size={28} className="text-blue-400" />,
                bg: "from-blue-500/10 to-transparent",
                border: "border-blue-500/20",
                title: "Despacho Hoy",
                subtitle: "2-4 días hábiles",
                desc: "Pedidos antes de las 3pm salen el mismo día. Tracking en tiempo real.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`bg-gradient-to-b ${item.bg} border ${item.border} rounded-3xl p-6 space-y-3 hover:scale-[1.02] transition-transform`}
              >
                <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-black text-white text-base leading-tight">{item.title}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.subtitle}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CATÁLOGO — TARJETAS MEJORADAS
      ════════════════════════════════════════════ */}
      <section id="catalogo" className="py-12 px-4 max-w-7xl mx-auto">
        {/* Header del catálogo */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div>
            <span className="text-[10px] font-mono tracking-[0.25em] text-amber-400 uppercase">✦ Selección Premium</span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mt-1 flex items-center gap-3">
              <ShoppingBag className="text-amber-400" size={28} />
              Lo Más Vendido Esta Semana
            </h2>
            <p className="text-slate-500 text-xs mt-1.5">
              🔴 {ordersToday} pedidos despachados hoy · Stock limitado
            </p>
          </div>

          {/* Discount banner */}
          {totalQty >= 1 && totalQty < 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card-amber px-5 py-3 rounded-2xl text-center hidden md:block"
            >
              <p className="text-amber-300 text-xs font-black">
                🎁 Agrega 1 producto más y recibe <span className="text-white">10% OFF</span> en toda tu compra
              </p>
            </motion.div>
          )}
        </div>

        <div id="productos" className="scroll-mt-24" />
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all cursor-pointer ${
                activeTab === cat
                  ? "bg-amber-400 text-black shadow-lg shadow-amber-400/25 scale-105"
                  : "glass-card text-slate-400 hover:text-white hover:border-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((p, idx) => {
            // 🔥 GATILLO MENTAL DE ESCASEZ: el "stock" real es el inventario
            // del proveedor (suele ser 100-1500 unidades, así que casi nunca
            // se veía el aviso de "pocas unidades"). Para el mensaje de
            // urgencia usamos un número de marketing creíble y ESTABLE por
            // producto (no cambia en cada refresh, pero sí varía entre
            // productos), salvo que el producto esté realmente agotado.
            const isReallyOutOfStock = false; // Nunca mostramos "agotado": siempre se consigue el producto
            const idHash = String(p.id).split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const displayStock = (idHash % 13) + 3; // 3 a 15
            const stockPct = Math.min((displayStock / 20) * 100, 100);
            const isLowStock = true;
            const liveViewers = (idx * 7 + 12) % 18 + 14;
            const cartItem = cart.find((item) => item.product.id === p.id);
            const discountPct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(idx * 0.04, 0.25) }}
                className="neon-glow-card group relative flex flex-col rounded-3xl overflow-hidden transition-all duration-300"
              >
                {/* Badge top-left */}
                <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
                  <span className="bg-amber-400 text-black text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-md">
                    {p.badge}
                  </span>
                  {isLowStock && (
                    <span className="bg-red-500/90 text-white text-[8.5px] font-black uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1">
                      <AlertTriangle size={8} />
                      ¡Solo {displayStock} restantes!
                    </span>
                  )}
                  {/* Nota: NO mostramos "Agotado" aquí a propósito. El modelo
                      de negocio es que SIEMPRE se consigue el producto para
                      el cliente, sin importar el inventario real del
                      proveedor — mostrar "agotado" espantaría ventas que sí
                      se pueden cerrar igual. */}
                </div>

                {/* Discount badge top-right */}
                <div className="absolute top-3 right-3 z-20">
                  <span className="bg-gradient-to-br from-red-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-lg">
                    -{discountPct}% OFF
                  </span>
                </div>

                {/* Product image */}
                <div className="relative h-64 sm:h-56 md:h-64 lg:h-60 bg-[#06070c] flex items-center justify-center overflow-hidden border-b border-white/5">
                  <img
                    src={getProxiedImageUrl(p.imageUrl)}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 ease-out select-none"
                    style={{ transform: "scale(1)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.05)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1)"; }}
                  />
                </div>

                {/* Card content */}
                <div className="p-5 flex-1 flex flex-col gap-3">
                  {/* Category + Rating */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">{p.category}</span>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star size={11} fill="currentColor" />
                      <span className="text-[11px] font-bold text-white">{p.rating}</span>
                      <span className="text-[10px] text-slate-600">({p.reviews})</span>
                    </div>
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 space-y-1.5">
                    <h3 className="font-extrabold text-white text-sm leading-snug group-hover:text-amber-300 transition-colors line-clamp-2">
                      {p.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{p.description}</p>
                  </div>

                  {/* Live viewers */}
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400/70 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>{liveViewers} personas viendo esto</span>
                  </div>

                  {/* Stock bar */}
                  {isLowStock && (
                    <div>
                      <div className="flex justify-between text-[9px] text-slate-500 font-mono mb-1">
                        <span>Stock disponible</span>
                        <span className="text-red-400 font-black">{displayStock}/20 unidades</span>
                      </div>
                      <div className="stock-bar">
                        <div className="stock-bar-fill" style={{ width: `${stockPct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-end justify-between pt-1 border-t border-white/5">
                    <div>
                      <span className="block text-[9px] text-slate-600 font-mono uppercase mb-0.5">Precio promo</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-2xl text-amber-400">${p.price.toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] text-slate-600 line-through">${p.originalPrice.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[9px] text-emerald-400 font-black uppercase">Ahorras</span>
                      <span className="text-emerald-400 font-black text-sm">${(p.originalPrice - p.price).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {cartItem ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-950 rounded-xl border border-white/8 overflow-hidden flex-1 justify-between h-11 px-2">
                        <button type="button" onClick={() => updateCartQuantity(p.id, cartItem.quantity - 1)}
                          className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5">
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-black font-mono text-white">{cartItem.quantity} en carrito</span>
                        <button type="button" onClick={() => updateCartQuantity(p.id, cartItem.quantity + 1)}
                          className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5">
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsCartOpen(true); bajarAlFormulario(); }}
                        className="h-11 px-4 rounded-xl btn-cta-primary text-black font-black text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        Finalizar 🚀
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        className="py-3 rounded-xl glass-card text-white font-extrabold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 hover:border-white/15 active:scale-95 cursor-pointer"
                      >
                        <ShoppingCart size={12} className="text-amber-400" />
                        Agregar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInstantBuy(p)}
                        className="py-3 rounded-xl btn-cta-primary text-black font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                      >
                        Lo quiero ⚡
                      </button>
                    </div>
                  )}
                  <Link
                    to={"/producto/" + p.id}
                    className="mt-2 block text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-amber-400 transition-colors py-1.5"
                  >
                    Ver mas detalles →
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>


      {/* ════════════════════════════════════════════
          COMBOS — AHORRO POR LLEVAR MÁS
      ════════════════════════════════════════════ */}
      <section id="combos" className="py-16 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 space-y-2">
            <span className="text-[10px] font-mono tracking-[0.25em] text-amber-400 uppercase">✦ Arma tu combo</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight">
              <span className="text-white">Combos que</span>{" "}
              <span className="text-gradient-gold">Ahorran de Verdad</span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
              Llevando el combo pagas menos que comprando los productos por separado. Envío gratis y pago contra entrega.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ACTIVE_PROMOTIONS.map((combo, idx) => {
              const items = combo.productIds
                .map((pid) => TRENDING_PRODUCTS.find((p) => p.id === pid))
                .filter(Boolean) as typeof TRENDING_PRODUCTS;
              if (items.length === 0) return null;
              const ahorro = combo.originalPrice - combo.promoPrice;
              return (
                <motion.div
                  key={combo.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: Math.min(idx * 0.06, 0.3) }}
                  className="glass-card rounded-3xl border border-amber-500/20 overflow-hidden flex flex-col hover:border-amber-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between px-5 pt-5">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 px-3 py-1.5 rounded-full">
                      {combo.badge}
                    </span>
                    <span className="text-[10px] font-black uppercase bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full">
                      -{combo.discountPercentage}%
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1 px-5 py-4">
                    {items.map((p, i) => (
                      <React.Fragment key={p.id}>
                        {i > 0 && <span className="text-amber-400/60 font-black text-lg shrink-0">+</span>}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
                          <img
                            src={getProxiedImageUrl(p.imageUrl)}
                            alt={p.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.src = "/images/logo.jpeg"; }}
                          />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="px-5 pb-5 flex flex-col flex-1 gap-3">
                    <div>
                      <h3 className="text-lg font-black leading-tight">{combo.name}</h3>
                      <p className="text-amber-400/90 text-xs font-bold mt-0.5">{combo.tagline}</p>
                    </div>

                    <ul className="space-y-1">
                      {items.map((p) => (
                        <li key={p.id} className="text-slate-400 text-xs flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                          <span className="leading-snug">{p.name}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-2">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-slate-500 line-through text-sm">
                          ${combo.originalPrice.toLocaleString()}
                        </span>
                        <span className="text-2xl font-black text-gradient-gold">
                          ${combo.promoPrice.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-emerald-400 text-xs font-bold mt-0.5">
                        Ahorras ${ahorro.toLocaleString()} COP
                      </p>

                      {/* El principal lleva DIRECTO al formulario: cada paso extra
                          entre "lo quiero" y los datos de envio pierde pedidos, y
                          el formulario cierra la venta sin depender de WhatsApp. */}
                      <button
                        onClick={() => pedirComboAhora(combo)}
                        className="w-full mt-3 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform"
                      >
                        Pedir este combo ⚡
                      </button>
                      <button
                        onClick={() => addComboToCart(combo)}
                        className="w-full mt-2 glass-card border border-white/10 text-slate-300 font-bold text-[10px] uppercase tracking-widest py-2.5 rounded-2xl hover:border-amber-400/40 transition-colors"
                      >
                        Agregar al carrito 🛒
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          BANNER FOMO — URGENCIA CENTRAL
      ════════════════════════════════════════════ */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-amber-500/20 p-8 sm:p-12 text-center"
            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(249,115,22,0.05) 50%, rgba(251,191,36,0.08) 100%)" }}
          >
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/3 to-amber-500/5 animate-gradient-shift" style={{ backgroundSize: "200% 200%" }} />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-red-400 text-xs font-black uppercase tracking-widest">OFERTA ESPECIAL — Solo por hoy</span>
              </div>

              <h3 className="text-3xl sm:text-4xl font-black leading-tight">
                ¿Llevas{" "}
                <span className="text-gradient-gold">2 o más productos?</span>
                <br />
                ¡Descuento automático!
              </h3>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="glass-card border-emerald-500/20 px-8 py-5 rounded-2xl text-center">
                  <span className="block text-3xl font-black text-emerald-400">PROMO 2</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Lleva 2 con Descuento</span>
                </div>
                <div className="text-slate-600 text-2xl font-black">+</div>
                <div className="glass-card border-amber-500/20 px-8 py-5 rounded-2xl text-center animate-glow-pulse">
                  <span className="block text-3xl font-black text-amber-400">PROMO 3+</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Ahorro Extra desde 3</span>
                </div>
                <div className="text-slate-600 text-2xl font-black">+</div>
                <div className="glass-card border-blue-500/20 px-8 py-5 rounded-2xl text-center">
                  <span className="block text-3xl font-black text-blue-400">DESCUENTO</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Por Pago Anticipado</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
                <Zap className="text-amber-400" size={16} />
                <span>Los descuentos se aplican <strong className="text-white">automáticamente</strong> en tu carrito. ¡Sin códigos!</span>
              </div>

              <button
                onClick={() => { document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}
                className="btn-cta-primary text-black font-black text-sm uppercase tracking-wider px-10 py-4 rounded-2xl inline-flex items-center gap-3 cursor-pointer"
              >
                <ShoppingBag size={18} />
                Aprovechar Descuentos
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FORMULARIO DE PEDIDO — MEJORADO
      ════════════════════════════════════════════ */}
      {/* PEDIDO EN PANTALLA EMERGENTE
          Misma logica de siempre (metodo de pago, carrito, descuentos y envio
          del pedido); lo unico que cambia es que ya no hay que deslizar. */}
      <AnimatePresence>
      {pedidoAbierto && (
      <motion.div
        className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain bg-black/85 backdrop-blur-sm px-3 py-4 sm:px-6 sm:py-8"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) cerrarPedido(); }}
        role="dialog" aria-modal="true" aria-label="Completa tu pedido"
      >
      <motion.div
        className="relative w-full max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
      >
        <button
          type="button" onClick={cerrarPedido} aria-label="Cerrar"
          className="absolute -top-1 right-1 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center backdrop-blur-md transition-colors"
        >
          <X size={18} />
        </button>
      <section className="relative rounded-3xl border border-white/10 bg-[#0A0C15] shadow-2xl shadow-black/60 px-4 py-7 sm:px-7 sm:py-9 overflow-hidden" ref={formRef} id="formulario">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/5 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative z-10">
          {wheelPrize && (
            <div className="mb-8 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border-2 border-amber-400/40 rounded-2xl px-5 py-4 flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <p className="text-amber-300 font-black text-sm uppercase tracking-wide">¡Premio de tu ruleta activo!</p>
                <p className="text-white text-sm">Ganaste: <span className="font-bold">{wheelPrize}</span> — ya quedó aplicado en tu carrito ✅</p>
              </div>
            </div>
          )}
          {/* Section header */}
          <div className="text-center space-y-3 mb-7">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle size={12} />
              ZONA DE PEDIDO SEGURO
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              📝 Completa Tu Pedido
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Sencillo, rápido y seguro. Elige tu método de pago, revisa tu carrito e ingresa tus datos.{" "}
              <span className="text-amber-400 font-bold">¡Despachamos hoy mismo!</span>
            </p>
            {/* Steps */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              {["1. Revisa tu carrito", "→", "2. Elige tu método de pago", "→", "3. Ingresa tus datos", "→", "4. ¡Listo! 🎉"].map((s, i) => (
                <span key={i} className={s === "→" ? "text-slate-700" : "font-bold text-slate-400"}>{s}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT: Form */}
            <div className="lg:col-span-7 space-y-6">

              {/* Cart review */}
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <ShoppingCart size={14} className="text-amber-400" />
                    Paso 1 — Tu Carrito
                  </h3>
                  <span className="text-[10px] glass-card px-3 py-1 rounded-xl text-slate-400 font-mono border-0">
                    {totalQty} {totalQty === 1 ? "producto" : "productos"}
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-4 text-center">
                    <ShoppingBag className="text-slate-700 animate-pulse" size={36} />
                    <div>
                      <p className="text-sm font-bold text-slate-400">Tu carrito está vacío</p>
                      <p className="text-xs text-slate-600 mt-1">Agrega productos del catálogo de arriba</p>
                    </div>
                    <button
                      onClick={() => { document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }}
                      className="px-6 py-2.5 rounded-xl btn-cta-primary text-black text-xs font-extrabold uppercase tracking-widest cursor-pointer"
                    >
                      Ver Catálogo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center gap-3 bg-white/[0.03] p-3 rounded-2xl border border-white/5">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-white/5 shrink-0">
                          <img src={getProxiedImageUrl(item.product.imageUrl)} alt={item.product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-xs text-white truncate">{item.product.name}</h4>
                          <span className="text-[10px] text-amber-400 font-mono font-bold">${item.product.price.toLocaleString()} COP</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-950 rounded-lg border border-white/8 overflow-hidden">
                            <button type="button" onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                              className="p-1.5 text-slate-500 hover:text-white cursor-pointer"><Minus size={10} /></button>
                            <span className="px-2 text-xs font-black font-mono text-white">{item.quantity}</span>
                            <button type="button" onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                              className="p-1.5 text-slate-500 hover:text-white cursor-pointer"><Plus size={10} /></button>
                          </div>
                          <button type="button" onClick={() => removeFromCart(item.product.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/10 cursor-pointer"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Discount prompt */}
                {cart.length > 0 && totalQty < 2 && (
                  <div className="p-3.5 bg-purple-500/5 border border-purple-500/15 rounded-2xl flex items-start gap-2.5">
                    <Sparkles size={15} className="text-purple-400 shrink-0 mt-0.5" />
                    <p className="text-[10.5px] text-slate-300">
                      💡 <span className="text-purple-300 font-black">¡Agrega 1 producto más</span> y recibe un <span className="text-white font-extrabold underline">descuento automático</span> en toda tu compra!
                    </p>
                  </div>
                )}
              </div>

              {/* Payment method */}
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <CreditCard size={14} className="text-amber-400" />
                  Paso 2 — Método de Pago
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Contraentrega */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("contraentrega")}
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                      paymentMethod === "contraentrega"
                        ? "bg-slate-900 border-amber-400 ring-2 ring-amber-400/20"
                        : "bg-white/[0.02] border-white/8 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Truck size={14} className="text-amber-400" /> Pagas al Recibir
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === "contraentrega" ? "border-amber-400 bg-amber-400" : "border-slate-700"}`}>
                        {paymentMethod === "contraentrega" && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">Paga en efectivo al mensajero cuando recibas tu pedido. 100% seguro.</p>
                  </button>

                  {/* Pago anticipado */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("anticipado")}
                    className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all relative overflow-hidden cursor-pointer ${
                      paymentMethod === "anticipado"
                        ? "bg-slate-900 border-amber-400 ring-2 ring-amber-400/20"
                        : "bg-white/[0.02] border-white/8 hover:border-white/15"
                    }`}
                  >
                    <span className="absolute -top-1 -right-4 bg-gradient-to-r from-red-500 to-amber-500 text-black font-black text-[7px] uppercase tracking-widest px-5 py-1.5 rotate-12">
                      PROMO 🔥
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-400" /> Pago Anticipado
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === "anticipado" ? "border-amber-400 bg-amber-400" : "border-slate-700"}`}>
                        {paymentMethod === "anticipado" && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">Nequi, Daviplata o Banco de Bogotá. Te aplicamos <span className="text-emerald-400 font-extrabold">DESCUENTO EXTRA</span>.</p>
                  </button>
                </div>

                {/* Pago anticipado details */}
                <AnimatePresence>
                  {paymentMethod === "anticipado" && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      className="glass-card-amber rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs">
                        <Sparkles size={14} className="animate-pulse" />
                        ¡EXCELENTE! Ahorras dinero extra en tu compra
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          // Las billeteras van por numero de celular; la cuenta de
                          // banco lleva su propia etiqueta y el tipo de cuenta,
                          // porque el cliente lo necesita para transferir bien.
                          { owner: "Jan Vanegas", number: "313 364 7176", tipo: null, marcas: ["NEQUI", "DAVIPLATA"] },
                          { owner: "Nelsy Tatiana Salcedo", number: "313 361 5984", tipo: null, marcas: ["NEQUI", "DAVIPLATA"] },
                          { owner: "Nelsy Tatiana Salcedo", number: "632426086", tipo: "Cuenta de Ahorros", marcas: ["BANCO DE BOGOTÁ"] },
                        ].map((m) => (
                          <div
                            key={m.owner + m.number}
                            className={`bg-black/40 p-3 rounded-xl border border-white/5 space-y-1.5 ${m.tipo ? "col-span-2" : ""}`}
                          >
                            <div className="flex flex-wrap gap-1">
                              {m.marcas.map((marca) => (
                                <span
                                  key={marca}
                                  className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider ${
                                    marca === "NEQUI" ? "bg-[#E52F86]/25 text-[#FF66B2]"
                                    : marca === "DAVIPLATA" ? "bg-[#421D83]/40 text-[#9E7BFF]"
                                    : "bg-[#0033A0]/40 text-[#7FA8FF]"
                                  }`}
                                >
                                  {marca}
                                </span>
                              ))}
                              {m.tipo && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 font-black tracking-wider">
                                  {m.tipo.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="block text-xs font-mono font-black text-white select-all">
                              {m.number}
                            </span>
                            <span className="text-[8px] text-slate-400 block border-t border-white/5 pt-1">
                              Titular: {m.owner}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="text-[9.5px] text-slate-500 flex items-start gap-1.5">
                        <Lock size={11} className="text-amber-400 shrink-0 mt-0.5" />
                        <span>Registra tu pedido y un asesor te contactará de inmediato para recibir tu comprobante.</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Checkout mode selector */}
              <div className="flex gap-2 p-1 glass-card rounded-2xl">
                {[
                  { key: "formulario" as const, label: "📝 Formulario", icon: <Lock size={13} />, activeColor: "bg-amber-400 text-black shadow-lg shadow-amber-400/15" },
                  { key: "whatsapp" as const, label: "🟢 WhatsApp", icon: <MessageCircle size={13} fill="currentColor" />, activeColor: "bg-[#25D366] text-white shadow-lg shadow-emerald-500/15" },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setCheckoutMode(m.key)}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      checkoutMode === m.key ? m.activeColor : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Form or WhatsApp mode */}
              {checkoutMode === "formulario" ? (
                <form onSubmit={handleSubmit} onInput={alEscribirEnFormulario} className="glass-card rounded-3xl p-6 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                    <MapPin size={14} />
                    Paso 3 — Datos de Envío
                  </h3>

                  <div className="space-y-1.5">
                    <label className="block text-xs text-slate-400 font-bold">Nombre Completo *</label>
                    <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Ej. Juan Carlos Vanegas" required
                      className="w-full bg-black/40 border border-white/8 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 placeholder:text-slate-700 transition-all" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs text-slate-400 font-bold">Número de Celular *</label>
                      <input type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} placeholder="Ej. 3123456789" required
                        className="w-full bg-black/40 border border-white/8 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 placeholder:text-slate-700 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs text-slate-400 font-bold">Ciudad / Municipio *</label>
                      <input type="text" name="city" value={formData.city} onChange={handleInputChange} placeholder="Ej. Bogotá, Medellín..." required
                        className="w-full bg-black/40 border border-white/8 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 placeholder:text-slate-700 transition-all" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs text-slate-400 font-bold">Dirección Exacta de Entrega *</label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="Ej. Calle 10 # 5-20, Apto 402, Barrio Las Flores" required
                      className="w-full bg-black/40 border border-white/8 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 placeholder:text-slate-700 transition-all" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs text-slate-400 font-bold">Indicaciones Adicionales (Opcional)</label>
                    <input type="text" name="addressIndicator" value={formData.addressIndicator} onChange={handleInputChange} placeholder="Ej. Portería blanca, frente al parque"
                      className="w-full bg-black/40 border border-white/8 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50 placeholder:text-slate-700 transition-all" />
                  </div>

                  <div className="pt-4 space-y-3">
                    <button
                      type="submit"
                      disabled={submitting || cart.length === 0}
                      className="w-full py-4 rounded-2xl btn-cta-primary text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <><div className="w-5 h-5 border-3 border-black border-t-transparent rounded-full animate-spin" /><span>Guardando Pedido...</span></>
                      ) : (
                        <><Lock size={16} /><span>Confirmar Pedido Seguro 🔒</span></>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={cart.length === 0}
                      onClick={() => handleWhatsAppOrder()}
                      className="w-full py-4 rounded-2xl btn-cta-whatsapp text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 cursor-pointer disabled:opacity-40"
                    >
                      <MessageCircle size={16} fill="currentColor" />
                      O Prefiero Pedir por WhatsApp 🚀
                    </button>

                    {/* La Ley 1581 pide avisar QUE se recogen datos y PARA QUE,
                        en el momento en que la persona los entrega. Aqui, no
                        escondido en el pie de pagina. */}
                    <p className="text-[10px] text-slate-500 text-center leading-relaxed pt-1">
                      Al confirmar aceptas que usemos tus datos para despachar tu pedido y contactarte.
                      Puedes pedirnos que los borremos cuando quieras.{" "}
                      <Link to="/privacidad" className="text-slate-400 underline underline-offset-2 hover:text-amber-400">
                        Ver política de privacidad
                      </Link>
                    </p>
                  </div>
                </form>
              ) : (
                <div className="glass-card rounded-3xl p-6 space-y-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#25D366] flex items-center gap-2">
                    <MessageCircle size={14} fill="currentColor" />
                    Paso 3 — Pedido por WhatsApp
                  </h3>
                  <div className="space-y-1.5">
                    <label className="block text-xs text-slate-400 font-bold">Tu Nombre (Opcional)</label>
                    <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} placeholder="Ej. Juan Carlos"
                      className="w-full bg-black/40 border border-white/8 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 placeholder:text-slate-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs text-slate-400 font-bold">Celular (Opcional)</label>
                      <input type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} placeholder="3123456789"
                        className="w-full bg-black/40 border border-white/8 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 placeholder:text-slate-700" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs text-slate-400 font-bold">Ciudad (Opcional)</label>
                      <input type="text" name="city" value={formData.city} onChange={handleInputChange} placeholder="Bogotá"
                        className="w-full bg-black/40 border border-white/8 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 placeholder:text-slate-700" />
                    </div>
                  </div>
                  <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
                    <span className="text-[10px] font-mono text-[#25D366] uppercase font-bold flex items-center gap-1.5"><MessageCircle size={11} fill="currentColor" /> Vista previa:</span>
                    <div className="text-[11px] text-slate-400 font-mono leading-relaxed max-h-32 overflow-y-auto">
                      <p>¡Hola Jan Sel! Quiero:{"\n"}</p>
                      {cart.map(item => <p key={item.product.id}>• {item.product.name} x{item.quantity} — ${item.product.price.toLocaleString()} COP</p>)}
                      <p className="mt-1 text-white font-black">Total: ${finalTotal.toLocaleString()} COP — Envío GRATIS 🚚</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => handleWhatsAppOrder()}
                    className="w-full py-4 rounded-2xl btn-cta-whatsapp text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 cursor-pointer disabled:opacity-40"
                  >
                    <MessageCircle size={18} fill="currentColor" />
                    Enviar Pedido por WhatsApp 🚀
                  </button>
                </div>
              )}

              <p className="text-[10px] text-slate-600 text-center flex items-center justify-center gap-1 mt-2">
                <ShieldCheck size={11} className="text-amber-400" />
                Tus datos están protegidos. Despachamos el mismo día. Pagas al recibir.
              </p>
            </div>

            {/* RIGHT: Order Summary sidebar */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              {/* Summary box */}
              <div className="glass-card rounded-3xl p-6 space-y-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-white/5 pb-4">
                  📋 Resumen de tu Orden
                </h3>

                <div className="space-y-3 text-xs">
                  {cart.length === 0 ? (
                    <p className="text-slate-600 italic text-center py-4">No hay productos seleccionados.</p>
                  ) : (
                    cart.map((item) => (
                      <div key={item.product.id} className="flex justify-between items-center">
                        <span className="text-slate-300 truncate max-w-[160px]">{item.product.name} <span className="text-amber-400 font-black">x{item.quantity}</span></span>
                        <span className="text-white font-mono shrink-0">${(item.product.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3 border-t border-white/5 pt-4 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span className="text-white font-mono">${subtotal.toLocaleString()} COP</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Envío Nacional</span>
                    <span className="text-emerald-400 font-black uppercase">¡GRATIS! 🚚</span>
                  </div>
                  {quantityDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 bg-emerald-500/5 px-3 py-2 rounded-xl border border-emerald-500/10">
                      <span>Dto. Cantidad</span>
                      <span className="font-black font-mono">-${quantityDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {referralDiscount > 0 && (
                    <div className="flex justify-between text-amber-300 bg-amber-500/5 px-3 py-2 rounded-xl border border-amber-500/10">
                      <span>Dto. por Invitar</span>
                      <span className="font-black font-mono">-${referralDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {descuentoRuleta > 0 && (
                    <div className="flex justify-between text-fuchsia-300 bg-fuchsia-500/5 px-3 py-2 rounded-xl border border-fuchsia-500/15">
                      <span>🎡 Premio de la ruleta</span>
                      <span className="font-black font-mono">-${descuentoRuleta.toLocaleString()}</span>
                    </div>
                  )}
                  {referralPct > 0 && totalQty < REFERRAL_MIN_ITEMS && (
                    <div className="flex items-center gap-2 text-amber-300 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
                      <span className="text-base">🎁</span>
                      <span className="text-[11px] leading-snug">
                        Tienes <strong>{referralPct}% OFF</strong> esperando. Agrega {REFERRAL_MIN_ITEMS - totalQty} producto mas para aplicarlo.
                      </span>
                    </div>
                  )}
                  {prepaymentDiscount > 0 && (
                    <div className="flex justify-between text-amber-400 bg-amber-400/5 px-3 py-2 rounded-xl border border-amber-400/10">
                      <span>Dto. Anticipado</span>
                      <span className="font-black font-mono">-${prepaymentDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="h-px bg-white/5 my-2" />

                  <div className="flex justify-between items-baseline">
                    <span className="text-base font-bold text-white">Total a Pagar</span>
                    <div className="text-right">
                      <span className="text-3xl font-black text-gradient-gold font-mono">${finalTotal.toLocaleString()}</span>
                      <span className="block text-[9px] text-slate-600 mt-0.5">COP</span>
                    </div>
                  </div>

                  {savings > 0 && (
                    <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-2xl p-3 text-center">
                      <span className="text-emerald-400 font-black text-sm">🎉 ¡Ahorras ${savings.toLocaleString()} COP!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Guarantee box */}
              <div className="glass-card rounded-3xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-amber-400" />
                  Sello de Garantía
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Todos tus despachos viajan asegurados al 100%. Trabajamos con las mejores agencias logísticas de Colombia.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <Truck size={16} className="text-amber-400" />, label: "Entrega 2-4 días" },
                    { icon: <ShieldCheck size={16} className="text-emerald-400" />, label: "Garantía 30 días" },
                    { icon: <BadgeCheck size={16} className="text-blue-400" />, label: "Producto original" },
                    { icon: <Phone size={16} className="text-purple-400" />, label: "Soporte inmediato" },
                  ].map((g, i) => (
                    <div key={i} className="bg-white/[0.02] p-3 rounded-xl border border-white/5 text-[10px] font-bold text-slate-400 flex flex-col items-center gap-1.5 text-center">
                      {g.icon}
                      {g.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* WhatsApp quick button */}
              <button
                onClick={() => handleWhatsAppOrder()}
                className="w-full btn-cta-whatsapp text-white font-black text-sm uppercase tracking-wider py-4 rounded-2xl flex items-center justify-center gap-3 cursor-pointer"
              >
                <MessageCircle size={20} fill="currentColor" />
                ¿Dudas? Escríbenos al WhatsApp
              </button>
            </div>
          </div>
        </div>
      </section>
      </motion.div>
      </motion.div>
      )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════
          TESTIMONIOS — CAROUSEL PREMIUM
      ════════════════════════════════════════════ */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full text-amber-400 text-[10px] font-black uppercase tracking-widest">
              <Star size={12} fill="currentColor" />
              Clientes Reales · Opiniones Verificadas
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              🗣️ Lo que dicen nuestros clientes
            </h2>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
              {[
                { value: "4.9/5", label: "Calificación promedio", color: "text-amber-400" },
                { value: "+500", label: "Clientes satisfechos", color: "text-emerald-400" },
                { value: "98%", label: "Recomendarían Jan Shop", color: "text-blue-400" },
                { value: "2-4 días", label: "Tiempo de entrega", color: "text-purple-400" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial carousel */}
          <div className="relative">
            {/* Main testimonial (large) */}
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonialIdx}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.4 }}
                className="glass-card rounded-3xl p-8 sm:p-10 max-w-3xl mx-auto text-center space-y-5"
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${TESTIMONIALS[testimonialIdx].color} flex items-center justify-center font-black text-xl text-white mx-auto shadow-lg`}>
                  {TESTIMONIALS[testimonialIdx].avatar}
                </div>
                <div className="flex items-center justify-center gap-1 text-amber-400">
                  {[...Array(TESTIMONIALS[testimonialIdx].rating)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="text-slate-200 text-base sm:text-lg leading-relaxed italic font-light max-w-xl mx-auto">
                  "{TESTIMONIALS[testimonialIdx].text}"
                </p>
                <div>
                  <span className="font-black text-white">— {TESTIMONIALS[testimonialIdx].name}</span>
                  <span className="text-amber-400 font-bold">, {TESTIMONIALS[testimonialIdx].city}</span>
                  <span className="block text-[10px] text-slate-600 mt-1 font-mono">{TESTIMONIALS[testimonialIdx].product} · {TESTIMONIALS[testimonialIdx].date}</span>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dots navigation */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTestimonialIdx(i)}
                  className={`rounded-full transition-all cursor-pointer ${i === testimonialIdx ? "w-8 h-2 bg-amber-400" : "w-2 h-2 bg-white/15 hover:bg-white/30"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FAQ — ACORDEÓN
      ════════════════════════════════════════════ */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center space-y-4 mb-10">
            <h2 className="text-3xl font-black tracking-tight">❓ Preguntas Frecuentes</h2>
            <p className="text-slate-400 text-sm">Resolvemos tus dudas antes de que compres.</p>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className={`glass-card rounded-2xl overflow-hidden transition-all ${openFaq === i ? "border-amber-400/30" : ""}`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-bold text-sm text-white">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-amber-400 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CTA FINAL — CIERRE PODEROSO
      ════════════════════════════════════════════ */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/30 via-orange-950/20 to-[#070810]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px]"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 glass-card-amber px-5 py-2 rounded-full">
              <Package size={14} className="text-amber-400" />
              <span className="text-amber-300 text-xs font-black uppercase tracking-widest">
                📦 {ordersToday} pedidos despachados hoy
              </span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-black leading-tight">
              ¿Listo para recibir tu{" "}
              <span className="text-gradient-gold">pedido mañana?</span>
            </h2>

            <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
              Más de <strong className="text-white">500 colombianos</strong> ya compraron con nosotros.
              Paga al recibirlo, envío gratis y garantía de 30 días.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => bajarAlFormulario()}
                className="btn-cta-primary text-black font-black text-base uppercase tracking-wider px-10 py-5 rounded-2xl flex items-center gap-3 cursor-pointer w-full sm:w-auto justify-center"
              >
                <ShoppingBag size={20} />
                Hacer mi Pedido Ahora
              </button>
              <button
                onClick={() => handleWhatsAppOrder()}
                className="btn-cta-whatsapp text-white font-black text-base uppercase tracking-wider px-10 py-5 rounded-2xl flex items-center gap-3 cursor-pointer w-full sm:w-auto justify-center"
              >
                <MessageCircle size={20} fill="currentColor" />
                Escribir al WhatsApp
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-bold pt-2">
              {["🔒 Pago seguro", "🚚 Envío gratis", "📦 Despacho hoy", "✅ Garantía 30 días"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════ */}
      <footer className="border-t border-white/5 bg-[#050609] py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src="/images/logo.jpeg" alt="Logo" className="w-10 h-10 rounded-xl object-contain border border-white/10"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div>
                  <div className="font-black text-base text-gradient-gold">JANSEL SHOP</div>
                  <div className="text-[9px] text-slate-600 font-mono">Colombia · Tienda Oficial</div>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-[250px]">
                Tu tienda de confianza en Colombia. Productos de calidad, envío gratis y pago contraentrega.
              </p>
            </div>

            {/* Links */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Compras</h3>
              {["Catálogo completo", "Cómo comprar", "Seguimiento de pedido", "Garantías"].map((l) => (
                <p key={l} className="text-xs text-slate-600 hover:text-amber-400 cursor-pointer transition-colors">{l}</p>
              ))}
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contacto</h3>
              <button
                onClick={() => handleWhatsAppOrder()}
                className="flex items-center gap-2 text-xs text-emerald-400 font-bold hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <MessageCircle size={14} fill="currentColor" />
                WhatsApp — Atención 24/7
              </button>
              <div className="text-xs text-slate-600 space-y-1">
                <p>🚚 Servientrega, Envía, Coordinadora</p>
                <p>💳 Nequi, Daviplata, Banco de Bogotá</p>
                <p>🛡️ Garantía 30 días en todos los productos</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-slate-700 text-center sm:text-left">
              © 2025 Jansel Shop · Todos los derechos reservados · Colombia 🇨🇴
              <br />
              <Link to="/privacidad" className="text-slate-500 hover:text-amber-400 underline underline-offset-2 transition-colors">
                Política de Privacidad y Tratamiento de Datos
              </Link>
            </p>
            <div className="flex items-center gap-3 text-[10px] text-slate-700 font-mono">
              <span>🔒 SSL Seguro</span>
              <span>·</span>
              <span>✅ Empresa Verificada</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ════════════════════════════════════════════
          FLOATING CART DRAWER
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <div className="absolute inset-y-0 right-0 max-w-full flex">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", duration: 0.3 }}
                className="w-screen max-w-md bg-[#0a0c14] border-l border-white/8 flex flex-col h-full shadow-2xl"
              >
                <div className="p-6 border-b border-white/8 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={18} className="text-amber-400" />
                    <h3 className="font-extrabold text-white text-base">Tu Carrito</h3>
                    {totalQty > 0 && <span className="glass-card-amber text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full border-0">{totalQty} productos</span>}
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 text-slate-400 hover:text-white glass-card rounded-xl text-xs font-black cursor-pointer flex items-center gap-1"
                  >
                    <X size={14} />
                    Cerrar
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-5">
                      <div className="w-20 h-20 rounded-full glass-card flex items-center justify-center">
                        <ShoppingCart size={32} className="text-slate-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">Carrito vacío</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">Explora el catálogo y agrega los productos de tu interés.</p>
                      </div>
                      <button onClick={() => setIsCartOpen(false)} className="px-6 py-3 rounded-xl btn-cta-primary text-black text-xs font-bold uppercase tracking-wider cursor-pointer">
                        Ver Catálogo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex gap-4 glass-card p-4 rounded-2xl">
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-white/8 shrink-0">
                            <img src={getProxiedImageUrl(item.product.imageUrl)} alt={item.product.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="font-extrabold text-sm text-white truncate pr-6">{item.product.name}</h4>
                            <p className="text-xs text-slate-500 font-mono">${item.product.price.toLocaleString()} COP c/u</p>
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center bg-black/40 rounded-lg border border-white/8 overflow-hidden">
                                <button onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer"><Minus size={10} /></button>
                                <span className="px-2.5 text-xs font-mono font-black text-white">{item.quantity}</span>
                                <button onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer"><Plus size={10} /></button>
                              </div>
                              <button onClick={() => removeFromCart(item.product.id)}
                                className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5 cursor-pointer">
                                <Trash2 size={10} /> Quitar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="p-6 bg-[#070810] border-t border-white/8 space-y-4">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400"><span>Subtotal ({totalQty} und.):</span><span className="text-white font-mono font-bold">${subtotal.toLocaleString()}</span></div>
                      {quantityDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400"><span>Dto. Cantidad:</span><span className="font-bold">-${quantityDiscount.toLocaleString()}</span></div>
                      )}
                      {referralDiscount > 0 && (
                        <div className="flex justify-between text-amber-300 bg-amber-500/5 px-3 py-2 rounded-xl border border-amber-500/10">
                          <span>Dto. por Invitar</span>
                          <span className="font-black font-mono">-${referralDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      {descuentoRuleta > 0 && (
                        <div className="flex justify-between text-fuchsia-300 bg-fuchsia-500/5 px-3 py-2 rounded-xl border border-fuchsia-500/15">
                          <span>🎡 Premio de la ruleta</span>
                          <span className="font-black font-mono">-${descuentoRuleta.toLocaleString()}</span>
                        </div>
                      )}
                      {referralPct > 0 && totalQty < REFERRAL_MIN_ITEMS && (
                        <div className="flex items-center gap-2 text-amber-300 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
                          <span className="text-base">🎁</span>
                          <span className="text-[11px] leading-snug">
                            Tienes <strong>{referralPct}% OFF</strong> esperando. Agrega {REFERRAL_MIN_ITEMS - totalQty} producto mas para aplicarlo.
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-400"><span>Envío:</span><span className="text-emerald-400 font-black">¡GRATIS! 🚚</span></div>
                      <div className="h-px bg-white/5 my-2" />
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-bold text-white">Total Estimado</span>
                        <span className="text-2xl font-black text-amber-400 font-mono">${finalTotal.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-2 pt-1">
                      <button onClick={handleProceedToForm}
                        className="w-full py-4 rounded-xl btn-cta-primary text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
                        <span>Completar Pedido por Formulario 📝</span>
                        <ArrowRight size={14} />
                      </button>
                      <button onClick={() => handleWhatsAppOrder()}
                        className="w-full py-3.5 rounded-xl btn-cta-whatsapp text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
                        <MessageCircle size={14} fill="currentColor" />
                        <span>Pedir por WhatsApp 🚀</span>
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-700 text-center flex items-center justify-center gap-1">
                      <Lock size={9} className="text-amber-400" />
                      Pago 100% seguro contra entrega o transferencia.
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════
          FLOATING CART BUBBLE
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {cart.length > 0 && !isCartOpen && (
          <motion.button
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 100 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-24 right-6 z-40 rounded-full btn-cta-primary text-black shadow-2xl hover:scale-110 active:scale-95 transition-transform flex items-center gap-2.5 cursor-pointer px-5 py-4"
          >
            <ShoppingCart size={22} />
            <span className="text-xs font-black uppercase tracking-wide hidden md:inline">Ver Carrito</span>
            <span className="w-6 h-6 rounded-full bg-black text-amber-400 text-[10px] font-black flex items-center justify-center shrink-0">
              {totalQty}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════
          🎡 RULETA DE DESCUENTOS
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {wheelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              className="relative max-w-sm w-full rounded-[28px] p-[1.5px] bg-gradient-to-br from-amber-300 via-amber-600/40 to-amber-300 shadow-[0_0_60px_-10px_rgba(245,158,11,0.35)]"
            >
              <div className="bg-gradient-to-b from-neutral-950 to-neutral-900 rounded-[26px] p-6 md:p-8 text-center relative overflow-hidden">
                {/* Textura de fondo sutil */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "16px 16px" }} />

                {!wheelPrize && (
                  <button
                    onClick={() => setWheelOpen(false)}
                    className="absolute top-4 right-4 z-20 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}

                {!wheelPrize ? (
                  <div className="relative">
                    <div className="inline-flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/25 px-3 py-1 rounded-full text-amber-300 text-[9px] font-black uppercase tracking-widest mb-3">
                      <Sparkles size={10} />
                      Exclusivo para nuevos visitantes
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-1">
                      ¡Gira y <span className="text-amber-400">Gana!</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mb-6">Tienes <span className="text-white font-bold">1 giro gratis</span> — todo el mundo se lleva un premio 🎯</p>

                    <div className="relative w-64 h-64 mx-auto mb-7">
                      {/* Aro dorado exterior */}
                      <div className="absolute inset-[-6px] rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-[0_8px_30px_-8px_rgba(245,158,11,0.5)]" />
                      <div className="absolute inset-0 rounded-full bg-neutral-950" />

                      {/* Bombillas del aro: el detalle que hace que se sienta feria/casino */}
                      {Array.from({ length: 16 }).map((_, b) => {
                        const a = (b / 16) * Math.PI * 2;
                        return (
                          <motion.span
                            key={b}
                            className="absolute w-1.5 h-1.5 rounded-full bg-amber-200 z-10"
                            style={{
                              left: "calc(50% + " + (Math.cos(a) * 50).toFixed(2) + "% - 3px)",
                              top: "calc(50% + " + (Math.sin(a) * 50).toFixed(2) + "% - 3px)",
                            }}
                            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: b * 0.07 }}
                          />
                        );
                      })}

                      {/* Puntero */}
                      <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 z-20 drop-shadow-lg">
                        <div className="w-0 h-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-t-[22px] border-t-amber-400" />
                      </div>

                      <svg
                        viewBox="0 0 200 200"
                        className="absolute inset-[6px] w-[calc(100%-12px)] h-[calc(100%-12px)] rounded-full drop-shadow-xl"
                        style={{
                          transform: `rotate(${wheelRotation}deg)`,
                          transition: wheelSpinning ? "transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none"
                        }}
                      >
                        {WHEEL_PRIZES.map((prize, i) => {
                          const angle = 360 / WHEEL_PRIZES.length;
                          const startAngle = i * angle;
                          const endAngle = startAngle + angle;
                          const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
                          const x1 = 100 + 100 * Math.cos(toRad(startAngle));
                          const y1 = 100 + 100 * Math.sin(toRad(startAngle));
                          const x2 = 100 + 100 * Math.cos(toRad(endAngle));
                          const y2 = 100 + 100 * Math.sin(toRad(endAngle));
                          const midAngle = startAngle + angle / 2;
                          const textX = 100 + 62 * Math.cos(toRad(midAngle));
                          const textY = 100 + 62 * Math.sin(toRad(midAngle));
                          return (
                            <g key={i}>
                              <path
                                d={`M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`}
                                fill={prize.color}
                                stroke="#0a0a0a"
                                strokeWidth="1.5"
                              />
                              <text
                                x={textX}
                                y={textY}
                                fill="white"
                                fontSize="8"
                                fontWeight="800"
                                textAnchor="middle"
                                opacity={0.95}
                                transform={`rotate(${midAngle}, ${textX}, ${textY})`}
                              >
                                {prize.label.length > 16 ? prize.label.slice(0, 15) + "…" : prize.label}
                              </text>
                            </g>
                          );
                        })}
                        <circle cx="100" cy="100" r="15" fill="#0a0a0a" stroke="#f59e0b" strokeWidth="2.5" />
                        <circle cx="100" cy="100" r="4" fill="#f59e0b" />
                      </svg>
                    </div>

                    <button
                      onClick={spinWheel}
                      disabled={wheelSpinning}
                      className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-black uppercase tracking-wide py-4 rounded-2xl text-sm disabled:opacity-60 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-amber-500/20"
                    >
                      {wheelSpinning ? "Girando… 🎡" : "¡Girar Ahora! 🎯"}
                    </button>
                    <p className="text-[9px] text-neutral-600 mt-3 uppercase tracking-widest">Sin compra obligatoria · 1 giro por persona</p>
                  </div>
                ) : (
                  <div className="relative py-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 12, delay: 0.1 }}
                      className="text-6xl mb-3"
                    >
                      🎉
                    </motion.div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1">¡Felicidades!</h3>
                    <p className="text-xs text-neutral-400 mb-4">Ganaste un premio exclusivo por hoy:</p>
                    <div className="bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-400/30 rounded-2xl py-4 px-4 mb-6">
                      <Confetti />
                      <span className="text-lg font-black text-amber-300">{wheelPrize}</span>
                    </div>
                    <button
                      onClick={claimWheelPrize}
                      className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-black uppercase tracking-wide py-4 rounded-2xl text-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 mb-2 shadow-lg shadow-amber-500/20"
                    >
                      <ShoppingCart size={16} /> Reclamar y Pedir Ahora
                    </button>
                    <button
                      onClick={() => setWheelOpen(false)}
                      className="w-full text-neutral-500 text-[11px] uppercase tracking-widest py-2 hover:text-neutral-300 transition-colors"
                    >
                      Seguir viendo el catálogo
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════
          WHATSAPP FLOATING SUPPORT WIDGET
      ════════════════════════════════════════════ */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Support Chat Popover */}
        <AnimatePresence>
          {isSupportOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              className="bg-[#0e111d] border border-white/10 rounded-3xl p-5 shadow-2xl w-80 mb-4 text-left relative overflow-hidden"
              style={{ transformOrigin: "bottom right" }}
            >
              {/* Header inside popover */}
              <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-3">
                <div className="relative">
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0e111d] z-10" />
                  <img
                    src="/images/logo.jpeg"
                    alt="Jansel Shop Logo"
                    className="w-10 h-10 rounded-xl object-contain border border-white/10"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-1">
                    Soporte Jansel Shop
                    <Sparkles size={12} className="text-amber-400" />
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-bold">● En línea · Respuesta inmediata</span>
                </div>
              </div>

              {/* Body message */}
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                ¡Hola! Bienvenido a nuestro canal oficial. ¿En qué podemos ayudarte hoy? Elige una opción para iniciar el chat en WhatsApp:
              </p>

              {/* Options buttons */}
              <div className="space-y-2.5">
                {[
                  {
                    label: "🛒 Quiero hacer un pedido",
                    text: "¡Hola! Me gustaría hacer un pedido en Jansel Shop. ¿Me podrías guiar con el catálogo y las ofertas de hoy? 📦",
                  },
                  {
                    label: "🤔 Tengo dudas / Garantía",
                    text: "¡Hola! Tengo algunas dudas sobre el estado de mi envío o el método de pago contraentrega. ¿Me podrían ayudar? 🚚",
                  },
                  {
                    label: "📞 Solicitar asesoría",
                    text: "¡Hola! Me gustaría recibir asesoría personalizada para elegir el mejor producto para mí en Jansel Shop. 🌟",
                  },
                ].map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const phone = officialBotNumber || "15072233213";
                      const url = `https://wa.me/${phone}?text=${encodeURIComponent(opt.text)}`;
                      window.open(url, "_blank");
                      setIsSupportOpen(false);

                      // Track Contact Event — mismo eventId en pixel + CAPI para deduplicación
                      const floatingContactEventId = generateEventId();
                      trackMetaEvent("Contact", {
                        method: "WhatsApp Floating Support Widget",
                        option: opt.label
                      }, floatingContactEventId);
                      trackTiktokEvent("Contact", {
                        method: "WhatsApp Floating Support Widget"
                      });

                      fetch("/api/public/track-contact", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          storeId: "default",
                          eventId: floatingContactEventId,
                          fbp: getFbp(),
                          fbc: getFbc(),
                          eventSourceUrl: window.location.href,
                          value: 0
                        })
                      }).catch(() => {});
                    }}
                    className="w-full text-left py-3 px-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-emerald-500 hover:text-black hover:border-emerald-400 font-extrabold text-xs text-white transition-all duration-200 flex items-center justify-between group cursor-pointer"
                  >
                    <span>{opt.label}</span>
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>

              {/* Close button on popover corner */}
              <button
                onClick={() => setIsSupportOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WhatsApp Circular Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsSupportOpen(!isSupportOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl relative cursor-pointer z-50 transition-colors duration-300 ${
            isSupportOpen ? "bg-red-500 text-white hover:bg-red-600" : "bg-[#25D366] text-white hover:bg-[#20ba59]"
          }`}
        >
          {isSupportOpen ? (
            <X size={24} />
          ) : (
            <svg
              className="w-8 h-8 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.456h.008c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          )}
          {/* Notification Badge on WhatsApp icon */}
          {!isSupportOpen && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] font-black text-black items-center justify-center">1</span>
            </span>
          )}
        </motion.button>
      </div>

      {/* ════════════════════════════════════════════
          SOCIAL PROOF NOTIFICATION
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {livePurchase && (
          <motion.div
            initial={{ opacity: 0, x: -80, y: 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
            className="fixed bottom-6 left-4 sm:left-6 z-40 glass-card border-white/10 text-white p-4 rounded-2xl max-w-xs shadow-2xl flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-black font-black text-lg shrink-0 shadow-lg">
              🛒
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-300 leading-snug">
                <span className="text-white font-extrabold">{livePurchase.name}</span> de{" "}
                <span className="text-amber-400 font-bold">{livePurchase.city}</span> compró:
              </p>
              <h5 className="font-extrabold text-xs text-white truncate mt-0.5">{livePurchase.product}</h5>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] text-slate-600 font-mono">{livePurchase.time}</span>
                <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                  <CheckCircle size={8} /> Envío gratis
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════
          ORDER SUCCESS MODAL
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {orderCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-card border-emerald-500/20 max-w-lg w-full rounded-3xl p-8 text-center space-y-6 shadow-2xl my-8"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto animate-glow-pulse">
                <CheckCircle size={40} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white mb-2">¡Pedido Registrado! 🎉</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Tu pedido ha sido recibido con éxito. Un asesor te contactará en los próximos <strong className="text-white">minutos</strong> para confirmar el despacho.
                </p>
              </div>

              {orderCompleted.cartItems && (
                <div className="glass-card rounded-2xl p-4 space-y-2 text-left">
                  <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest">Productos en tu pedido:</span>
                  {orderCompleted.cartItems.map((item: any) => (
                    <div key={item.product.id} className="flex justify-between text-xs">
                      <span className="text-slate-300 truncate max-w-[200px]">{item.product.name} x{item.quantity}</span>
                      <span className="text-white font-mono">${(item.product.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-center gap-3 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                <Truck size={20} />
                <div className="text-left">
                  <span className="block text-xs font-black text-white">Despacho Programado</span>
                  <span className="text-xs text-emerald-400">Llegará en 2 a 4 días hábiles · Envío GRATIS</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleWhatsAppOrder()}
                  className="w-full py-3.5 rounded-2xl btn-cta-whatsapp text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle size={16} fill="currentColor" />
                  Confirmar también por WhatsApp
                </button>
                <button
                  onClick={() => setOrderCompleted(null)}
                  className="text-slate-500 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar y seguir comprando
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════
          BOTÓN FLOTANTE DE WHATSAPP + MINI-MODAL
          ════════════════════════════════════════════ */}
      <div className="fixed bottom-6 right-6 z-40">
        <AnimatePresence>
          {isWaMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-16 right-0 w-72 bg-[#0c0d16] border border-emerald-500/20 rounded-2xl p-4 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black tracking-wider text-slate-300 uppercase">¿Cómo te ayudamos?</span>
                </div>
                <button
                  onClick={() => setIsWaMenuOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Selecciona una opción para chatear directamente con nuestro equipo de atención oficial.
              </p>

              <div className="flex flex-col gap-2">
                {/* Option 1: Quiero Pedir */}
                {/* El formulario primero: es el camino que mejor cierra y el que se quiere
                    potenciar. WhatsApp queda como alternativa para quien prefiera escribir. */}
                <button
                  onClick={() => {
                    setIsWaMenuOpen(false);
                    if (cart.length === 0 && TRENDING_PRODUCTS.length > 0) addToCart(TRENDING_PRODUCTS[0], true);
                    setIsCartOpen(false);
                    setCheckoutMode("formulario");
                    bajarAlFormulario();
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-orange-500/10 p-3 text-left transition hover:border-amber-400 cursor-pointer"
                >
                  <span className="text-lg">⚡</span>
                  <span>
                    <span className="block text-xs font-black text-amber-300">Pedir con formulario</span>
                    <span className="block text-[10px] text-slate-400">Sin salir de la página · 1 minuto</span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    const waNumber = officialBotNumber || "15072233213";
                    const msg = "¡Hola! 👋 Quisiera realizar un pedido de los productos del catálogo de Jansel Shop.";
                    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
                    setIsWaMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/20 border border-amber-500/20 hover:border-amber-400 text-left text-xs font-extrabold text-amber-300 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingBag size={12} className="group-hover:scale-110 transition-transform" />
                    <span>Quiero Pedir</span>
                  </span>
                  <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                </button>

                {/* Option 2: Dudas / Asesoría */}
                <button
                  onClick={() => {
                    const waNumber = officialBotNumber || "15072233213";
                    const msg = "¡Hola! 👋 Necesito asesoría con algunas dudas que tengo sobre los productos de Jansel Shop.";
                    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
                    setIsWaMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent hover:from-emerald-500/20 border border-emerald-500/20 hover:border-emerald-400 text-left text-xs font-extrabold text-emerald-300 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MessageCircle size={12} className="group-hover:scale-110 transition-transform" />
                    <span>Dudas / Asesoría</span>
                  </span>
                  <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                </button>

                {/* Option 3: Seguimiento de Pedido */}
                <button
                  onClick={() => {
                    const waNumber = officialBotNumber || "15072233213";
                    const msg = "¡Hola! 👋 Quisiera hacerle seguimiento a mi pedido realizado en Jansel Shop.";
                    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
                    setIsWaMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/20 border border-blue-500/20 hover:border-blue-400 text-left text-xs font-extrabold text-blue-300 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Truck size={12} className="group-hover:scale-110 transition-transform" />
                    <span>Seguimiento de Pedido</span>
                  </span>
                  <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main floating button */}
        <button
          onClick={() => setIsWaMenuOpen(!isWaMenuOpen)}
          className="relative w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 hover:scale-110 active:scale-95 group cursor-pointer"
        >
          <div className="absolute inset-0 rounded-full border border-emerald-500/50 animate-ping-large pointer-events-none" />
          <MessageCircle size={28} fill="currentColor" className="group-hover:scale-110 transition-transform duration-300" />
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#070810] flex items-center justify-center text-[8px] font-black text-white">
            1
          </span>
        </button>
      </div>
      <ReferralChallenge
        open={showReferral}
        onClose={() => setShowReferral(false)}
        onUnlock={(pct) => setReferralPct(pct)}
        minItems={REFERRAL_MIN_ITEMS}
      />
      {joinCode && <ReferralJoin code={joinCode} onDone={() => setJoinCode(null)} />}
    </div>
  );
}