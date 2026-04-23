const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'catalog.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

data.products = data.products.map(p => {
    let url = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80'; // Auto default
    const name = p.name.toLowerCase();
    const cat = p.category;

    if (name.includes('lavadora')) url = 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&q=80';
    else if (name.includes('camara') || name.includes('dvr')) url = 'https://images.unsplash.com/photo-1517409081283-432d665f80e9?w=800&q=80';
    else if (name.includes('compresor')) url = 'https://images.unsplash.com/photo-1627513753234-ab051cb6ecf6?w=800&q=80';
    else if (name.includes('holder') || name.includes('soporte')) url = 'https://images.unsplash.com/photo-1620054707682-1ced56da59d9?w=800&q=80';
    else if (name.includes('cable')) url = 'https://images.unsplash.com/photo-1605330368149-fb97f9046c4f?w=800&q=80';
    else if (name.includes('cepillo') || cat === 'belleza') url = 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80';
    else if (name.includes('picador') || name.includes('batidora') || cat === 'hogar') url = 'https://images.unsplash.com/photo-1581622558667-3419a8dc5f83?w=800&q=80';
    else if (name.includes('audifono') || cat === 'tecnologia') url = 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80';
    
    p.imageUrl = url;
    return p;
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Catalog updated with images successfully!');
