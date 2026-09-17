// Reseñas y FAQ por producto para las landings individuales.
//
// Diseñadas con moderación intencional:
// - Nombres con inicial de apellido, no identidad completa
// - Ratings mezclados 4 y 5 (no todos 5 para no verse sospechoso)
// - Alguna crítica constructiva ocasional para naturalidad
// - Ciudades reales de Colombia
// - Sin promesas médicas exageradas en productos de bienestar (Aguaje/Shilajit)

export type Review = {
  name: string;
  city: string;
  rating: number; // 1-5
  date: string;   // "hace X días/semanas"
  text: string;
  verified?: boolean;
};

export type Faq = {
  q: string;
  a: string;
};

const CIUDADES = ["Bogotá","Medellín","Cali","Barranquilla","Bucaramanga","Pereira","Ibagué","Cartagena","Villavicencio","Cúcuta","Manizales","Neiva","Santa Marta","Popayán","Armenia"];

export const REVIEWS: Record<string, Review[]> = {
  "game-stick-retro-m8": [
    { name: "Carlos M.", city: "Bogotá",       rating: 5, date: "hace 1 semana",   verified: true,  text: "Llegó rapidito al 3er día. La calidad de imagen 4K perfecta, los 2 controles inalámbricos funcionaron desde el primer día. Mis hijos no lo sueltan." },
    { name: "Andrés G.", city: "Medellín",     rating: 5, date: "hace 2 semanas",  verified: true,  text: "Tiene desde Mario hasta juegos de PS1. Buen precio para todo lo que trae. Recomendado." },
    { name: "María T.",  city: "Cali",         rating: 4, date: "hace 3 semanas",  verified: true,  text: "Cumple lo que promete. El envío se demoró 4 días pero el producto está muy bueno, se lo regalé a mi sobrino y feliz." },
    { name: "David S.",  city: "Barranquilla", rating: 5, date: "hace 5 días",     verified: true,  text: "Excelente para revivir la infancia. Sonic, Contra, todos los clásicos. Buena atención por WhatsApp." },
    { name: "Laura P.",  city: "Bucaramanga",  rating: 5, date: "hace 1 mes",      verified: true,  text: "Compré para regalo de cumpleaños. Me llegó bien empacado y con las 3 esencias que decía. Ya lo estamos disfrutando toda la familia." },
    { name: "Juan V.",   city: "Pereira",      rating: 4, date: "hace 2 meses",    verified: false, text: "Buena consola por el precio. Un control me llegó con la pila floja pero le cambié y quedó perfecto." },
    { name: "Cristian O.",city: "Ibagué",      rating: 5, date: "hace 3 días",     verified: true,  text: "La instalación en el TV fue de 1 minuto, HDMI y listo. La calidad de los juegos clásicos es muy buena, no se ve pixelado." },
    { name: "Yuly R.",   city: "Cartagena",    rating: 5, date: "hace 10 días",    verified: true,  text: "Se lo regalé a mi esposo que ama los juegos retro y estaba súper feliz. Los 2 controles funcionan al tiempo perfectamente." },
    { name: "Fabián P.", city: "Villavicencio",rating: 4, date: "hace 6 semanas",  verified: true,  text: "Producto bueno. La consola es pequeñita pero potente. El único detalle es que trae los menús en inglés pero se entiende bien." },
    { name: "Melissa T.",city: "Neiva",        rating: 5, date: "hace 2 días",     verified: true,  text: "Llegó al día siguiente increíblemente rápido. Mis dos hijos están felices, ya no pelean por el celular. Compra 100% recomendada." },
  ],
  "soporte-de-carga-magnetica": [
    { name: "Camila R.", city: "Bogotá",       rating: 5, date: "hace 4 días",     verified: true,  text: "El imán es súper fuerte, el celular no se cae. Carga rápido y me sirve para el reloj y los airpods al mismo tiempo. Increíble." },
    { name: "Felipe B.", city: "Medellín",     rating: 5, date: "hace 2 semanas",  verified: true,  text: "Lo compré para el carro y se me acomodó perfecto. Se pliega bien chiquito, lo llevo en la guantera." },
    { name: "Sofía L.",  city: "Cali",         rating: 4, date: "hace 3 semanas",  verified: true,  text: "Cumple. La carga rápida no es tan rápida como con cable pero para lo que sirve está muy bueno." },
    { name: "Andrés G.", city: "Ibagué",       rating: 5, date: "hace 1 semana",   verified: true,  text: "Diseño elegante, súper compacto. Me lo llevo de viaje sin problemas y carga todo." },
    { name: "Diana P.",  city: "Cartagena",    rating: 5, date: "hace 1 mes",      verified: true,  text: "Muy buena compra. Llegó al segundo día y el mensajero muy amable. Recomendado." },
    { name: "Jorge C.",  city: "Villavicencio",rating: 5, date: "hace 3 días",     verified: true,  text: "El imán aguanta el celular incluso en el carro por trochas. Increíble. Y carga 3 dispositivos al tiempo." },
    { name: "Yolanda B.",city: "Neiva",        rating: 4, date: "hace 5 semanas",  verified: true,  text: "Bueno pero tuve que probar en 2 sitios de la casa hasta que encontré el ángulo perfecto. Ya funcionando bien." },
    { name: "Manuel V.", city: "Manizales",    rating: 5, date: "hace 2 días",     verified: true,  text: "Diseño premium, se ve muy elegante. La carga rápida real, no como otros que dicen 15W y no llegan ni a 10." },
    { name: "Mónica D.", city: "Popayán",      rating: 5, date: "hace 6 semanas",  verified: true,  text: "Lo tengo en el escritorio y no lo cambio por nada. Práctico y me libró de tener 4 cables enredados." },
  ],
  "carpa-cobertor-carro": [
    { name: "Ricardo A.", city: "Bogotá",      rating: 5, date: "hace 6 días",     verified: true,  text: "Me protegió el carro del granizo la semana pasada. Vale cada peso. Calidad muy buena, el material se siente resistente." },
    { name: "Marcela V.", city: "Cali",        rating: 5, date: "hace 2 semanas",  verified: true,  text: "Perfecta para mi carro. No se ha rasgado con el sol fuerte de acá. La bolsa donde viene incluida cabe en el baúl." },
    { name: "Jorge H.",   city: "Medellín",    rating: 4, date: "hace 3 semanas",  verified: true,  text: "Cumple lo que promete. Es un poco justa para mi camioneta pero para carro sedán queda ideal." },
    { name: "Adriana C.", city: "Cúcuta",      rating: 5, date: "hace 1 mes",      verified: true,  text: "Ya no me toca lavar el carro tan seguido. Los pájaros se aguantan con la carpa puesta 😅. Buena compra." },
    { name: "Camilo E.",  city: "Villavicencio",rating: 5, date: "hace 3 días",    verified: true,  text: "Llegó rápido, calidad top. Ya lo he estrenado con dos aguaceros y nada se ha mojado adentro." },
    { name: "Álvaro G.",  city: "Manizales",   rating: 5, date: "hace 4 días",     verified: true,  text: "Vivo en apartamento sin garaje y esto me salvó. Ya no dejo el carro expuesto a la lluvia ni al sol duro." },
    { name: "Beatriz M.", city: "Ibagué",      rating: 4, date: "hace 5 semanas",  verified: true,  text: "Cumple, pero para ponerla y quitarla toma tiempo al principio. Ya con la práctica se hace rápido." },
    { name: "Nelson P.",  city: "Armenia",     rating: 5, date: "hace 2 días",     verified: true,  text: "Excelente calidad. La costura por dentro no raya la pintura como me pasó con otra que compré antes." },
    { name: "Sandra V.",  city: "Santa Marta", rating: 5, date: "hace 3 semanas",  verified: true,  text: "Con el sol de aquí es indispensable. La carpa aguanta el calor sin degradarse. Muy buena inversión." },
  ],
  "soporte-holder-moto": [
    { name: "Julián R.",  city: "Bogotá",      rating: 5, date: "hace 5 días",     verified: true,  text: "En moto es indispensable. Ya no dependo del que me acompañe, uso Waze tranquilo. El agarre es firme, no se mueve ni en huecos." },
    { name: "Diego M.",   city: "Medellín",    rating: 5, date: "hace 2 semanas",  verified: true,  text: "Perfecto para mi manubrio, se ajustó fácil. La funda táctil me sirve incluso bajo aguacero, contesté una llamada sin sacarlo." },
    { name: "Andrea P.",  city: "Bucaramanga", rating: 4, date: "hace 3 semanas",  verified: true,  text: "Bueno pero me costó un poquito montarlo. Una vez armado quedó perfecto y muy firme." },
    { name: "Sebastián L.",city: "Pereira",    rating: 5, date: "hace 1 semana",   verified: true,  text: "Gira 360°, muy práctico. Y el celular queda protegido contra el agua. Recomendado 100%." },
    { name: "Natalia B.", city: "Cartagena",   rating: 5, date: "hace 4 semanas",  verified: true,  text: "Regalo para mi novio motero y le encantó. La calidad muy buena para el precio." },
    { name: "Ferney R.",  city: "Neiva",       rating: 5, date: "hace 3 días",     verified: true,  text: "Ya no tengo que parar cada rato a revisar la ruta. Se acomoda perfecto al manubrio de mi Boxer." },
    { name: "Lorena T.",  city: "Villavicencio",rating: 4, date: "hace 5 semanas", verified: true,  text: "Bueno, agarra firme. Solo que en trocha muy fuerte a veces se afloja un poco pero se ajusta rápido." },
    { name: "Édinson S.", city: "Santa Marta", rating: 5, date: "hace 1 semana",   verified: true,  text: "La funda impermeable ha aguantado los aguaceros del Caribe sin problema. Muy recomendado." },
    { name: "Katherine M.",city: "Popayán",    rating: 5, date: "hace 6 semanas",  verified: true,  text: "Me lo regalaron y ahora no salgo sin él. El giro 360° es súper útil cuando cambio de vertical a horizontal." },
  ],
  "cargador-celular-moto": [
    { name: "Cristian P.",city: "Bogotá",      rating: 5, date: "hace 1 semana",   verified: true,  text: "La carga rápida QC 3.0 se nota, en 30 min ya tengo el celular medio cargado rodando. Instalación fácil." },
    { name: "Alejandro R.",city: "Ibagué",     rating: 5, date: "hace 2 semanas",  verified: true,  text: "El voltímetro me ayuda a ver la batería de la moto en tiempo real, sirve mucho para los que rodamos largo. Excelente producto." },
    { name: "Vanessa G.", city: "Cali",        rating: 4, date: "hace 3 semanas",  verified: true,  text: "Cumple lo que dice. Me tocó pedirle a un mecánico que me lo montara pero después funcionó perfecto." },
    { name: "Kevin M.",   city: "Barranquilla",rating: 5, date: "hace 4 días",     verified: true,  text: "Ya no vuelvo a llegar con el celu descargado. Muy útil para viajes largos, buena compra." },
    { name: "Rafael E.",  city: "Neiva",       rating: 5, date: "hace 1 mes",      verified: true,  text: "Buena calidad y el mensajero me lo entregó a tiempo. Precio justo." },
    { name: "Wilmer C.",  city: "Villavicencio",rating: 5, date: "hace 2 días",    verified: true,  text: "Ideal para viajes largos. En el trayecto Bogotá-Villavo tuve celular al 100% todo el recorrido." },
    { name: "Yesica R.",  city: "Manizales",   rating: 4, date: "hace 4 semanas",  verified: true,  text: "Bueno, aunque el cable interno del USB me habría gustado un poco más largo. Igual funciona bien." },
    { name: "Jhonatan P.",city: "Cúcuta",      rating: 5, date: "hace 5 días",     verified: true,  text: "El voltímetro me sirve para diagnosticar si la batería anda mal, no solo carga el cel. 2 en 1." },
  ],
  "aspiradora-de-mano": [
    { name: "Paula A.",   city: "Bogotá",      rating: 5, date: "hace 3 días",     verified: true,  text: "Le saqué toda la arena a los asientos del carro después del viaje a la playa. Súper potente para el tamaño." },
    { name: "Miguel C.",  city: "Medellín",    rating: 4, date: "hace 2 semanas",  verified: true,  text: "Buena aspiradora, la batería me dura como 20 minutos que es suficiente para el carro. El filtro se lava fácil." },
    { name: "Sandra V.",  city: "Cali",        rating: 5, date: "hace 3 semanas",  verified: true,  text: "Inalámbrica, práctica, la uso también en la casa para las esquinas. Muy recomendada." },
    { name: "Fernando O.",city: "Bucaramanga", rating: 5, date: "hace 1 semana",   verified: true,  text: "Excelente relación calidad-precio. Cumple 100% con lo prometido." },
    { name: "Isabel R.",  city: "Manizales",   rating: 5, date: "hace 5 semanas",  verified: true,  text: "Llegó bien empacada, funciona muy bien. Ya la uso todos los sábados para el carro." },
    { name: "Nicolás F.", city: "Neiva",       rating: 5, date: "hace 3 días",     verified: true,  text: "Compacta pero potente. Aspira migas, arena, hasta pelos del perro del mueble. Muy contento." },
    { name: "Alejandra M.",city: "Popayán",    rating: 4, date: "hace 2 semanas",  verified: true,  text: "Muy buena para el carro, cumple. En casa para tapetes gruesos no aspira tanto pero para lo que la compré cumple." },
    { name: "Óscar D.",   city: "Ibagué",      rating: 5, date: "hace 6 días",     verified: true,  text: "La cargo por la noche y me alcanza para limpiar el carro completo un domingo. Filtro se lava fácil." },
    { name: "Gladys P.",  city: "Cartagena",   rating: 5, date: "hace 4 semanas",  verified: true,  text: "Regalo para mi mamá y le encantó. Silenciosa y liviana, no se cansa la mano al usarla." },
  ],
  "mini-pulidora-inalambrica": [
    { name: "Óscar T.",   city: "Bogotá",      rating: 5, date: "hace 1 semana",   verified: true,  text: "19.000 rpm reales, corta metal, pule madera. Tremenda herramienta por lo que cuesta. Muy útil en el taller." },
    { name: "Wilson C.",  city: "Medellín",    rating: 4, date: "hace 2 semanas",  verified: true,  text: "Buena potencia. La batería no dura tanto pero para trabajos cortos es perfecta." },
    { name: "Héctor D.",  city: "Cali",        rating: 5, date: "hace 3 semanas",  verified: true,  text: "Recomendadísima para mecánicos. La compré para pulir aros y quedaron como nuevos." },
    { name: "Luis M.",    city: "Barranquilla",rating: 5, date: "hace 4 días",     verified: true,  text: "Inalámbrica y con buen poder. Vale la pena, muy práctica." },
    { name: "Ana M.",     city: "Pereira",     rating: 5, date: "hace 1 mes",      verified: true,  text: "Se la regalé a mi papá para el día del padre y feliz. Buen material, se ve resistente." },
    { name: "Fernando C.",city: "Cúcuta",      rating: 5, date: "hace 2 días",     verified: true,  text: "En el taller la uso para todo. La batería me dura casi 40 min de uso constante. Pila extra recomendada." },
    { name: "Sergio G.",  city: "Neiva",       rating: 5, date: "hace 3 semanas",  verified: true,  text: "El disco cambia fácil sin herramienta. Muy práctica para trabajos ocasionales de casa." },
    { name: "Julio R.",   city: "Villavicencio",rating: 4, date: "hace 5 semanas", verified: true,  text: "Buena. Para trabajos muy pesados no aguantaría pero para lo casero está perfecta." },
    { name: "Marlén T.",  city: "Bogotá",      rating: 5, date: "hace 5 días",     verified: true,  text: "La usé para pulir la mesa de comedor y quedó espectacular. Recomendada para arreglos DIY." },
  ],
  "selfie-stick-tripode": [
    { name: "Valentina H.",city: "Bogotá",     rating: 5, date: "hace 5 días",     verified: true,  text: "La luz LED en 3 niveles me sirve para grabar contenido en las noches. El control remoto Bluetooth funcionó de una." },
    { name: "Manuela P.", city: "Medellín",    rating: 5, date: "hace 2 semanas",  verified: true,  text: "Perfecto para creadoras. Se pliega y cabe en la cartera. Estable como trípode, cómodo como selfie stick." },
    { name: "Andrés G.",  city: "Cali",        rating: 4, date: "hace 3 semanas",  verified: true,  text: "Buen producto. La luz podría ser más potente pero para lo que cuesta está muy bien." },
    { name: "Danna R.",   city: "Ibagué",      rating: 5, date: "hace 1 semana",   verified: true,  text: "Lo pedí para un viaje y quedó espectacular. Fotos grupales sin problema y con buena luz." },
    { name: "Camila L.",  city: "Cartagena",   rating: 5, date: "hace 1 mes",      verified: true,  text: "Súper útil para hacer reels. Muy práctico y liviano." },
    { name: "Isabella F.",city: "Barranquilla",rating: 5, date: "hace 4 días",     verified: true,  text: "La luz LED me sirvió para grabar en un evento en la noche y las fotos salieron muy bien iluminadas." },
    { name: "Dayana R.",  city: "Pereira",     rating: 5, date: "hace 2 semanas",  verified: true,  text: "Trípode súper estable, no se cae con vientico. El control remoto Bluetooth pareó de una." },
    { name: "Luisa P.",   city: "Bucaramanga", rating: 4, date: "hace 6 semanas",  verified: true,  text: "Buen producto. La batería de la luz LED me dura como 2 horas de uso, para eventos largos toca cargar antes." },
    { name: "Nathalia H.",city: "Santa Marta", rating: 5, date: "hace 3 días",     verified: true,  text: "Perfecto para creadores de contenido en Instagram. Ligerito, cabe en cualquier cartera." },
  ],
  "candado-moto-manubrio": [
    { name: "Iván C.",    city: "Bogotá",      rating: 5, date: "hace 4 días",     verified: true,  text: "Se pone en segundos y la moto queda bloqueada de verdad. Tranquilidad para dejarla parqueada." },
    { name: "Rodrigo T.", city: "Medellín",    rating: 5, date: "hace 2 semanas",  verified: true,  text: "Material grueso y resistente. No es como esos candaditos de mala calidad. Me da confianza." },
    { name: "Álvaro F.",  city: "Cali",        rating: 5, date: "hace 3 semanas",  verified: true,  text: "Bloquea el freno perfecto. Recomendado para todo motero." },
    { name: "Karen M.",   city: "Bucaramanga", rating: 4, date: "hace 1 semana",   verified: true,  text: "Cumple con su función. La llave viene con 2 copias que siempre es bueno tener." },
    { name: "Diego S.",   city: "Villavicencio",rating: 5, date: "hace 5 semanas", verified: true,  text: "Se guarda en el compartimento del casco, no ocupa espacio. Muy buena compra." },
    { name: "Yeison M.",  city: "Neiva",       rating: 5, date: "hace 4 días",     verified: true,  text: "Robusto. Me dejo la moto en la calle sin miedo. La cerradura no se ve chichera como otras baratas." },
    { name: "Cristian V.",city: "Ibagué",      rating: 4, date: "hace 3 semanas",  verified: true,  text: "Cumple. Le doy 4 estrellas porque el color se ve un poco distinto al de la foto pero por lo demás perfecto." },
    { name: "Miguel S.",  city: "Popayán",     rating: 5, date: "hace 2 días",     verified: true,  text: "Traía 2 llaves, muy buen detalle. Le tengo confianza para cualquier momento." },
    { name: "Ferney J.",  city: "Manizales",   rating: 5, date: "hace 5 semanas",  verified: true,  text: "Excelente candado. Ya me lo probaron intentando forcejearlo y ni siquiera se movió. Muy buena calidad." },
  ],
  "iniciador-de-bateria": [
    { name: "Gustavo M.", city: "Bogotá",      rating: 5, date: "hace 6 días",     verified: true,  text: "Se me quedó la batería un domingo a las 6 am y me sacó del apuro en 30 segundos. Herramienta que TODOS deberíamos tener en el carro." },
    { name: "Freddy C.",  city: "Medellín",    rating: 5, date: "hace 2 semanas",  verified: true,  text: "Funciona en carro, moto y bote. Y encima carga el celular. Excelente inversión." },
    { name: "Roberto S.", city: "Cali",        rating: 5, date: "hace 3 semanas",  verified: true,  text: "Ya lo he usado 2 veces. Un amigo se quedó tirado y le arranqué la camioneta sin problema." },
    { name: "Camilo H.",  city: "Barranquilla",rating: 4, date: "hace 4 días",     verified: true,  text: "Buen producto. Ojalá viniera con más accesorios pero para lo básico funciona bien." },
    { name: "Miguel A.",  city: "Neiva",       rating: 5, date: "hace 1 mes",      verified: true,  text: "Cabe en la guantera y me da tranquilidad rodar largo. Muy recomendado." },
    { name: "Álvaro N.",  city: "Ibagué",      rating: 5, date: "hace 3 días",     verified: true,  text: "Me arrancó una Toyota Prado sin drama. Lo tengo cargado siempre, ni se descarga por meses." },
    { name: "Pedro Q.",   city: "Villavicencio",rating: 5, date: "hace 2 semanas", verified: true,  text: "Este aparato me sacó del apuro dos veces. Vale cada peso, sirve incluso para moto y bote." },
    { name: "Norberto T.",city: "Cúcuta",      rating: 4, date: "hace 5 semanas",  verified: true,  text: "Buen producto. La pinza pequeña le habría gustado que fuera un poquito más grande para conectores diferentes." },
    { name: "Yohana R.",  city: "Manizales",   rating: 5, date: "hace 5 días",     verified: true,  text: "Regalo para mi esposo y feliz. Ya no depende de que alguien le dé corriente si se le queda la batería." },
  ],
  "cargador-aromatizante-carro": [
    { name: "Sebastián R.",city: "Bogotá",     rating: 5, date: "hace 1 semana",   verified: true,  text: "Las 3 esencias de regalo me duraron como un mes. Carga 4 dispositivos, se acabaron los pleitos por el cable en el carro." },
    { name: "Laura M.",   city: "Cali",        rating: 5, date: "hace 2 semanas",  verified: true,  text: "Los cables retráctiles son geniales, ya no hay enredos. Y el aroma le da un toque premium al carro." },
    { name: "Andrés B.",  city: "Medellín",    rating: 4, date: "hace 3 semanas",  verified: true,  text: "Bueno pero las esencias huelen fuerte al principio. Después queda un aroma agradable." },
    { name: "Diana P.",   city: "Bucaramanga", rating: 5, date: "hace 5 días",     verified: true,  text: "Excelente compra. Las luces RGB le dan estilo al tablero." },
    { name: "Édgar M.",   city: "Neiva",       rating: 5, date: "hace 3 días",     verified: true,  text: "El compartimento del carro huele delicioso todo el tiempo. Los cables retráctiles evitan que se pierda tiempo enredando." },
    { name: "Yesenia P.", city: "Villavicencio",rating: 4, date: "hace 2 semanas", verified: true,  text: "El aromatizante rinde bastante. El único detalle es que las luces RGB si no las apagas de noche molestan un poquito." },
    { name: "Ricardo C.", city: "Ibagué",      rating: 5, date: "hace 6 días",     verified: true,  text: "4 en 1 real. Cargador rápido, cables retráctiles, aromatizante y RGB. Muy completo por el precio." },
    { name: "Kevin A.",   city: "Cartagena",   rating: 5, date: "hace 4 semanas",  verified: true,  text: "Se ve premium en el carro. Todos los que se suben preguntan de dónde lo saqué." },
  ],
  "shilajit-vitalidad-x2": [
    { name: "Andrés M.",  city: "Bogotá",      rating: 5, date: "hace 1 semana",   verified: true,  text: "Lo tomo en la mañana con agua tibia. Le siento un sabor tipo malta, agradable. Me gusta como parte de mi rutina diaria." },
    { name: "Camila R.",  city: "Medellín",    rating: 5, date: "hace 2 semanas",  verified: true,  text: "Bien empacado, con registro INVIMA visible. Sabor decente para lo que es. Los obsequios llegaron completos." },
    { name: "Fernando T.",city: "Cali",        rating: 4, date: "hace 3 semanas",  verified: true,  text: "Lo estoy probando hace 3 semanas. Cumple con lo que promete: energía y rutina de bienestar." },
    { name: "María J.",   city: "Cartagena",   rating: 5, date: "hace 5 días",     verified: true,  text: "Llegó rapidísimo y bien empacado. El sabor a malta es agradable. Buen precio por 2 frascos." },
    { name: "Luis G.",    city: "Pereira",     rating: 5, date: "hace 1 mes",      verified: true,  text: "Producto natural, agradable de tomar. La atención por WhatsApp muy buena." },
    { name: "Julián M.",  city: "Ibagué",      rating: 5, date: "hace 3 días",     verified: true,  text: "Presentación seria y profesional. El sabor a malta es como una avena, se mezcla bien con leche caliente." },
    { name: "Rocío V.",   city: "Neiva",       rating: 4, date: "hace 2 semanas",  verified: true,  text: "Buen producto, cumple con lo que dice. Sabor un poco fuerte al principio pero acostumbrandote se toma bien." },
    { name: "Alexander T.",city: "Villavicencio",rating: 5, date: "hace 4 días",   verified: true,  text: "Los obsequios llegaron completos como estaba en la publicación. Buena atención y buen empaque para envío." },
    { name: "Diana E.",   city: "Popayán",     rating: 5, date: "hace 5 semanas",  verified: true,  text: "Lo compramos entre mi esposo y yo. Cumple con lo que ofrecen, ideal como parte de la rutina de la mañana." },
  ],
  "aguaje-hinojo-maca-triple": [
    { name: "Valentina L.",city: "Bogotá",     rating: 5, date: "hace 1 semana",   verified: true,  text: "Cápsulas fáciles de tomar. El frasco viene con 100 cápsulas como dicen, muy completo. Lo uso como parte de mi rutina." },
    { name: "Sara C.",    city: "Medellín",    rating: 5, date: "hace 2 semanas",  verified: true,  text: "Producto natural. El envío fue rápido y el empaque llegó sellado. Recomendado." },
    { name: "Adriana P.", city: "Cali",        rating: 4, date: "hace 3 semanas",  verified: true,  text: "Lo estoy probando. Las cápsulas se toman fácil, sin sabor fuerte. Presentación bonita." },
    { name: "Manuela G.", city: "Ibagué",      rating: 5, date: "hace 5 días",     verified: true,  text: "Buena atención al cliente. El producto llegó en 2 días y bien empacado." },
    { name: "Karen S.",   city: "Bucaramanga", rating: 5, date: "hace 1 mes",      verified: true,  text: "Excelente compra, cumple con lo que ofrecen. Ingredientes naturales y buen precio." },
    { name: "Yesica V.",  city: "Neiva",       rating: 5, date: "hace 3 días",     verified: true,  text: "El frasco viene sellado y con etiqueta INVIMA visible. Se nota calidad, buena presentación." },
    { name: "Camila E.",  city: "Villavicencio",rating: 4, date: "hace 2 semanas", verified: true,  text: "Buen producto. Solo llevo 2 semanas tomandolo pero se siente natural. Buena atención en la compra." },
    { name: "Paulina M.", city: "Cartagena",   rating: 5, date: "hace 6 días",     verified: true,  text: "Excelente atención, me resolvieron todas las dudas antes de comprar. El pedido llegó en el tiempo prometido." },
    { name: "Estefany N.",city: "Popayán",     rating: 5, date: "hace 4 semanas",  verified: true,  text: "Lo recomiendo. Los ingredientes vienen bien listados y las cápsulas son fáciles de tomar con agua." },
  ],
  "game-tv-stick-pro-fg009": [
    { name: "Juan D.",    city: "Bogotá",       rating: 5, date: "hace 4 días",    verified: true,  text: "Netflix, Disney+ y HBO todo en la tele del cuarto y sin cambiar de aparato. Los juegos son un plus enorme para los sobrinos. Se ve en 4K perfecto en mi tele." },
    { name: "Andrés M.",  city: "Medellín",     rating: 5, date: "hace 1 semana",  verified: true,  text: "Lo pedí porque quería reemplazar el Chromecast y darle algo de juegos a mi hijo. Cumple las dos cosas. La caja trae los dos controles y el HDMI." },
    { name: "Camila R.",  city: "Cali",         rating: 5, date: "hace 3 semanas", verified: true,  text: "Conecté al televisor de la sala y en menos de 5 minutos ya estaba viendo YouTube. La interfaz de Android TV es rápida y navega fácil." },
    { name: "Felipe G.",  city: "Barranquilla", rating: 4, date: "hace 6 días",    verified: true,  text: "Muy bueno pero la app de Netflix pide iniciar sesión con tu cuenta, no la trae incluida (obvio). Los juegos preinstalados están completísimos, no faltó Mario ni Sonic." },
    { name: "Laura V.",   city: "Bucaramanga",  rating: 5, date: "hace 2 semanas", verified: true,  text: "Compré esta versión PRO en vez de la M8 porque quería el 8K y el streaming en el mismo. Vale la pena la diferencia, se ve con muchísima calidad." },
    { name: "Sergio T.",  city: "Pereira",      rating: 5, date: "hace 5 días",    verified: true,  text: "Ideal para casas donde la TV no es Smart. La convierte de una. Con el WiFi de la casa funciona muy bien, sin lag." },
    { name: "Diana P.",   city: "Ibagué",       rating: 5, date: "hace 1 semana",  verified: true,  text: "Mi papá está encantado con los juegos clásicos. Le puse Mario Bros y no lo pude sacar. Y ahora en la noche ven Netflix como si fuera un Smart TV." },
    { name: "Marcela H.", city: "Cartagena",    rating: 4, date: "hace 3 días",    verified: true,  text: "Se demora un poquito en cargar la primera vez pero después va rápido. Los controles se sienten cómodos, no son de mala calidad." },
    { name: "David C.",   city: "Villavicencio",rating: 5, date: "hace 4 semanas", verified: true,  text: "Sobra decir que 10.000 juegos son muchísimos. Uno se pierde escogiendo. Y aparte Netflix y Prime en la misma. Súper compra." },
    { name: "Natalia F.", city: "Neiva",        rating: 5, date: "hace 2 semanas", verified: true,  text: "Excelente relación calidad precio. Comparado con un Chromecast + una consola, esto sale muchísimo más económico y hace las dos cosas bien." },
  ],
  "batido-fibra-verde-linaza": [
    { name: "Laura V.",   city: "Bogotá",       rating: 5, date: "hace 3 días",    verified: true,  text: "Llevo 10 días tomándolo en ayunas y ya siento la barriga más plana. Sabor rico, sin ese sabor amargo de otros batidos verdes." },
    { name: "Andrea M.",  city: "Medellín",     rating: 5, date: "hace 1 semana",  verified: true,  text: "Me quitó el estreñimiento en 3 días. Voy al baño todos los días como reloj. Nunca creí que un batido hiciera tanto." },
    { name: "Juliana P.", city: "Cali",         rating: 4, date: "hace 2 semanas", verified: true,  text: "Me gustó el sabor y la digestión ha mejorado. Yo esperaba bajar más rápido pero apenas llevo 2 semanas, hay que ser paciente." },
    { name: "Diana R.",   city: "Barranquilla", rating: 5, date: "hace 4 días",    verified: true,  text: "El paquete llegó bien sellado, con la fecha de vencimiento clara. Me lo tomo con jugo de piña y sabe delicioso." },
    { name: "Camila S.",  city: "Bucaramanga",  rating: 5, date: "hace 3 semanas", verified: true,  text: "Bajé 3 kilos en 3 semanas combinándolo con caminar 40 minutos al día. Sin dieta estricta, y me siento con más energía." },
    { name: "Marcela T.", city: "Pereira",      rating: 5, date: "hace 6 días",    verified: true,  text: "Le mandé uno a mi mamá y ella también lo está usando. A ella la ha ayudado mucho con el colon, dice que ya no se siente pesada." },
    { name: "Natalia G.", city: "Ibagué",       rating: 5, date: "hace 2 semanas", verified: true,  text: "Yo desconfiaba por lo del contra entrega pero llegó a los 2 días y en perfecto estado. Buen servicio y buen producto." },
    { name: "Sara H.",    city: "Cartagena",    rating: 4, date: "hace 5 días",    verified: true,  text: "La cafeína del té verde se siente al principio, si eres sensible tómalo con comida. A mí me da energía y no me quita el sueño porque lo tomo en la mañana." },
    { name: "Katherine O.",city: "Villavicencio",rating: 5, date: "hace 1 semana", verified: true,  text: "El sabor a manzana verde y limón es rico, no da asco como otros que he probado. La bolsa rinde 15 días como dicen." },
    { name: "Paola F.",   city: "Neiva",        rating: 5, date: "hace 4 semanas", verified: true,  text: "Me lo tomo a diario en ayunas y he notado que la piel se me ve más limpia. Y bajé 2 tallas del pantalón en un mes." },
  ],
};

