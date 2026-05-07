const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'catalog.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

data.products = data.products.map(p => {
    // Current diff between cost and price is quite high.
    // Let's drop prices intelligently, keeping at least 30% margin or fixed minimum.
    // New rule: cost * 1.5 approx, ending in 900.
    
    let baseNewPrice = p.cost * 1.5;
    
    // As a strict rule, give 'em a ~20% to 25% discount off previous retail,
    // but ensure we're still profitable.
    let discountPrice = p.price * 0.78; // Drop ~22%
    
    let target = Math.max(baseNewPrice, discountPrice);
    
    // Put "900" psychology
    let newPrice = Math.floor(target / 1000) * 1000 + 900;
    
    console.log(`${p.name}: Cost=${p.cost} | OldPrice=${p.price} | NewPrice=${newPrice}`);
    p.price = newPrice;
    
    return p;
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Catalog prices updated successfully!');
