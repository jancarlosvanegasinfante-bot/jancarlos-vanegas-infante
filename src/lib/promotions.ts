export interface PromotionCombo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  productIds: string[];
  originalPrice: number;
  promoPrice: number;
  discountPercentage: number;
  badge: string;
}

export const ACTIVE_PROMOTIONS: PromotionCombo[] = [
  {
    id: "combo-kit-motero-completo",
    name: "Kit Motero Completo",
    tagline: "¡Soporte + Cargador + Candado Antirrobo!",
    description: "Todo lo que tu moto necesita en un solo pedido. Soporte impermeable con pantalla táctil para que uses el GPS sin mojar el celular, cargador rápido QC 3.0 con voltímetro para que nunca te quedes sin batería, y candado de manubrio de acero que bloquea el freno para que nadie te la lleve. Los tres esenciales que todo motero termina comprando por separado y más caro.",
    productIds: ["soporte-holder-moto", "cargador-celular-moto", "candado-moto-manubrio"],
    originalPrice: 185700,
    promoPrice: 155900,
    discountPercentage: 16,
    badge: "El Más Vendido 🏍️🔥"
  },
  {
    id: "combo-moto-esencial",
    name: "Moto Esencial",
    tagline: "¡Soporte Táctil + Cargador Rápido QC 3.0!",
    description: "El dúo básico que no te puede faltar. Soporte impermeable con rotación 360° y funda táctil para navegar con el GPS bajo lluvia, más cargador rápido con voltímetro digital para monitorear la batería de tu moto en tiempo real. Instalación en minutos.",
    productIds: ["soporte-holder-moto", "cargador-celular-moto"],
    originalPrice: 119800,
    promoPrice: 99900,
    discountPercentage: 17,
    badge: "Arranca Por Aquí ⚡"
  },
  {
    id: "combo-carro-impecable",
    name: "Carro Impecable",
    tagline: "¡Carpa Cobertor + Aspiradora Inalámbrica!",
    description: "Tu carro protegido por fuera y limpio por dentro. Carpa cobertor impermeable talla M que lo blinda del sol, la lluvia, el polvo y los rayos UV, más aspiradora de mano inalámbrica de succión potente con filtro lavable para dejar la cojinería y los tapetes como nuevos. Sin cables, sin excusas.",
    productIds: ["carpa-cobertor-carro", "aspiradora-de-mano"],
    originalPrice: 167800,
    promoPrice: 139900,
    discountPercentage: 17,
    badge: "Cuida Tu Inversión 🚗✨"
  },
  {
    id: "combo-desvare-total",
    name: "Desvare Total",
    tagline: "¡Iniciador de Batería + Aspiradora de Mano!",
    description: "No vuelvas a quedarte varado. Iniciador de batería inteligente 12V con tecnología Pulse Repair que carga, repara y arranca tu carro, camioneta o moto, más aspiradora inalámbrica para mantener el interior impecable mientras esperas. El kit que te saca del apuro a cualquier hora.",
    productIds: ["iniciador-de-bateria", "aspiradora-de-mano"],
    originalPrice: 187800,
    promoPrice: 155900,
    discountPercentage: 17,
    badge: "Tranquilidad en Carretera 🔋🚨"
  },
  {
    id: "combo-taller-en-casa",
    name: "Taller en Casa",
    tagline: "¡Mini Pulidora 19.000 RPM + Iniciador de Batería!",
    description: "Monta tu taller sin gastar una fortuna. Mini pulidora inalámbrica de 12V y hasta 19.000 RPM con disco de 115mm para cortar, pulir, desbastar y limpiar metal, acero y madera, más iniciador de batería inteligente con Pulse Repair. Potencia profesional en tus manos, sin cables que te estorben.",
    productIds: ["mini-pulidora-inalambrica", "iniciador-de-bateria"],
    originalPrice: 213800,
    promoPrice: 179900,
    discountPercentage: 16,
    badge: "Favorito de Técnicos 🛠️"
  },
  {
    id: "combo-creador-de-contenido",
    name: "Creador de Contenido",
    tagline: "¡Selfie Stick con Luz LED + Carga Magnética 3 en 1!",
    description: "Graba como profesional y nunca te quedes sin batería. Selfie stick trípode con luz LED regulable de 3 niveles, rotación 360° y control remoto Bluetooth hasta 10 metros, más soporte de carga magnética 3 en 1 de 15W que carga celular, audífonos y reloj al mismo tiempo. Del set a la mesa sin cables.",
    productIds: ["selfie-stick-tripode", "soporte-de-carga-magnetica"],
    originalPrice: 260800,
    promoPrice: 219900,
    discountPercentage: 16,
    badge: "Modo Creador 🎥💡"
  },
  {
    id: "combo-gamer-setup",
    name: "Gamer Setup",
    tagline: "¡Game Stick Retro 4K + Carga Magnética 15W!",
    description: "Arma tu rincón gamer completo. Consola Game Stick Retro M8 con salida 4K HD, 64GB y más de 10.000 juegos clásicos con 2 controles inalámbricos incluidos, más soporte de carga magnética 3 en 1 de 15W para tener el celular, los audífonos y el reloj siempre cargados mientras juegas. Conecta el HDMI y listo.",
    productIds: ["game-stick-retro-m8", "soporte-de-carga-magnetica"],
    originalPrice: 280800,
    promoPrice: 234900,
    discountPercentage: 16,
    badge: "Nostalgia en 4K 🎮🔥"
  }
];