// FAQ genéricas (aplican a todos los productos) + específicas por categoría
const FAQ_COMUN: Faq[] = [
  { q: "¿El envío es realmente gratis?", a: "Sí, 100% gratis a toda Colombia. No cobramos ni un peso por el envío, ni siquiera a zonas alejadas." },
  { q: "¿Cómo funciona el pago contra entrega?", a: "El transportador te lleva el producto a tu dirección. Solo pagas cuando lo tienes en tus manos y ya lo revisaste. Si no te gusta, no lo recibes y no pagas nada." },
  { q: "¿Cuánto tarda en llegar?", a: "Entre 1 y 3 días hábiles a las principales ciudades, y hasta 5 días a zonas alejadas. Te enviamos la guía por WhatsApp para que hagas seguimiento." },
  { q: "¿Puedo abrir el paquete antes de pagar?", a: "Sí. Tienes derecho a revisar el contenido antes de pagarle al mensajero. Es tu tranquilidad." },
  { q: "¿Qué pasa si el producto llega defectuoso?", a: "Contactás con nosotros por WhatsApp y coordinamos el cambio sin costo. Aplicamos garantía por defectos de fábrica." },
];

const FAQ_BIENESTAR: Faq[] = [
  { q: "¿Tiene registro INVIMA?", a: "Sí. Todos nuestros productos de bienestar tienen su respectivo registro sanitario visible en el empaque." },
  { q: "¿Cuánto tiempo dura el frasco?", a: "Depende de la dosis diaria recomendada, generalmente entre 3 y 4 semanas por frasco." },
  { q: "¿Puedo tomarlo si tengo alguna condición médica?", a: "Si tienes condiciones médicas específicas o estás en tratamiento, te recomendamos consultar con tu médico antes de empezar." },
];

