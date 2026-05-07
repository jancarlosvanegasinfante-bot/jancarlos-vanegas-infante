import fs from 'fs';
import path from 'path';

const catalogPath = path.join(process.cwd(), 'src', 'catalog.json');
const data = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

data.products = data.products.map((p: any) => {
    // Determine new price - reduce by ~20k when high, keeping a minimum margin.
    let baseNewPrice = p.cost * 1.5;
    let target = p.price;
    if (p.price > 110000) target = p.price - 20000;
    else if (p.price > 80000) target = p.price - 15000;
    else if (p.price > 50000) target = Math.max(p.price - 10000, baseNewPrice);
    else target = Math.max(p.price - 5000, baseNewPrice);
    
    // Add 900
    let tempPrice = Math.floor(target / 1000) * 1000 + 900;
    
    console.log(`${p.name} - Old: ${p.price} | New: ${tempPrice} | Cost: ${p.cost}`);
    p.price = tempPrice;
    return p;
});

fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2));
console.log('Done!');
