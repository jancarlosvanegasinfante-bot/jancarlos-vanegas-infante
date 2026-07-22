import * as fs from "fs";

interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category?: string;
}

const catalogPath = "src/catalog.json";
const scrapedPath = "scraped-images.json";

const products: Product[] = fs.existsSync(catalogPath)
  ? JSON.parse(fs.readFileSync(catalogPath, "utf8")).products || []
  : [];

const scraped: any[] = fs.existsSync(scrapedPath)
  ? JSON.parse(fs.readFileSync(scrapedPath, "utf8"))
  : [];

if (scraped.length === 0) {
  console.log("No scraped images found in scraped-images.json.");
}

const normalize = (text: string) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ");
};

console.log("| Index | Image Title | Best Match ID | Best Match Name | Direct URL |");
console.log("|---|---|---|---|---|");

scraped.forEach((img: any, idx: number) => {
  const title = img.title.replace(" hosted at ImgBB", "");
  const normTitle = normalize(title);

  // Search products
  const matches = products.map(p => {
    const normName = normalize(p.name);
    const normDesc = normalize(p.description);
    
    let score = 0;
    const titleWords = normTitle.split(/\s+/).filter(w => w.length > 1);
    
    for (const word of titleWords) {
      if (normName.includes(word)) score += 10;
      if (normDesc.includes(word)) score += 2;
    }

    return { product: p, score };
  })
  .filter(m => m.score > 0)
  .sort((a, b) => b.score - a.score);

  const best = matches[0];
  if (best) {
    console.log(`| ${idx + 1} | ${title} | ${best.product.id} | ${best.product.name} | ${img.directUrl} |`);
  } else {
    console.log(`| ${idx + 1} | ${title} | NO MATCH | - | ${img.directUrl} |`);
  }
});