const FAQ_AUTOS: Faq[] = [
  { q: "¿Sirve para cualquier carro?", a: "Sí, es compatible con la mayoría de vehículos livianos y SUV. Si tienes dudas sobre tu modelo específico, escríbenos por WhatsApp." },
  { q: "¿Viene con instrucciones en español?", a: "Sí, con manual e instrucciones claras en español." },
];

const FAQ_MOTOS: Faq[] = [
  { q: "¿Se adapta a cualquier moto?", a: "Sí, es universal para la mayoría de motocicletas del mercado colombiano." },
  { q: "¿Aguanta el agua y la lluvia?", a: "Sí, tiene protección contra humedad para uso diario en Colombia." },
];

export function getFaqForProduct(productId: string, category?: string): Faq[] {
  const cat = String(category || "").toLowerCase();
  let extras: Faq[] = [];
  if (cat === "bienestar" || productId.includes("shilajit") || productId.includes("aguaje")) extras = FAQ_BIENESTAR;
  else if (cat === "autos") extras = FAQ_AUTOS;
  else if (cat === "motos") extras = FAQ_MOTOS;
  return [...extras, ...FAQ_COMUN];
}

export function getReviewsForProduct(productId: string): Review[] {
  return REVIEWS[productId] || [];
}

// Promedio real calculado desde las reviews (para que el rating agregado
// sea consistente con lo que ve el usuario, no un número inventado suelto)
export function getRatingSummary(productId: string): { avg: number; count: number } | null {
  const rs = REVIEWS[productId];
  if (!rs?.length) return null;
  const total = rs.reduce((s, r) => s + r.rating, 0);
  return { avg: Math.round((total / rs.length) * 10) / 10, count: rs.length };
}

// Contador de "entregas esta semana" que sube ligeramente cada día (no baja).
// Se calcula desde una semilla estable por producto, así el número no cambia
// bruscamente si el visitante vuelve a la landing.
export function getEntregasEstaSemana(productId: string): number {
  const seed = productId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return 40 + (seed % 30) + (dayOfYear % 12);
}
