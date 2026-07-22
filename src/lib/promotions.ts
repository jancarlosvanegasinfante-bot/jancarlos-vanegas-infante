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
    id: "combo-herramientas-pro",
    name: "Combo Reparación Pro",
    tagline: "¡Atornillador + Compresor Inteligente!",
    description: "Llévate el Destornillador Eléctrico de alta precisión junto al Combo Compresor Inteligente Multifuncional + Linterna. ¡El kit definitivo para desvararte en casa o carretera!",
    productIds: ["destornillador-atornillador-electrico", "combo-compresor-linterna"],
    originalPrice: 256800,
    promoPrice: 219900,
    discountPercentage: 14,
    badge: "Favorito de Técnicos 🛠️"
  },
  {
    id: "combo-limpieza-vapor-donas",
    name: "Combo Hogar Impecable & Dulce",
    tagline: "¡Limpiadora a Vapor + Máquina de Donas X7!",
    description: "Mantén tu casa 100% desinfectada y libre de bacterias con la potente Limpiadora a Vapor, y consiente a tu familia con deliciosas donas calientes en minutos.",
    productIds: ["limpiadora-vapor", "maquina-donas-x7"],
    originalPrice: 249800,
    promoPrice: 209900,
    discountPercentage: 16,
    badge: "Hogar Feliz 🏠🍩"
  },
  {
    id: "combo-alerta-seguridad",
    name: "Combo Hogar Seguro 24/7",
    tagline: "¡Candado Alarma + Lámpara Solar Sensor!",
    description: "Protege tu hogar de intrusos. El Candado de Alarma de 110dB ahuyenta ladrones y la Lámpara Solar con Sensor Ever Brite ilumina tu fachada al detectar movimiento.",
    productIds: ["candado-alarma-grande", "lampara-led-sensor"],
    originalPrice: 162800,
    promoPrice: 139900,
    discountPercentage: 14,
    badge: "Protección Total 🔒💡"
  },
  {
    id: "combo-conectividad-total",
    name: "Combo Conectividad Total en Ruta",
    tagline: "¡Módem Wifi Router + Intercomunicador Y10!",
    description: "Sigue conectado vayas donde vayas. Módem router portátil 4G/5G de alta velocidad más el intercomunicador Bluetooth para cascos de moto con reducción de ruido.",
    productIds: ["modem-wifi-portatil", "inter-comunicador-y10"],
    originalPrice: 298800,
    promoPrice: 249900,
    discountPercentage: 16,
    badge: "Para Viajeros y Bikers 📶🏍️"
  },
  {
    id: "combo-auxilio-vial",
    name: "Combo Desvare Vial Extremo",
    tagline: "¡Compresor Cyclone + Cables de Inicio!",
    description: "¡No te quedes varado! Compresor Cyclone de doble cilindro para inflado rápido más cables reforzados de alta resistencia para iniciar baterías de vehículos.",
    productIds: ["compresor-aire-2cil", "cables-inicio-100"],
    originalPrice: 190800,
    promoPrice: 159900,
    discountPercentage: 16,
    badge: "Indispensable en Carretera 🚗🚨"
  },
  {
    id: "combo-estetica-lubristone",
    name: "Combo Brillo de Exhibición Lubristone",
    tagline: "¡Cera Premium M1 + Kit 3 Pasos!",
    description: "Recupera la pintura y partes negras de tu bólido. Combina la Cera M1 premium de cojinería/plásticos con el kit de renovación Lubristone de 3 pasos.",
    productIds: ["cera-m1-cojineria", "kit-renovacion-veh"],
    originalPrice: 166800,
    promoPrice: 139900,
    discountPercentage: 16,
    badge: "Brillo & Estética ✨🚗"
  },
  {
    id: "combo-viajero-comodo",
    name: "Combo Confort de Ruta",
    tagline: "¡Parasol Auto + Soporte Silicona + Ventilador Doble!",
    description: "Combate el calor insoportable. Un parasol de alta protección UV, soporte de silicona antideslizante para tu celular y ventilador doble ajustable de 360 grados.",
    productIds: ["parasol-vehiculo", "soporte-silicona-veh", "ventilador-doble-360"],
    originalPrice: 258700,
    promoPrice: 209900,
    discountPercentage: 19,
    badge: "Frescura & Comodidad 🌬️📱"
  },
  {
    id: "combo-carga-inteligente",
    name: "Combo Energía & Soporte Inteligente",
    tagline: "¡Inversor de Corriente + Holder Inalámbrico!",
    description: "Carga todos tus dispositivos. Inversor de corriente 12V a AC con puertos de carga flash USB más el holder de inducción automático para cargar sin cables.",
    productIds: ["convertidor-veh-carga", "holder-cargador-inalambr"],
    originalPrice: 246800,
    promoPrice: 209900,
    discountPercentage: 15,
    badge: "Poder Ilimitado ⚡🔋"
  },
  {
    id: "combo-carretera-seguro",
    name: "Combo Viajero de Ley",
    tagline: "¡Maletín Carretera + Alarma Universal!",
    description: "Cumple con las normas y cuida tu carro. Maletín reglamentario de carretera con todo el kit de seguridad más el Sistema de Alarma Universal de alta sensibilidad.",
    productIds: ["maletin-kit-carretera", "sistema-antirrobo-veh"],
    originalPrice: 163800,
    promoPrice: 139900,
    discountPercentage: 15,
    badge: "Seguridad & Ley 🚓📦"
  },
  {
    id: "combo-lavado-premium",
    name: "Combo Autolavado Premium en Casa",
    tagline: "¡Hidrolavadora Inalámbrica + Mini Aspiradora Gold!",
    description: "Ahórrate miles en autolavados. Hidrolavadora inalámbrica de 48V de alta presión más la mini aspiradora portátil Gold Edition de alta succión.",
    productIds: ["hidro-lavadora-48v", "mini-aspiradora-port"],
    originalPrice: 192800,
    promoPrice: 159900,
    discountPercentage: 17,
    badge: "Limpieza Total 💦🧼"
  },
  {
    "id": "combo-hogar-inteligente-desinfeccion",
    "name": "Combo Baño Organizado & Confort",
    "tagline": "¡Tina Plegable + Jabonera Transparente Doble!",
    "description": "El pack perfecto para renovar tu baño. La práctica tina plegable portátil (súper fácil de guardar) combinada con la jabonera autoadhesiva transparente de doble nivel para una organización impecable.",
    "productIds": ["tina-plegable", "jabonera-transparente-doble"],
    "originalPrice": 187800,
    "promoPrice": 159900,
    "discountPercentage": 15,
    "badge": "Hogar Organizado 🏠✨"
  },
  {
    "id": "combo-poder-limpieza",
    "name": "Combo Maestro Constructor",
    "tagline": "¡Sopladora Larga Inalámbrica + Mini Martillo!",
    "description": "Equípate con herramientas de alta resistencia. Sopladora de largo alcance con 2 baterías premium para limpiar aserrín y hojas, más el mini martillo de 8 oz con mango antideslizante de goma.",
    "productIds": ["sopladora-larga-inalambrica-2bat", "mini-martillo-8oz"],
    "originalPrice": 224800,
    "promoPrice": 189900,
    "discountPercentage": 15,
    "badge": "Kit de Construcción 🛠️⚡"
  },
  {
    "id": "combo-doble-diversion",
    "name": "Combo Super Diversión Infantil",
    "tagline": "¡Pista de Carros + Rifle Hidrogel SR079B!",
    "description": "El regalo supremo para los pequeños aventureros. Una increíble pista de carreras con loops de 360 grados de alta velocidad junto a la pistola de hidrogel automática SR079B.",
    "productIds": ["pista-de-carros", "pistola-hidrogel-sr079b"],
    "originalPrice": 287800,
    "promoPrice": 239900,
    "discountPercentage": 17,
    "badge": "Zona de Juegos 🎮👦"
  },
  {
    "id": "combo-salud-enfoque",
    "name": "Combo Súper Vitalidad & Enfoque",
    "tagline": "¡Shilajit Himalaya + Glucosamina MSM!",
    "description": "Recupera tu vigor físico y protege tus articulaciones. Combina el Shilajit líquido puro (rico en 84+ minerales) con el avanzado suplemento de Glucosamina, Condroitina y MSM.",
    "productIds": ["shilajit-1000ml", "glucosamina-chondroitin"],
    "originalPrice": 175800,
    "promoPrice": 149900,
    "discountPercentage": 15,
    "badge": "Salud Total 🌿💪"
  },
  {
    "id": "combo-cuidado-capilar-premium",
    "name": "Combo Alisado & Estilo Aguacate",
    "tagline": "¡Cepillo Plancha Aguacate + Cepillo Secador!",
    "description": "Estiliza tu cabello sin maltratarlo. Llévate el Kit Profesional Cepillo Secador + Plancha junto con el cepillo secador 3 en 1 con revestimiento enriquecido de aguacate y macadamia.",
    "productIds": ["cepillo-secador-plancha-aguacate", "cepillo-secador-aguacate-solo"],
    "originalPrice": 223800,
    "promoPrice": 189900,
    "discountPercentage": 15,
    "badge": "Belleza Profesional 💇‍♀️✨"
  },
  {
    "id": "combo-piloto-equipado",
    "name": "Combo Conductor Conectado",
    "tagline": "¡Portavasos Multifuncional + Cargador Dolphin 3A!",
    "description": "Mejora tu comodidad en ruta. Un organizador expansor de portavasos con rotación de 360 grados más un cargador rápido Sky Dolphin de 3 amperios de diseño compacto.",
    "productIds": ["porta-vaso-carro-multifuncional", "cargador-carro-sky-dolphin"],
    "originalPrice": 181800,
    "promoPrice": 149900,
    "discountPercentage": 17,
    "badge": "Full Accesorios Auto 🚗📱"
  },
  {
    "id": "combo-bienestar-femenino",
    "name": "Combo Bienestar & Energía Femenina",
    "tagline": "¡Bichota 500ml + FBMAX Energizante!",
    "description": "Fórmula integral para la mujer activa. Potencia tu belleza con colágeno y biotina de Bichota 500 ml, y eleva tu nivel de energía y quema calórica diaria con FBMAX 1000 ml.",
    "productIds": ["bichota-500ml", "fbmax-1000ml"],
    "originalPrice": 177800,
    "promoPrice": 149900,
    "discountPercentage": 16,
    "badge": "Mujer Radiante 👑🔋"
  }
];
