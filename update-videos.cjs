const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'catalog.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

const updates = {
    'hidro-lavadora-48v': 'https://vt.tiktok.com/ZS9JU65EG/',
    'holder-cargador-inalambr': 'https://vt.tiktok.com/ZS9JUpKGf/',
    'cables-inicio-100': 'https://vt.tiktok.com/ZS9JyRkt7/',
    'cera-m1-cojineria': 'https://vt.tiktok.com/ZS9JyNJtm/',
    'compresor-aire-2cil': 'https://vt.tiktok.com/ZS9Jy5Jt2/',
    'compresor-portatil-digital': 'https://vt.tiktok.com/ZS9JyCaBT/',
    'convertidor-carga-qc3': 'https://vt.tiktok.com/ZS9Jf1fCF/',
    'camara-dvr-vehicular': 'https://vt.tiktok.com/ZS9Jf1cH1/',
    'kit-renovador-plasticos': 'https://vt.tiktok.com/ZS9JfDF62/',
    'maleta-organizador-maletero': 'https://vt.tiktok.com/ZS9Jfh4nJ/',
    'mini-aspiradora-portatil': 'https://vt.tiktok.com/ZS9JfH7o1/',
    'parasol-sombrilla-parabrisas': 'https://vt.tiktok.com/ZS9JPdtaQ/',
    'pops-a-dent-kit': 'https://vt.tiktok.com/ZS9JPkb3F/',
    'sistema-seguridad-antirrobo': 'https://vt.tiktok.com/ZS9JP5GEp/',
    'soporte-silicona-tablero': 'https://vt.tiktok.com/ZS9JPwRru/',
    'ventilador-doble-12v': 'https://vt.tiktok.com/ZS9JPE8Sj/'
};

data.products = data.products.map(p => {
    if (updates[p.id]) {
        p.videoUrl = updates[p.id];
    }
    return p;
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Videos updated successfully!');
