/**
 * Pocket Frames V2 — Original Sticker Catalog
 *
 * 75 original SVG sticker designs across 5 thematic packs.
 * All artwork is original — no stock, no copyright, no trademarks.
 *
 * Visual style: fine-line hand-drawn, viewBox 0 0 100 100,
 * stroke-linecap="round" stroke-linejoin="round"
 */

// ─── SVG helpers ─────────────────────────────────────────────────────────────
const s = (content, bg = 'none') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}" rx="4"/>${content}</svg>`;

const g = (stroke = '#1a1a1a', fill = 'none', sw = 3) =>
  `stroke="${stroke}" fill="${fill}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;

// ─── OCEAN PACK ───────────────────────────────────────────────────────────────
const OCEAN = [
  {
    id: 'ocean-shell',
    name: 'Nautilus Shell',
    tags: ['shell', 'ocean', 'beach', 'sea', 'nautilus'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#8B6914','#F5DEB3',2.5)} d="M50 80 C25 80 15 65 15 50 C15 30 28 18 50 18 C72 18 85 30 85 50 C85 65 78 76 66 79"/>
      <path ${g('#8B6914','none',2)} d="M50 18 C50 18 55 35 50 50 C45 65 50 80 50 80"/>
      <path ${g('#8B6914','none',2)} d="M50 50 C60 45 72 48 85 50"/>
      <path ${g('#8B6914','none',2)} d="M50 50 C40 40 32 28 15 50"/>
      <path ${g('#8B6914','none',2)} d="M50 50 C52 58 58 68 66 79"/>
      <circle cx="50" cy="50" r="6" ${g('#8B6914','#D4A850',2)}/>
    `)
  },
  {
    id: 'ocean-starfish',
    name: 'Starfish',
    tags: ['starfish', 'ocean', 'beach', 'sea', 'star'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#E8823A','#F4A460',2.5)} d="M50 15 L56 38 L80 30 L64 50 L80 70 L56 62 L50 85 L44 62 L20 70 L36 50 L20 30 L44 38 Z"/>
      <circle cx="50" cy="50" r="8" ${g('#C05A20','#E8823A',2)}/>
      <circle cx="44" cy="36" r="2" fill="#C05A20"/>
      <circle cx="56" cy="36" r="2" fill="#C05A20"/>
      <circle cx="62" cy="48" r="2" fill="#C05A20"/>
      <circle cx="38" cy="48" r="2" fill="#C05A20"/>
      <circle cx="50" cy="30" r="2" fill="#C05A20"/>
    `)
  },
  {
    id: 'ocean-wave',
    name: 'Wave',
    tags: ['wave', 'ocean', 'sea', 'water', 'surf'],
    defaultSize: 220,
    svg: s(`
      <path ${g('#2A7CC7','none',3)} d="M10 55 C20 40 30 40 40 55 C50 70 60 70 70 55 C80 40 90 40 95 48"/>
      <path ${g('#2A7CC7','none',2.5)} d="M5 68 C15 53 25 53 35 68 C45 83 55 83 65 68 C75 53 85 53 95 63"/>
      <path ${g('#6DB8E8','none',2)} d="M15 42 C25 27 35 27 45 42 C55 57 65 57 75 42 C82 32 90 30 98 36"/>
    `)
  },
  {
    id: 'ocean-fish',
    name: 'Tropical Fish',
    tags: ['fish', 'ocean', 'sea', 'tropical', 'aquatic'],
    defaultSize: 200,
    svg: s(`
      <ellipse cx="47" cy="50" rx="28" ry="18" ${g('#E55A1C','#F4883A',2.5)}/>
      <path ${g('#E55A1C','#FFB347',2.5)} d="M74 50 L88 35 L92 50 L88 65 Z"/>
      <path ${g('#D44A10','none',2)} d="M35 42 Q50 50 35 58"/>
      <path ${g('#D44A10','none',2)} d="M44 40 Q56 50 44 60"/>
      <circle cx="30" cy="46" r="4" ${g('#1A1A1A','white',1.5)}/>
      <circle cx="29" cy="45" r="1.5" fill="#1a1a1a"/>
      <path ${g('#E55A1C','#FFD700',2)} d="M47 32 L53 38 L60 33 L57 42"/>
      <path ${g('#E55A1C','#FFD700',2)} d="M47 68 L53 62 L60 67 L57 58"/>
    `)
  },
  {
    id: 'ocean-pearl',
    name: 'Pearl',
    tags: ['pearl', 'ocean', 'shell', 'gem', 'jewelry'],
    defaultSize: 160,
    svg: s(`
      <circle cx="50" cy="52" r="30" ${g('#AAAAAA','#F0ECF5',2.5)}/>
      <ellipse cx="42" cy="42" rx="8" ry="5" fill="rgba(255,255,255,0.7)" stroke="none"/>
      <ellipse cx="62" cy="60" rx="5" ry="3" fill="rgba(255,255,255,0.4)" stroke="none"/>
      <path ${g('#AAAAAA','none',1.5)} d="M30 40 C35 35 45 33 55 36"/>
      <path ${g('#C8A0D0','none',1.5)} d="M68 58 C72 63 72 72 66 76"/>
    `)
  },
  {
    id: 'ocean-coral',
    name: 'Coral Branch',
    tags: ['coral', 'ocean', 'reef', 'sea', 'branch'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#E84040','none',3)} d="M50 85 L50 55"/>
      <path ${g('#E84040','none',2.5)} d="M50 65 L35 45"/>
      <path ${g('#E84040','none',2.5)} d="M50 60 L65 40"/>
      <path ${g('#E84040','none',2)} d="M35 45 L25 30"/>
      <path ${g('#E84040','none',2)} d="M35 45 L42 28"/>
      <path ${g('#E84040','none',2)} d="M65 40 L72 22"/>
      <path ${g('#E84040','none',2)} d="M65 40 L80 32"/>
      <circle cx="25" cy="28" r="3" fill="#E84040"/>
      <circle cx="42" cy="26" r="3" fill="#E84040"/>
      <circle cx="50" cy="52" r="3" fill="#E84040"/>
      <circle cx="72" cy="20" r="3" fill="#E84040"/>
      <circle cx="80" cy="30" r="3" fill="#E84040"/>
    `)
  },
  {
    id: 'ocean-seaweed',
    name: 'Seaweed',
    tags: ['seaweed', 'ocean', 'plant', 'underwater', 'kelp'],
    defaultSize: 180,
    svg: s(`
      <path ${g('#2E8B57','none',2.5)} d="M50 88 C50 75 45 70 50 60 C55 50 45 45 50 35 C55 25 48 20 52 15"/>
      <path ${g('#3CB371','none',2)} d="M50 70 C40 65 35 60 38 52"/>
      <path ${g('#3CB371','none',2)} d="M50 55 C60 50 65 44 62 36"/>
      <path ${g('#3CB371','none',2)} d="M50 40 C40 36 36 30 40 22"/>
      <path ${g('#2E8B57','none',2)} d="M40 78 C35 72 35 68 40 64"/>
    `)
  },
  {
    id: 'ocean-seahorse',
    name: 'Seahorse',
    tags: ['seahorse', 'ocean', 'sea horse', 'aquatic', 'sea'],
    defaultSize: 180,
    svg: s(`
      <path ${g('#DAA520','#F0C040',2.5)} d="M50 20 C60 18 68 22 68 30 C68 38 60 40 55 45 C65 48 72 55 70 65 C68 78 60 85 50 88 C42 90 36 85 38 78 C40 72 48 70 52 66 C48 60 40 55 38 48 C35 40 40 30 50 20 Z"/>
      <path ${g('#B8860B','none',2)} d="M44 28 C48 26 54 28 56 32"/>
      <path ${g('#B8860B','none',2)} d="M42 38 C46 36 54 38 56 42"/>
      <path ${g('#B8860B','none',2)} d="M44 50 C48 48 56 50 56 54"/>
      <path ${g('#B8860B','none',2)} d="M45 62 C49 60 55 62 54 66"/>
      <circle cx="62" cy="27" r="4" ${g('#1a1a1a','white',1.5)}/>
      <circle cx="62" cy="26" r="1.5" fill="#1a1a1a"/>
      <path ${g('#DAA520','none',2.5)} d="M50 88 C48 90 44 92 40 90 C36 88 36 84 38 82"/>
      <path ${g('#DAA520','none',2)} d="M55 18 C60 10 68 8 72 12"/>
    `)
  },
  {
    id: 'ocean-anchor',
    name: 'Anchor',
    tags: ['anchor', 'ocean', 'nautical', 'navy', 'boat'],
    defaultSize: 200,
    svg: s(`
      <line x1="50" y1="20" x2="50" y2="80" ${g('#1a3a5c','none',3)}/>
      <path ${g('#1a3a5c','none',3)} d="M30 75 C30 85 50 90 70 75"/>
      <circle cx="50" cy="23" r="6" ${g('#1a3a5c','white',2.5)}/>
      <line x1="35" y1="36" x2="65" y2="36" ${g('#1a3a5c','none',3)}/>
      <circle cx="30" cy="76" r="4" ${g('#1a3a5c','white',2)}/>
      <circle cx="70" cy="76" r="4" ${g('#1a3a5c','white',2)}/>
      <path ${g('#1a3a5c','none',2)} d="M50 20 C46 14 42 12 38 14"/>
    `)
  },
  {
    id: 'ocean-crab',
    name: 'Crab',
    tags: ['crab', 'ocean', 'beach', 'seafood', 'sea'],
    defaultSize: 200,
    svg: s(`
      <ellipse cx="50" cy="55" rx="25" ry="18" ${g('#C84B20','#E86A30',2.5)}/>
      <path ${g('#C84B20','#E86A30',2.5)} d="M28 50 L18 40 L12 30 L20 32 L25 42"/>
      <path ${g('#C84B20','#E86A30',2.5)} d="M72 50 L82 40 L88 30 L80 32 L75 42"/>
      <path ${g('#C84B20','none',2)} d="M32 62 L22 72 L18 82"/>
      <path ${g('#C84B20','none',2)} d="M38 66 L32 78"/>
      <path ${g('#C84B20','none',2)} d="M68 62 L78 72 L82 82"/>
      <path ${g('#C84B20','none',2)} d="M62 66 L68 78"/>
      <circle cx="42" cy="47" r="5" ${g('#1a1a1a','white',1.5)}/>
      <circle cx="58" cy="47" r="5" ${g('#1a1a1a','white',1.5)}/>
      <circle cx="42" cy="46" r="2" fill="#1a1a1a"/>
      <circle cx="58" cy="46" r="2" fill="#1a1a1a"/>
    `)
  },
  {
    id: 'ocean-lighthouse',
    name: 'Lighthouse',
    tags: ['lighthouse', 'ocean', 'coast', 'navigation', 'tower'],
    defaultSize: 180,
    svg: s(`
      <rect x="38" y="30" width="24" height="48" rx="2" ${g('#CC3333','#FFFFFF',2.5)}/>
      <rect x="40" y="40" width="20" height="8" fill="#CC3333" stroke="none"/>
      <rect x="40" y="56" width="20" height="8" fill="#CC3333" stroke="none"/>
      <rect x="38" y="18" width="24" height="14" rx="2" ${g('#999','#DDDDDD',2)}/>
      <ellipse cx="50" cy="18" rx="10" ry="4" ${g('#888','#CCCCCC',2)}/>
      <path ${g('#FFD700','none',2.5)} d="M50 15 L42 8 M50 15 L58 8 M50 15 L38 12 M50 15 L62 12"/>
      <rect x="30" y="76" width="40" height="10" rx="2" ${g('#888888','#AAAAAA',2)}/>
      <rect x="22" y="84" width="56" height="8" rx="2" ${g('#888888','#AAAAAA',2)}/>
    `)
  },
  {
    id: 'ocean-boat',
    name: 'Sailboat',
    tags: ['boat', 'sailboat', 'ocean', 'sea', 'sailing'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#1a3a5c','#2A5A8C',2.5)} d="M20 70 L50 70 L80 70 L75 80 L25 80 Z"/>
      <line x1="50" y1="20" x2="50" y2="70" ${g('#8B4513','none',2.5)}/>
      <path ${g('#CC4444','#EE6666',2)} d="M50 22 L50 60 L25 60 Z"/>
      <path ${g('#FFFFFF','#FFFFFF',2)} d="M50 22 L50 60 L75 60 Z"/>
      <path ${g('#1a3a5c','none',2)} d="M30 80 C35 88 65 88 70 80"/>
    `)
  },
  {
    id: 'ocean-sanddollar',
    name: 'Sand Dollar',
    tags: ['sand dollar', 'ocean', 'beach', 'shell', 'sea'],
    defaultSize: 180,
    svg: s(`
      <circle cx="50" cy="50" r="32" ${g('#D2A679','#F5DEB3',2.5)}/>
      <path ${g('#B8860B','none',2)} d="M50 22 L50 78"/>
      <path ${g('#B8860B','none',2)} d="M50 50 L26 35 L74 35 Z"/>
      <path ${g('#B8860B','none',2)} d="M50 50 L26 65 L74 65 Z"/>
      <circle cx="50" cy="50" r="8" ${g('#B8860B','#D2A679',2)}/>
      <circle cx="50" cy="30" r="3" ${g('#B8860B','#F5DEB3',1.5)}/>
      <circle cx="50" cy="70" r="3" ${g('#B8860B','#F5DEB3',1.5)}/>
      <circle cx="32" cy="40" r="3" ${g('#B8860B','#F5DEB3',1.5)}/>
      <circle cx="68" cy="40" r="3" ${g('#B8860B','#F5DEB3',1.5)}/>
      <circle cx="32" cy="60" r="3" ${g('#B8860B','#F5DEB3',1.5)}/>
      <circle cx="68" cy="60" r="3" ${g('#B8860B','#F5DEB3',1.5)}/>
    `)
  },
  {
    id: 'ocean-jellyfish',
    name: 'Jellyfish',
    tags: ['jellyfish', 'ocean', 'sea', 'jelly', 'aquatic'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#9B59B6','rgba(180,120,220,0.7)',2.5)} d="M20 48 Q50 20 80 48 L80 52 Q50 40 20 52 Z"/>
      <path ${g('#8E44AD','rgba(160,100,200,0.5)',1.5)} d="M30 50 Q50 38 70 50"/>
      <path ${g('#9B59B6','none',2)} d="M30 52 C28 65 32 75 30 85"/>
      <path ${g('#9B59B6','none',2)} d="M40 53 C38 66 42 76 40 86"/>
      <path ${g('#9B59B6','none',2)} d="M50 54 C50 67 50 77 50 87"/>
      <path ${g('#9B59B6','none',2)} d="M60 53 C62 66 58 76 60 86"/>
      <path ${g('#9B59B6','none',2)} d="M70 52 C72 65 68 75 70 85"/>
    `)
  }
];

// ─── SUMMER PACK ─────────────────────────────────────────────────────────────
const SUMMER = [
  {
    id: 'summer-sun',
    name: 'Sun',
    tags: ['sun', 'summer', 'sunshine', 'warm', 'bright'],
    defaultSize: 200,
    svg: s(`
      <circle cx="50" cy="50" r="20" ${g('#F4A020','#FFD700',3)}/>
      <line x1="50" y1="10" x2="50" y2="22" ${g('#F4A020','none',3)}/>
      <line x1="50" y1="78" x2="50" y2="90" ${g('#F4A020','none',3)}/>
      <line x1="10" y1="50" x2="22" y2="50" ${g('#F4A020','none',3)}/>
      <line x1="78" y1="50" x2="90" y2="50" ${g('#F4A020','none',3)}/>
      <line x1="22" y1="22" x2="30" y2="30" ${g('#F4A020','none',2.5)}/>
      <line x1="70" y1="70" x2="78" y2="78" ${g('#F4A020','none',2.5)}/>
      <line x1="78" y1="22" x2="70" y2="30" ${g('#F4A020','none',2.5)}/>
      <line x1="22" y1="78" x2="30" y2="70" ${g('#F4A020','none',2.5)}/>
    `)
  },
  {
    id: 'summer-sunflower',
    name: 'Sunflower',
    tags: ['sunflower', 'flower', 'summer', 'garden', 'yellow'],
    defaultSize: 200,
    svg: s(`
      <line x1="50" y1="88" x2="50" y2="58" ${g('#3A7D1E','none',3)}/>
      <path ${g('#3A7D1E','none',2)} d="M50 75 C44 70 38 70 36 76"/>
      <circle cx="50" cy="46" r="14" ${g('#5C3A1E','#6B4226',3)}/>
      <ellipse cx="50" cy="27" rx="8" ry="5" transform="rotate(0,50,46)" ${g('#F4B820','#FFD700',2)} />
      <ellipse cx="62" cy="32" rx="8" ry="5" transform="rotate(52,50,46)" ${g('#F4B820','#FFD700',2)} />
      <ellipse cx="67" cy="46" rx="8" ry="5" transform="rotate(104,50,46)" ${g('#F4B820','#FFD700',2)} />
      <ellipse cx="62" cy="60" rx="8" ry="5" transform="rotate(156,50,46)" ${g('#F4B820','#FFD700',2)} />
      <ellipse cx="50" cy="65" rx="8" ry="5" transform="rotate(180,50,46)" ${g('#F4B820','#FFD700',2)} />
      <ellipse cx="38" cy="60" rx="8" ry="5" transform="rotate(232,50,46)" ${g('#F4B820','#FFD700',2)} />
      <ellipse cx="33" cy="46" rx="8" ry="5" transform="rotate(284,50,46)" ${g('#F4B820','#FFD700',2)} />
      <ellipse cx="38" cy="32" rx="8" ry="5" transform="rotate(336,50,46)" ${g('#F4B820','#FFD700',2)} />
      <circle cx="50" cy="46" r="10" ${g('#5C3A1E','#8B5E3C',2)}/>
      <circle cx="46" cy="43" r="2" fill="#FFD700" opacity="0.7"/>
      <circle cx="53" cy="41" r="2" fill="#FFD700" opacity="0.7"/>
      <circle cx="50" cy="50" r="2" fill="#FFD700" opacity="0.7"/>
    `)
  },
  {
    id: 'summer-lemon',
    name: 'Lemon Slice',
    tags: ['lemon', 'summer', 'citrus', 'fruit', 'yellow'],
    defaultSize: 180,
    svg: s(`
      <circle cx="50" cy="50" r="35" ${g('#D4A020','#FFE135',2.5)}/>
      <circle cx="50" cy="50" r="28" ${g('#D4A020','#FFF176',2)}/>
      <path ${g('#D4A020','none',1.5)} d="M50 22 L50 78"/>
      <path ${g('#D4A020','none',1.5)} d="M22 50 L78 50"/>
      <path ${g('#D4A020','none',1.5)} d="M29 29 L71 71"/>
      <path ${g('#D4A020','none',1.5)} d="M71 29 L29 71"/>
      <circle cx="50" cy="50" r="6" ${g('#D4A020','#FFE135',1.5)}/>
    `)
  },
  {
    id: 'summer-sunglasses',
    name: 'Sunglasses',
    tags: ['sunglasses', 'summer', 'cool', 'shades', 'beach'],
    defaultSize: 220,
    svg: s(`
      <rect x="10" y="42" width="32" height="22" rx="11" ${g('#1a1a1a','rgba(80,40,160,0.6)',2.5)}/>
      <rect x="58" y="42" width="32" height="22" rx="11" ${g('#1a1a1a','rgba(80,40,160,0.6)',2.5)}/>
      <path ${g('#1a1a1a','none',2.5)} d="M42 51 L58 51"/>
      <line x1="10" y1="51" x2="4" y2="46" ${g('#1a1a1a','none',2.5)}/>
      <line x1="90" y1="51" x2="96" y2="46" ${g('#1a1a1a','none',2.5)}/>
      <path ${g('rgba(255,255,255,0.4)','none',1.5)} d="M18 48 Q22 45 28 47"/>
      <path ${g('rgba(255,255,255,0.4)','none',1.5)} d="M66 48 Q70 45 76 47"/>
    `)
  },
  {
    id: 'summer-cloud',
    name: 'Cloud',
    tags: ['cloud', 'sky', 'summer', 'weather', 'fluffy'],
    defaultSize: 220,
    svg: s(`
      <path ${g('#888','#FFFFFF',2.5)} d="M20 65 Q20 48 35 46 Q35 30 50 30 Q64 30 66 42 Q78 42 80 55 Q90 55 90 65 Z"/>
      <path ${g('rgba(200,200,200,0.5)','none',1.5)} d="M30 60 Q35 52 45 50"/>
    `)
  },
  {
    id: 'summer-icecream',
    name: 'Ice Cream',
    tags: ['ice cream', 'summer', 'dessert', 'sweet', 'cone'],
    defaultSize: 180,
    svg: s(`
      <path ${g('#C8860A','#DEB887',2.5)} d="M38 60 L50 90 L62 60"/>
      <path ${g('#DEB887','none',1.5)} d="M42 65 L50 85 M54 65 L50 85"/>
      <ellipse cx="50" cy="50" rx="18" ry="20" ${g('#E8A0B0','#FFB6C1',2.5)}/>
      <path ${g('#E08898','none',2)} d="M34 48 Q42 42 50 50 Q58 58 66 48"/>
      <circle cx="44" cy="42" r="3" fill="#FF69B4" opacity="0.7"/>
      <circle cx="57" cy="55" r="2.5" fill="#FF69B4" opacity="0.7"/>
    `)
  },
  {
    id: 'summer-camera',
    name: 'Pocket Camera',
    tags: ['camera', 'summer', 'photo', 'photography', 'snapshot'],
    defaultSize: 200,
    svg: s(`
      <rect x="15" y="35" width="70" height="48" rx="6" ${g('#CC4444','#E55555',2.5)}/>
      <rect x="22" y="28" width="20" height="10" rx="4" ${g('#CC4444','#E55555',2)}/>
      <circle cx="50" cy="59" r="14" ${g('#1a1a1a','#222',2.5)}/>
      <circle cx="50" cy="59" r="10" ${g('#333','#444',2)}/>
      <circle cx="50" cy="59" r="5" ${g('#555','#1a90FF',1.5)}/>
      <circle cx="44" cy="53" r="2" fill="rgba(255,255,255,0.5)" stroke="none"/>
      <rect x="68" y="40" width="10" height="7" rx="2" ${g('#CC4444','#FFD700',1.5)}/>
      <rect x="18" y="70" width="8" height="6" rx="1" ${g('#AA3333','none',1.5)}/>
    `)
  },
  {
    id: 'summer-palmtree',
    name: 'Palm Tree',
    tags: ['palm', 'tree', 'summer', 'tropical', 'beach'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#8B6914','none',3)} d="M52 85 C50 75 48 65 50 55 C52 45 52 40 50 32"/>
      <path ${g('#3A7D1E','#4CAF50',2.5)} d="M50 32 C45 22 30 18 22 26 C30 24 38 30 44 38"/>
      <path ${g('#3A7D1E','#4CAF50',2.5)} d="M50 32 C55 22 70 18 78 26 C70 24 62 30 56 38"/>
      <path ${g('#3A7D1E','#4CAF50',2.5)} d="M50 32 C42 25 28 28 24 36 C32 30 42 32 48 40"/>
      <path ${g('#3A7D1E','#4CAF50',2.5)} d="M50 32 C58 25 72 28 76 36 C68 30 58 32 52 40"/>
      <path ${g('#3A7D1E','#66BB6A',2)} d="M50 32 C50 20 50 14 52 10"/>
      <circle cx="46" cy="35" r="4" ${g('#F4A020','#FFD700',1.5)}/>
      <circle cx="52" cy="37" r="4" ${g('#F4A020','#FFD700',1.5)}/>
      <circle cx="48" cy="40" r="4" ${g('#F4A020','#FFD700',1.5)}/>
    `)
  },
  {
    id: 'summer-watermelon',
    name: 'Watermelon',
    tags: ['watermelon', 'summer', 'fruit', 'slice', 'sweet'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#2E8B57','#E8334A',2.5)} d="M15 55 A40 40 0 0 1 85 55 Z"/>
      <path ${g('#2E8B57','#4CAF50',2)} d="M15 55 A40 5 0 0 0 85 55 Z"/>
      <path ${g('#F44444','none',2)} d="M20 52 A38 38 0 0 1 80 52"/>
      <circle cx="35" cy="48" r="3" fill="#1a1a1a"/>
      <circle cx="50" cy="44" r="3" fill="#1a1a1a"/>
      <circle cx="65" cy="48" r="3" fill="#1a1a1a"/>
      <circle cx="42" cy="52" r="3" fill="#1a1a1a"/>
      <circle cx="58" cy="52" r="3" fill="#1a1a1a"/>
    `)
  },
  {
    id: 'summer-beachball',
    name: 'Beach Ball',
    tags: ['beach ball', 'ball', 'summer', 'beach', 'sport'],
    defaultSize: 180,
    svg: s(`
      <circle cx="50" cy="50" r="35" ${g('#1a1a1a','none',2.5)}/>
      <path ${g('#EE3333','#EE3333',0)} d="M50 15 A35 35 0 0 1 85 50 A35 35 0 0 1 50 85 C50 65 50 35 50 15 Z"/>
      <path ${g('#4444EE','#4444EE',0)} d="M50 15 A35 35 0 0 0 15 50 A35 35 0 0 0 50 85 C50 65 50 35 50 15 Z"/>
      <path ${g('#FFEE33','none',2)} d="M50 15 C55 30 62 40 65 50 C62 60 55 70 50 85"/>
      <path ${g('#FFEE33','none',2)} d="M50 15 C45 30 38 40 35 50 C38 60 45 70 50 85"/>
      <circle cx="50" cy="50" r="35" ${g('#1a1a1a','none',2.5)}/>
      <circle cx="40" cy="36" r="5" fill="rgba(255,255,255,0.3)" stroke="none"/>
    `)
  },
  {
    id: 'summer-popsicle',
    name: 'Popsicle',
    tags: ['popsicle', 'ice lolly', 'summer', 'treat', 'frozen'],
    defaultSize: 180,
    svg: s(`
      <rect x="34" y="20" width="32" height="52" rx="16" ${g('#E84080','#FF6BA8',2.5)}/>
      <rect x="46" y="72" width="8" height="22" rx="3" ${g('#D4A060','#DEB887',2.5)}/>
      <path ${g('#FF8EB8','none',2)} d="M38 32 Q50 28 62 32"/>
      <path ${g('#FF8EB8','none',1.5)} d="M36 42 Q50 38 64 42"/>
    `)
  },
  {
    id: 'summer-flipflops',
    name: 'Flip Flops',
    tags: ['flip flops', 'sandals', 'summer', 'beach', 'shoes'],
    defaultSize: 220,
    svg: s(`
      <ellipse cx="32" cy="60" rx="20" ry="12" ${g('#2A7CC7','#4A9CE7',2.5)}/>
      <path ${g('#CC4444','none',2.5)} d="M32 48 C28 42 32 36 36 40"/>
      <path ${g('#CC4444','none',2.5)} d="M38 55 C36 48 32 48 32 48"/>
      <ellipse cx="68" cy="60" rx="20" ry="12" ${g('#2A7CC7','#4A9CE7',2.5)}/>
      <path ${g('#CC4444','none',2.5)} d="M68 48 C64 42 68 36 72 40"/>
      <path ${g('#CC4444','none',2.5)} d="M74 55 C72 48 68 48 68 48"/>
    `)
  },
  {
    id: 'summer-butterfly',
    name: 'Butterfly',
    tags: ['butterfly', 'summer', 'garden', 'nature', 'wings'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#E84080','rgba(240,160,200,0.8)',2.5)} d="M50 50 C40 40 20 30 18 45 C16 60 35 65 50 50"/>
      <path ${g('#E84080','rgba(240,160,200,0.8)',2.5)} d="M50 50 C60 40 80 30 82 45 C84 60 65 65 50 50"/>
      <path ${g('#E84080','rgba(240,100,160,0.7)',2)} d="M50 50 C45 58 28 65 25 75 C22 85 38 82 50 50"/>
      <path ${g('#E84080','rgba(240,100,160,0.7)',2)} d="M50 50 C55 58 72 65 75 75 C78 85 62 82 50 50"/>
      <line x1="50" y1="30" x2="50" y2="70" ${g('#1a1a1a','none',2)}/>
      <path ${g('#1a1a1a','none',2)} d="M50 30 C46 22 42 20 40 22"/>
      <path ${g('#1a1a1a','none',2)} d="M50 30 C54 22 58 20 60 22"/>
      <circle cx="50" cy="30" r="3" fill="#1a1a1a"/>
    `)
  },
  {
    id: 'summer-coconut',
    name: 'Coconut',
    tags: ['coconut', 'tropical', 'summer', 'fruit', 'beach'],
    defaultSize: 180,
    svg: s(`
      <circle cx="50" cy="52" r="28" ${g('#5C3A1E','#8B5E3C',2.5)}/>
      <path ${g('#3A2010','none',2)} d="M36 36 C42 32 50 32 58 36"/>
      <path ${g('#3A2010','none',2)} d="M36 36 C32 44 32 56 36 64"/>
      <path ${g('#3A2010','none',2)} d="M58 36 C62 44 62 56 58 64"/>
      <circle cx="44" cy="44" r="3" ${g('#2A1A0A','#2A1A0A',1)}/>
      <circle cx="54" cy="40" r="3" ${g('#2A1A0A','#2A1A0A',1)}/>
      <circle cx="50" cy="48" r="3" ${g('#2A1A0A','#2A1A0A',1)}/>
      <path ${g('#3A7D1E','none',2.5)} d="M50 24 C44 16 36 14 30 18"/>
      <path ${g('#3A7D1E','none',2.5)} d="M50 24 C56 16 64 14 70 18"/>
      <path ${g('#3A7D1E','none',2.5)} d="M50 24 C50 14 52 8 56 6"/>
    `)
  }
];

// ─── PHOTOGRAPHY PACK ─────────────────────────────────────────────────────────
const PHOTOGRAPHY = [
  {
    id: 'photo-filmcamera',
    name: 'Film Camera',
    tags: ['film camera', 'camera', 'photography', 'vintage', 'analog'],
    defaultSize: 220,
    svg: s(`
      <rect x="12" y="32" width="76" height="48" rx="4" ${g('#2A2A2A','#3A3A3A',2.5)}/>
      <rect x="20" y="22" width="18" height="12" rx="3" ${g('#2A2A2A','#3A3A3A',2)}/>
      <circle cx="50" cy="56" r="16" ${g('#1a1a1a','#444',2.5)}/>
      <circle cx="50" cy="56" r="12" ${g('#555','#1a1a1a',2)}/>
      <circle cx="50" cy="56" r="7" ${g('#666','#222',1.5)}/>
      <circle cx="46" cy="52" r="3" fill="rgba(255,255,255,0.3)" stroke="none"/>
      <rect x="70" y="36" width="10" height="8" rx="2" ${g('#1a1a1a','#CC4444',1.5)}/>
      <rect x="14" y="70" width="10" height="6" rx="2" ${g('#1a1a1a','#FFD700',1.5)}/>
      <rect x="76" y="60" width="8" height="12" rx="2" ${g('#1a1a1a','#2A2A2A',1.5)}/>
    `)
  },
  {
    id: 'photo-flash',
    name: 'Camera Flash',
    tags: ['flash', 'camera', 'photography', 'lightning', 'light'],
    defaultSize: 180,
    svg: s(`
      <path ${g('#F4A020','#FFD700',2.5)} d="M55 15 L30 52 L48 52 L45 85 L70 48 L52 48 Z"/>
    `)
  },
  {
    id: 'photo-filmroll',
    name: 'Film Roll',
    tags: ['film', 'roll', 'photography', 'analog', '35mm'],
    defaultSize: 180,
    svg: s(`
      <rect x="28" y="20" width="30" height="60" rx="8" ${g('#1a1a1a','#2A2A2A',2.5)}/>
      <rect x="20" y="30" width="8" height="40" rx="4" ${g('#1a1a1a','#3A3A3A',2)}/>
      <rect x="72" y="30" width="8" height="40" rx="4" ${g('#1a1a1a','#3A3A3A',2)}/>
      <circle cx="43" cy="50" r="10" ${g('#555','#888',2)}/>
      <circle cx="43" cy="50" r="5" ${g('#333','#555',1.5)}/>
      <rect x="36" y="22" width="4" height="6" rx="1" fill="#555"/>
      <rect x="46" y="22" width="4" height="6" rx="1" fill="#555"/>
      <rect x="36" y="72" width="4" height="6" rx="1" fill="#555"/>
      <rect x="46" y="72" width="4" height="6" rx="1" fill="#555"/>
    `)
  },
  {
    id: 'photo-sdcard',
    name: 'SD Card',
    tags: ['SD card', 'memory card', 'photography', 'storage', 'digital'],
    defaultSize: 160,
    svg: s(`
      <path ${g('#1a1a1a','#CCCCCC',2.5)} d="M30 25 L30 80 Q30 85 35 85 L70 85 Q75 85 75 80 L75 35 L60 20 L35 20 Q30 20 30 25 Z"/>
      <path ${g('#999','none',1.5)} d="M60 20 L60 35 L75 35"/>
      <rect x="38" y="60" width="4" height="16" rx="1" fill="#888"/>
      <rect x="46" y="60" width="4" height="16" rx="1" fill="#888"/>
      <rect x="54" y="60" width="4" height="16" rx="1" fill="#888"/>
      <rect x="62" y="60" width="4" height="16" rx="1" fill="#888"/>
    `)
  },
  {
    id: 'photo-viewfinder',
    name: 'Focus Brackets',
    tags: ['viewfinder', 'focus', 'photography', 'brackets', 'frame'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#FF4444','none',3)} d="M20 35 L20 20 L35 20"/>
      <path ${g('#FF4444','none',3)} d="M65 20 L80 20 L80 35"/>
      <path ${g('#FF4444','none',3)} d="M20 65 L20 80 L35 80"/>
      <path ${g('#FF4444','none',3)} d="M65 80 L80 80 L80 65"/>
      <circle cx="50" cy="50" r="4" ${g('#FF4444','none',2)}/>
      <line x1="50" y1="42" x2="50" y2="38" ${g('#FF4444','none',2)}/>
      <line x1="50" y1="58" x2="50" y2="62" ${g('#FF4444','none',2)}/>
      <line x1="42" y1="50" x2="38" y2="50" ${g('#FF4444','none',2)}/>
      <line x1="58" y1="50" x2="62" y2="50" ${g('#FF4444','none',2)}/>
    `)
  },
  {
    id: 'photo-click',
    name: 'CLICK Stamp',
    tags: ['click', 'stamp', 'photography', 'shutter', 'capture'],
    defaultSize: 200,
    svg: s(`
      <circle cx="50" cy="50" r="38" ${g('#CC3333','none',3)}/>
      <circle cx="50" cy="50" r="33" ${g('#CC3333','none',1.5)}/>
      <text x="50" y="56" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" letter-spacing="3" fill="#CC3333">CLICK</text>
      <path ${g('#CC3333','none',1.5)} d="M22 38 A33 33 0 0 1 78 38"/>
      <path ${g('#CC3333','none',1.5)} d="M22 62 A33 33 0 0 0 78 62"/>
    `)
  },
  {
    id: 'photo-aperture',
    name: 'Aperture Iris',
    tags: ['aperture', 'iris', 'photography', 'lens', 'camera'],
    defaultSize: 200,
    svg: s(`
      <circle cx="50" cy="50" r="35" ${g('#1a1a1a','none',2.5)}/>
      <circle cx="50" cy="50" r="14" ${g('#1a1a1a','rgba(30,30,30,0.8)',2)}/>
      <path ${g('#1a1a1a','rgba(50,50,50,0.6)',2)} d="M50 15 L58 36 L76 26 Z"/>
      <path ${g('#1a1a1a','rgba(50,50,50,0.6)',2)} d="M85 50 L64 42 L74 24 Z"/>
      <path ${g('#1a1a1a','rgba(50,50,50,0.6)',2)} d="M85 50 L64 58 L84 74 Z"/>
      <path ${g('#1a1a1a','rgba(50,50,50,0.6)',2)} d="M50 85 L42 64 L24 74 Z"/>
      <path ${g('#1a1a1a','rgba(50,50,50,0.6)',2)} d="M15 50 L36 58 L26 76 Z"/>
      <path ${g('#1a1a1a','rgba(50,50,50,0.6)',2)} d="M15 50 L36 42 L16 26 Z"/>
    `)
  },
  {
    id: 'photo-filmstrip',
    name: 'Film Strip',
    tags: ['film strip', 'photography', 'analog', 'movie', 'vintage'],
    defaultSize: 220,
    svg: s(`
      <rect x="10" y="32" width="80" height="36" ${g('#1a1a1a','#1a1a1a',2)}/>
      <rect x="16" y="38" width="20" height="24" rx="1" ${g('#555','#8899AA',1.5)}/>
      <rect x="42" y="38" width="20" height="24" rx="1" ${g('#555','#AA8899',1.5)}/>
      <rect x="68" y="38" width="16" height="24" rx="1" ${g('#555','#99AA88',1.5)}/>
      <rect x="10" y="32" width="6" height="6" rx="1" fill="#444"/>
      <rect x="22" y="32" width="6" height="6" rx="1" fill="#444"/>
      <rect x="34" y="32" width="6" height="6" rx="1" fill="#444"/>
      <rect x="46" y="32" width="6" height="6" rx="1" fill="#444"/>
      <rect x="58" y="32" width="6" height="6" rx="1" fill="#444"/>
      <rect x="70" y="32" width="6" height="6" rx="1" fill="#444"/>
      <rect x="82" y="32" width="6" height="6" rx="1" fill="#444"/>
      <rect x="10" y="62" width="6" height="6" rx="1" fill="#444"/>
      <rect x="22" y="62" width="6" height="6" rx="1" fill="#444"/>
      <rect x="34" y="62" width="6" height="6" rx="1" fill="#444"/>
      <rect x="46" y="62" width="6" height="6" rx="1" fill="#444"/>
      <rect x="58" y="62" width="6" height="6" rx="1" fill="#444"/>
      <rect x="70" y="62" width="6" height="6" rx="1" fill="#444"/>
      <rect x="82" y="62" width="6" height="6" rx="1" fill="#444"/>
    `)
  },
  {
    id: 'photo-polaroidprint',
    name: 'Photo Print',
    tags: ['photo', 'print', 'polaroid', 'picture', 'photography'],
    defaultSize: 180,
    svg: s(`
      <rect x="20" y="16" width="60" height="68" rx="2" ${g('#CCCCCC','#FFFFFF',2)}/>
      <rect x="26" y="22" width="48" height="42" ${g('#AAAAAA','#DDDDEE',1.5)}/>
      <path ${g('#BBBBCC','none',1.5)} d="M26 44 L74 44 L74 64 L26 64 Z"/>
      <path ${g('#7788AA','none',1)} d="M26 22 A30 30 0 0 1 56 22"/>
      <text x="50" y="75" text-anchor="middle" font-family="'Courier New',monospace" font-size="8" fill="#888">09.2026</text>
    `)
  },
  {
    id: 'photo-magnifier',
    name: 'Magnifier',
    tags: ['magnifier', 'loupe', 'photography', 'inspect', 'zoom'],
    defaultSize: 200,
    svg: s(`
      <circle cx="42" cy="42" r="24" ${g('#555','rgba(180,220,255,0.3)',3)}/>
      <circle cx="42" cy="42" r="18" ${g('#6688AA','rgba(200,230,255,0.2)',1.5)}/>
      <line x1="60" y1="60" x2="82" y2="82" ${g('#444','none',4)}/>
      <circle cx="36" cy="36" r="6" fill="rgba(255,255,255,0.25)" stroke="none"/>
    `)
  },
  {
    id: 'photo-exposuremeter',
    name: 'Light Meter',
    tags: ['light meter', 'exposure', 'photography', 'meter', 'gauge'],
    defaultSize: 190,
    svg: s(`
      <rect x="20" y="30" width="60" height="50" rx="6" ${g('#2A2A2A','#3A3A3A',2.5)}/>
      <path ${g('#FFD700','none',2.5)} d="M50 55 A16 16 0 0 1 66 55"/>
      <line x1="50" y1="55" x2="61" y2="44" ${g('#FF4444','none',2)}/>
      <circle cx="50" cy="55" r="3" fill="#FFD700"/>
      <rect x="40" y="78" width="20" height="6" rx="3" ${g('#1a1a1a','#555',1.5)}/>
      <circle cx="35" cy="36" r="4" ${g('#FFD700','#FFD700',1)}/>
      <path ${g('#FFD700','none',1.5)} d="M30 30 L26 24 M24 34 L18 32 M28 38 L22 40"/>
    `)
  },
  {
    id: 'photo-darkroomtimer',
    name: 'Darkroom Timer',
    tags: ['timer', 'darkroom', 'photography', 'time', 'clock'],
    defaultSize: 180,
    svg: s(`
      <circle cx="50" cy="52" r="30" ${g('#CC3333','#DDDDDD',2.5)}/>
      <circle cx="50" cy="52" r="24" ${g('#AAAAAA','#F5F5F5',1.5)}/>
      <line x1="50" y1="30" x2="50" y2="52" ${g('#1a1a1a','none',2.5)}/>
      <line x1="50" y1="52" x2="64" y2="58" ${g('#CC3333','none',2)}/>
      <circle cx="50" cy="52" r="3" fill="#1a1a1a"/>
      <line x1="50" y1="28" x2="50" y2="24" ${g('#CC3333','none',2)}/>
      <line x1="72" y1="52" x2="76" y2="52" ${g('#CC3333','none',2)}/>
      <line x1="50" y1="76" x2="50" y2="80" ${g('#CC3333','none',2)}/>
      <line x1="28" y1="52" x2="24" y2="52" ${g('#CC3333','none',2)}/>
      <rect x="38" y="18" width="24" height="8" rx="3" ${g('#CC3333','#EEEEEE',1.5)}/>
    `)
  },
  {
    id: 'photo-35mmslide',
    name: '35mm Slide',
    tags: ['slide', '35mm', 'photography', 'film', 'vintage'],
    defaultSize: 200,
    svg: s(`
      <rect x="12" y="22" width="76" height="56" rx="3" ${g('#1a1a1a','#2A2A2A',2.5)}/>
      <rect x="22" y="30" width="56" height="40" rx="1" ${g('#555','#8899BB',2)}/>
      <rect x="14" y="27" width="6" height="6" rx="1" fill="#555"/>
      <rect x="80" y="27" width="6" height="6" rx="1" fill="#555"/>
      <rect x="14" y="67" width="6" height="6" rx="1" fill="#555"/>
      <rect x="80" y="67" width="6" height="6" rx="1" fill="#555"/>
    `)
  },
  {
    id: 'photo-camerastrap',
    name: 'Camera Strap',
    tags: ['strap', 'camera strap', 'photography', 'carry', 'leather'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#8B4513','none',8)} d="M20 40 Q30 25 50 22 Q70 25 80 40"/>
      <path ${g('#6B2F0A','none',4)} d="M20 40 Q30 25 50 22 Q70 25 80 40"/>
      <rect x="14" y="36" width="12" height="8" rx="2" ${g('#888','#AAAAAA',2)}/>
      <rect x="74" y="36" width="12" height="8" rx="2" ${g('#888','#AAAAAA',2)}/>
      <path ${g('#8B4513','none',6)} d="M26 44 Q50 55 74 44"/>
      <path ${g('#A0522D','none',3)} d="M26 44 Q50 55 74 44"/>
    `)
  },
  {
    id: 'photo-negativecup',
    name: 'Negative Strip',
    tags: ['negative', 'film negative', 'photography', 'analog', 'darkroom'],
    defaultSize: 200,
    svg: s(`
      <rect x="18" y="20" width="64" height="60" rx="2" ${g('#1a1a1a','#111',2)}/>
      <rect x="24" y="26" width="20" height="14" rx="1" ${g('#333','#223344',1.5)}/>
      <rect x="56" y="26" width="20" height="14" rx="1" ${g('#333','#443322',1.5)}/>
      <rect x="24" y="46" width="20" height="14" rx="1" ${g('#333','#224433',1.5)}/>
      <rect x="56" y="46" width="20" height="14" rx="1" ${g('#333','#332244',1.5)}/>
      <rect x="18" y="20" width="6" height="4" rx="1" fill="#333"/>
      <rect x="30" y="20" width="6" height="4" rx="1" fill="#333"/>
      <rect x="42" y="20" width="6" height="4" rx="1" fill="#333"/>
      <rect x="54" y="20" width="6" height="4" rx="1" fill="#333"/>
      <rect x="66" y="20" width="6" height="4" rx="1" fill="#333"/>
      <rect x="18" y="76" width="6" height="4" rx="1" fill="#333"/>
      <rect x="30" y="76" width="6" height="4" rx="1" fill="#333"/>
      <rect x="42" y="76" width="6" height="4" rx="1" fill="#333"/>
    `)
  }
];

// ─── FLORAL PACK ──────────────────────────────────────────────────────────────
const FLORAL = [
  {
    id: 'floral-rose',
    name: 'Rose',
    tags: ['rose', 'flower', 'floral', 'love', 'romantic'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#C0392B','#E74C3C',2.5)} d="M50 30 C50 30 38 38 36 48 C34 58 40 66 50 68 C60 66 66 58 64 48 C62 38 50 30 50 30 Z"/>
      <path ${g('#C0392B','#E74C3C',2)} d="M50 30 C50 30 62 36 66 46 C70 56 64 68 50 68"/>
      <path ${g('#C0392B','#C0392B',2)} d="M50 30 C50 30 38 36 34 46 C30 56 36 68 50 68"/>
      <path ${g('#C0392B','rgba(240,80,80,0.4)',1.5)} d="M50 30 C48 38 46 48 50 58 C54 48 52 38 50 30"/>
      <path ${g('#27AE60','none',2.5)} d="M50 68 L50 85"/>
      <path ${g('#27AE60','#2ECC71',2)} d="M50 76 C44 72 38 74 36 80"/>
      <path ${g('#27AE60','#2ECC71',2)} d="M50 72 C56 68 62 70 64 76"/>
    `)
  },
  {
    id: 'floral-daisy',
    name: 'Daisy',
    tags: ['daisy', 'flower', 'floral', 'white', 'meadow'],
    defaultSize: 200,
    svg: s(`
      <circle cx="50" cy="50" r="11" ${g('#F4A020','#FFD700',2.5)}/>
      <ellipse cx="50" cy="23" rx="7" ry="14" ${g('#DDDDDD','#FFFFFF',2)}/>
      <ellipse cx="50" cy="77" rx="7" ry="14" ${g('#DDDDDD','#FFFFFF',2)}/>
      <ellipse cx="23" cy="50" rx="14" ry="7" ${g('#DDDDDD','#FFFFFF',2)}/>
      <ellipse cx="77" cy="50" rx="14" ry="7" ${g('#DDDDDD','#FFFFFF',2)}/>
      <ellipse cx="30" cy="30" rx="7" ry="14" transform="rotate(45 30 30)" ${g('#DDDDDD','#FFFFFF',2)}/>
      <ellipse cx="70" cy="30" rx="7" ry="14" transform="rotate(-45 70 30)" ${g('#DDDDDD','#FFFFFF',2)}/>
      <ellipse cx="30" cy="70" rx="7" ry="14" transform="rotate(-45 30 70)" ${g('#DDDDDD','#FFFFFF',2)}/>
      <ellipse cx="70" cy="70" rx="7" ry="14" transform="rotate(45 70 70)" ${g('#DDDDDD','#FFFFFF',2)}/>
      <circle cx="50" cy="50" r="9" ${g('#E8980A','#FFD700',1.5)}/>
      <circle cx="47" cy="47" r="2.5" fill="rgba(255,255,255,0.5)" stroke="none"/>
    `)
  },
  {
    id: 'floral-tulip',
    name: 'Tulip',
    tags: ['tulip', 'flower', 'floral', 'spring', 'dutch'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#E84080','#FF6BA8',2.5)} d="M50 55 C40 55 30 45 30 35 C30 25 38 18 45 20 C42 28 44 35 50 38 C56 35 58 28 55 20 C62 18 70 25 70 35 C70 45 60 55 50 55 Z"/>
      <line x1="50" y1="55" x2="50" y2="84" ${g('#27AE60','none',3)}/>
      <path ${g('#27AE60','#2ECC71',2)} d="M50 70 C44 65 36 66 34 72"/>
      <path ${g('#27AE60','#2ECC71',2)} d="M50 76 C56 71 64 72 66 78"/>
    `)
  },
  {
    id: 'floral-lavender',
    name: 'Lavender',
    tags: ['lavender', 'herb', 'purple', 'floral', 'provence'],
    defaultSize: 200,
    svg: s(`
      <line x1="50" y1="80" x2="50" y2="40" ${g('#27AE60','none',2.5)}/>
      <ellipse cx="50" cy="36" rx="5" ry="8" ${g('#8E44AD','#BB8FCC',2)}/>
      <ellipse cx="43" cy="42" rx="4" ry="7" transform="rotate(-15 43 42)" ${g('#8E44AD','#9B59B6',2)}/>
      <ellipse cx="57" cy="42" rx="4" ry="7" transform="rotate(15 57 42)" ${g('#8E44AD','#9B59B6',2)}/>
      <ellipse cx="38" cy="50" rx="4" ry="7" transform="rotate(-25 38 50)" ${g('#8E44AD','#A569BD',2)}/>
      <ellipse cx="62" cy="50" rx="4" ry="7" transform="rotate(25 62 50)" ${g('#8E44AD','#A569BD',2)}/>
      <path ${g('#27AE60','none',2)} d="M50 60 C44 57 40 60 38 65"/>
      <path ${g('#27AE60','none',2)} d="M50 65 C56 62 60 65 62 70"/>
    `)
  },
  {
    id: 'floral-cherry-blossom',
    name: 'Cherry Blossom',
    tags: ['cherry blossom', 'sakura', 'spring', 'japanese', 'floral'],
    defaultSize: 220,
    svg: s(`
      <path ${g('#5C3A1E','none',3)} d="M30 80 C30 65 40 55 50 45 C60 35 65 25 70 15"/>
      <path ${g('#5C3A1E','none',2.5)} d="M50 45 C40 40 30 42 25 50"/>
      <path ${g('#5C3A1E','none',2)} d="M60 35 C68 35 74 30 76 22"/>
      <path ${g('#FFB7C5','#FFD5DE',2)} d="M32 32 C32 27 36 24 40 24 C40 20 44 18 47 20 C48 16 52 16 54 20 C57 18 61 20 61 24 C65 24 68 27 68 32 C68 37 65 40 61 40 C61 44 57 46 54 44 C52 48 48 48 47 44 C44 46 40 44 40 40 C36 40 32 37 32 32 Z"/>
      <circle cx="50" cy="32" r="4" ${g('#F4A020','#FFD700',1.5)}/>
      <path ${g('#FFB7C5','#FFD5DE',1.5)} d="M62 58 C65 55 68 58 66 62 C70 62 72 66 69 68 C71 72 68 74 65 72 C64 76 60 76 59 72 C56 74 53 72 54 68 C51 66 53 62 57 62 C55 58 59 56 62 58 Z"/>
      <circle cx="62" cy="65" r="3" ${g('#F4A020','#FFD700',1)}/>
    `)
  },
  {
    id: 'floral-leaves',
    name: 'Leaves',
    tags: ['leaves', 'green', 'nature', 'plant', 'foliage'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#27AE60','#2ECC71',2.5)} d="M50 80 C50 80 25 65 22 45 C20 30 30 18 42 20 C44 30 48 40 50 50"/>
      <path ${g('#1E8449','none',1.5)} d="M22 45 C32 40 42 42 50 50"/>
      <path ${g('#1ABC9C','#27AE60',2.5)} d="M50 80 C50 80 75 65 78 45 C80 30 70 18 58 20 C56 30 52 40 50 50"/>
      <path ${g('#148F77','none',1.5)} d="M78 45 C68 40 58 42 50 50"/>
      <line x1="50" y1="50" x2="50" y2="80" ${g('#27AE60','none',2)}/>
    `)
  },
  {
    id: 'floral-mushroom',
    name: 'Mushroom',
    tags: ['mushroom', 'fungi', 'forest', 'cute', 'nature'],
    defaultSize: 180,
    svg: s(`
      <rect x="40" y="56" width="20" height="28" rx="4" ${g('#DEB887','#F5DEB3',2.5)}/>
      <path ${g('#CC3333','#E84040',2.5)} d="M18 56 Q50 18 82 56 Z"/>
      <circle cx="38" cy="38" r="5" fill="white" opacity="0.8"/>
      <circle cx="55" cy="28" r="6" fill="white" opacity="0.8"/>
      <circle cx="68" cy="42" r="4" fill="white" opacity="0.8"/>
      <path ${g('#AAAAAA','none',1.5)} d="M40 56 L60 56"/>
      <path ${g('#AAAAAA','none',1)} d="M38 64 C42 62 58 62 62 64"/>
      <path ${g('#AAAAAA','none',1)} d="M38 72 C42 70 58 70 62 72"/>
    `)
  },
  {
    id: 'floral-fern',
    name: 'Fern Frond',
    tags: ['fern', 'frond', 'botanical', 'tropical', 'green'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#27AE60','none',2.5)} d="M50 85 C52 70 54 55 60 40 C66 25 72 18 75 12"/>
      <path ${g('#2ECC71','none',1.5)} d="M52 80 C46 76 40 78 38 84"/>
      <path ${g('#2ECC71','none',1.5)} d="M54 72 C60 68 66 70 68 76"/>
      <path ${g('#2ECC71','none',1.5)} d="M55 64 C49 60 43 62 41 68"/>
      <path ${g('#2ECC71','none',1.5)} d="M57 56 C63 52 69 54 71 60"/>
      <path ${g('#2ECC71','none',1.5)} d="M58 48 C52 44 46 46 44 52"/>
      <path ${g('#2ECC71','none',1.5)} d="M60 40 C66 36 72 38 74 44"/>
      <path ${g('#27AE60','none',1.5)} d="M62 32 C56 28 50 30 48 36"/>
    `)
  },
  {
    id: 'floral-berries',
    name: 'Berry Branch',
    tags: ['berries', 'branch', 'autumn', 'red berries', 'botanical'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#5C3A1E','none',2.5)} d="M50 80 L50 55 C50 55 40 45 30 40"/>
      <path ${g('#5C3A1E','none',2)} d="M50 60 C58 52 68 48 76 44"/>
      <path ${g('#5C3A1E','none',2)} d="M50 50 C44 42 40 36 38 28"/>
      <circle cx="28" cy="38" r="7" ${g('#C0392B','#E74C3C',2)}/>
      <circle cx="38" cy="26" r="6" ${g('#C0392B','#E74C3C',2)}/>
      <circle cx="78" cy="42" r="7" ${g('#C0392B','#E74C3C',2)}/>
      <circle cx="68" cy="52" r="5" ${g('#C0392B','#E74C3C',2)}/>
      <circle cx="26" cy="36" r="2" fill="rgba(255,255,255,0.4)" stroke="none"/>
      <circle cx="36" cy="24" r="1.5" fill="rgba(255,255,255,0.4)" stroke="none"/>
      <circle cx="76" cy="40" r="2" fill="rgba(255,255,255,0.4)" stroke="none"/>
    `)
  },
  {
    id: 'floral-clover',
    name: 'Four-Leaf Clover',
    tags: ['clover', 'lucky', 'four leaf', 'shamrock', 'nature'],
    defaultSize: 180,
    svg: s(`
      <circle cx="50" cy="34" r="16" ${g('#27AE60','#2ECC71',2.5)}/>
      <circle cx="50" cy="66" r="16" ${g('#27AE60','#2ECC71',2.5)}/>
      <circle cx="34" cy="50" r="16" ${g('#27AE60','#2ECC71',2.5)}/>
      <circle cx="66" cy="50" r="16" ${g('#27AE60','#2ECC71',2.5)}/>
      <path ${g('#1E8449','none',1.5)} d="M50 34 C47 37 46 46 50 50"/>
      <path ${g('#1E8449','none',1.5)} d="M50 66 C47 63 46 54 50 50"/>
      <path ${g('#1E8449','none',1.5)} d="M34 50 C37 47 46 46 50 50"/>
      <path ${g('#1E8449','none',1.5)} d="M66 50 C63 47 54 46 50 50"/>
      <line x1="50" y1="50" x2="50" y2="84" ${g('#27AE60','none',2.5)}/>
    `)
  },
  {
    id: 'floral-hibiscus',
    name: 'Hibiscus',
    tags: ['hibiscus', 'tropical', 'flower', 'hawaii', 'pink'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#E84080','#FF6BA8',2.5)} d="M50 50 C40 35 20 30 14 40 C8 50 20 62 35 58 C22 65 18 80 28 84 C38 88 46 72 50 58"/>
      <path ${g('#E84080','#FF6BA8',2.5)} d="M50 50 C60 35 80 30 86 40 C92 50 80 62 65 58 C78 65 82 80 72 84 C62 88 54 72 50 58"/>
      <path ${g('#E84080','#FF6BA8',2.5)} d="M50 50 C35 55 20 70 26 80 C32 90 48 82 52 66"/>
      <path ${g('#E84080','#FF6BA8',2.5)} d="M50 50 C55 35 48 14 38 14 C28 14 26 30 38 38"/>
      <path ${g('#E84080','#FF6BA8',2.5)} d="M50 50 C62 36 68 16 58 14 C48 12 44 30 50 50"/>
      <line x1="50" y1="50" x2="50" y2="30" ${g('#F4A020','none',2)}/>
      <circle cx="50" cy="28" r="4" ${g('#F4A020','#FFD700',1.5)}/>
      <circle cx="46" cy="24" r="2" fill="#F4A020"/>
      <circle cx="54" cy="24" r="2" fill="#F4A020"/>
      <circle cx="50" cy="20" r="2" fill="#F4A020"/>
    `)
  },
  {
    id: 'floral-petals',
    name: 'Scattered Petals',
    tags: ['petals', 'falling', 'blossom', 'spring', 'floral'],
    defaultSize: 200,
    svg: s(`
      <ellipse cx="25" cy="30" rx="8" ry="5" transform="rotate(-30 25 30)" ${g('#E84080','#FFB7C5',1.5)}/>
      <ellipse cx="70" cy="20" rx="7" ry="4" transform="rotate(20 70 20)" ${g('#E84080','#FFB7C5',1.5)}/>
      <ellipse cx="80" cy="55" rx="8" ry="5" transform="rotate(60 80 55)" ${g('#E84080','#FFD5DE',1.5)}/>
      <ellipse cx="35" cy="70" rx="9" ry="5" transform="rotate(-50 35 70)" ${g('#E84080','#FFB7C5',1.5)}/>
      <ellipse cx="65" cy="75" rx="7" ry="4" transform="rotate(40 65 75)" ${g('#E84080','#FFD5DE',1.5)}/>
      <ellipse cx="50" cy="45" rx="10" ry="6" transform="rotate(-15 50 45)" ${g('#C0392B','#E74C3C',1.5)}/>
      <ellipse cx="15" cy="58" rx="6" ry="4" transform="rotate(70 15 58)" ${g('#E84080','#FFB7C5',1.5)}/>
      <ellipse cx="85" cy="35" rx="7" ry="4" transform="rotate(-40 85 35)" ${g('#E84080','#FFD5DE',1.5)}/>
    `)
  },
  {
    id: 'floral-botanical-frame',
    name: 'Botanical Oval',
    tags: ['botanical', 'frame', 'oval', 'wreath', 'leaves'],
    defaultSize: 220,
    svg: s(`
      <ellipse cx="50" cy="50" rx="28" ry="36" ${g('#27AE60','none',2)}/>
      <path ${g('#2ECC71','none',2)} d="M22 50 C16 42 14 30 20 22 C26 14 32 18 30 26 C28 22 30 18 34 20"/>
      <path ${g('#2ECC71','none',2)} d="M78 50 C84 42 86 30 80 22 C74 14 68 18 70 26 C72 22 70 18 66 20"/>
      <path ${g('#2ECC71','none',2)} d="M22 50 C16 58 14 70 20 78 C26 86 32 82 30 74 C28 78 30 82 34 80"/>
      <path ${g('#2ECC71','none',2)} d="M78 50 C84 58 86 70 80 78 C74 86 68 82 70 74 C72 78 70 82 66 80"/>
      <path ${g('#27AE60','none',1.5)} d="M50 14 C44 16 40 22 42 28"/>
      <path ${g('#27AE60','none',1.5)} d="M50 14 C56 16 60 22 58 28"/>
      <path ${g('#27AE60','none',1.5)} d="M50 86 C44 84 40 78 42 72"/>
      <path ${g('#27AE60','none',1.5)} d="M50 86 C56 84 60 78 58 72"/>
    `)
  },
  {
    id: 'floral-driedflower',
    name: 'Dried Flower',
    tags: ['dried flower', 'pressed', 'vintage', 'botanical', 'memory'],
    defaultSize: 200,
    svg: s(`
      <line x1="50" y1="85" x2="50" y2="40" ${g('#8B6914','none',2.5)}/>
      <path ${g('#C9A840','none',1.5)} d="M50 62 C44 58 38 60 36 66"/>
      <path ${g('#C9A840','none',1.5)} d="M50 52 C56 48 62 50 64 56"/>
      <ellipse cx="50" cy="36" rx="14" ry="8" transform="rotate(-15 50 36)" ${g('#C9A840','#E8C85A',2)} opacity="0.8"/>
      <ellipse cx="50" cy="38" rx="10" ry="6" transform="rotate(20 50 38)" ${g('#C9A840','#F0D870',2)} opacity="0.7"/>
      <ellipse cx="50" cy="34" rx="8" ry="5" transform="rotate(-40 50 34)" ${g('#C9A840','#E8C85A',1.5)} opacity="0.9"/>
      <circle cx="50" cy="36" r="4" ${g('#8B6914','#B8860B',1.5)}/>
    `)
  }
];

// ─── VINTAGE PACK ────────────────────────────────────────────────────────────
const VINTAGE = [
  {
    id: 'vintage-mirror',
    name: 'Hand Mirror',
    tags: ['mirror', 'vintage', 'beauty', 'vanity', 'antique'],
    defaultSize: 180,
    svg: s(`
      <ellipse cx="50" cy="40" rx="24" ry="28" ${g('#C8A050','#E8C878',2.5)}/>
      <ellipse cx="50" cy="40" rx="20" ry="24" ${g('#B8903A','rgba(200,230,240,0.4)',1.5)}/>
      <rect x="44" y="65" width="12" height="22" rx="4" ${g('#C8A050','#D4B060',2.5)}/>
      <ellipse cx="50" cy="72" rx="10" ry="5" ${g('#C8A050','#D4B060',2)}/>
      <ellipse cx="40" cy="32" rx="5" ry="8" fill="rgba(255,255,255,0.3)" stroke="none"/>
    `)
  },
  {
    id: 'vintage-perfume',
    name: 'Perfume Bottle',
    tags: ['perfume', 'bottle', 'vintage', 'beauty', 'luxury'],
    defaultSize: 180,
    svg: s(`
      <rect x="32" y="40" width="36" height="42" rx="8" ${g('#9B59B6','rgba(200,150,220,0.7)',2.5)}/>
      <rect x="38" y="30" width="24" height="12" rx="4" ${g('#8E44AD','rgba(180,130,200,0.8)',2)}/>
      <rect x="44" y="22" width="12" height="10" rx="3" ${g('#7D3C98','rgba(160,110,180,0.9)',2)}/>
      <circle cx="50" cy="20" r="4" ${g('#7D3C98','#C39BD3',1.5)}/>
      <path ${g('rgba(255,255,255,0.5)','none',2)} d="M36 48 Q44 44 50 48"/>
      <path ${g('#9B59B6','none',1.5)} d="M38 58 Q50 54 62 58"/>
      <rect x="36" y="70" width="28" height="6" rx="2" ${g('#7D3C98','rgba(200,150,220,0.4)',1.5)}/>
    `)
  },
  {
    id: 'vintage-bow',
    name: 'Ribbon Bow',
    tags: ['bow', 'ribbon', 'vintage', 'gift', 'cute'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#CC4488','#E8709A',2.5)} d="M50 50 C40 44 25 35 22 42 C19 49 30 56 50 50"/>
      <path ${g('#CC4488','#E8709A',2.5)} d="M50 50 C60 44 75 35 78 42 C81 49 70 56 50 50"/>
      <path ${g('#CC4488','#E8709A',2)} d="M50 50 C44 54 35 62 32 70"/>
      <path ${g('#CC4488','#E8709A',2)} d="M50 50 C56 54 65 62 68 70"/>
      <circle cx="50" cy="50" r="7" ${g('#AA2266','#E8709A',2)}/>
      <circle cx="47" cy="47" r="2" fill="rgba(255,255,255,0.4)" stroke="none"/>
    `)
  },
  {
    id: 'vintage-candle',
    name: 'Candle',
    tags: ['candle', 'vintage', 'light', 'romantic', 'cozy'],
    defaultSize: 180,
    svg: s(`
      <rect x="38" y="50" width="24" height="36" rx="3" ${g('#DEB887','#F5F5DC',2.5)}/>
      <path ${g('#DEB887','none',1.5)} d="M42 56 L58 56 M42 64 L58 64 M42 72 L58 72"/>
      <path ${g('#F4A020','none',2)} d="M50 50 C46 44 44 38 48 32 C50 40 56 38 54 32 C58 38 56 44 50 50"/>
      <path ${g('#FFD700','rgba(255,200,0,0.5)',1.5)} d="M50 48 C47 43 46 38 49 34 C50 39 53 38 52 34 C55 38 54 43 50 48"/>
      <ellipse cx="50" cy="34" rx="6" ry="8" fill="rgba(255,200,0,0.2)" stroke="none"/>
    `)
  },
  {
    id: 'vintage-key',
    name: 'Antique Key',
    tags: ['key', 'vintage', 'antique', 'lock', 'secret'],
    defaultSize: 200,
    svg: s(`
      <circle cx="38" cy="38" r="16" ${g('#B8860B','none',3)}/>
      <circle cx="38" cy="38" r="10" ${g('#B8860B','none',2)}/>
      <circle cx="38" cy="38" r="4" ${g('#B8860B','none',1.5)}/>
      <line x1="50" y1="46" x2="78" y2="74" ${g('#B8860B','none',3.5)}/>
      <line x1="68" y1="64" x2="74" y2="58" ${g('#B8860B','none',3)}/>
      <line x1="74" y1="70" x2="80" y2="64" ${g('#B8860B','none',3)}/>
    `)
  },
  {
    id: 'vintage-waxseal',
    name: 'Wax Seal',
    tags: ['wax seal', 'seal', 'vintage', 'letter', 'official'],
    defaultSize: 180,
    svg: s(`
      <circle cx="50" cy="50" r="32" ${g('#CC3333','#E84040',2.5)}/>
      <circle cx="50" cy="50" r="26" ${g('#AA2222','none',1.5)}/>
      <path ${g('#AA2222','none',2)} d="M50 28 L54 42 L68 42 L57 51 L61 65 L50 56 L39 65 L43 51 L32 42 L46 42 Z"/>
    `)
  },
  {
    id: 'vintage-teacup',
    name: 'Teacup',
    tags: ['teacup', 'tea', 'vintage', 'english', 'cozy'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#8B4513','#F5F5DC',2.5)} d="M22 50 Q22 74 50 78 Q78 74 78 50 L72 38 L28 38 Z"/>
      <ellipse cx="50" cy="38" rx="28" ry="8" ${g('#8B4513','#FFFFFF',2)}/>
      <path ${g('#8B4513','none',2.5)} d="M78 52 C86 52 90 56 90 62 C90 68 86 70 78 68"/>
      <rect x="22" y="78" width="56" height="8" rx="3" ${g('#8B4513','#DEB887',2)}/>
      <path ${g('#C8A050','none',1.5)} d="M35 42 Q40 48 35 54"/>
      <path ${g('#C8A050','none',1.5)} d="M50 42 Q55 48 50 54"/>
      <path ${g('#C8A050','none',1.5)} d="M65 42 Q70 48 65 54"/>
    `)
  },
  {
    id: 'vintage-hourglass',
    name: 'Hourglass',
    tags: ['hourglass', 'time', 'vintage', 'sand', 'timer'],
    defaultSize: 190,
    svg: s(`
      <rect x="28" y="12" width="44" height="10" rx="4" ${g('#B8860B','#D4A020',2.5)}/>
      <rect x="28" y="78" width="44" height="10" rx="4" ${g('#B8860B','#D4A020',2.5)}/>
      <path ${g('#B8860B','rgba(240,230,200,0.4)',2)} d="M28 22 L50 50 L72 22 Z"/>
      <path ${g('#B8860B','rgba(240,200,120,0.6)',2)} d="M28 78 L50 50 L72 78 Z"/>
      <path ${g('#D4A020','none',1.5)} d="M46 68 Q50 60 54 68"/>
      <line x1="50" y1="50" x2="50" y2="56" ${g('#B8860B','none',2)}/>
    `)
  },
  {
    id: 'vintage-compass',
    name: 'Compass',
    tags: ['compass', 'navigation', 'vintage', 'adventure', 'travel'],
    defaultSize: 200,
    svg: s(`
      <circle cx="50" cy="50" r="34" ${g('#B8860B','#F5F5DC',2.5)}/>
      <circle cx="50" cy="50" r="28" ${g('#999','none',1.5)}/>
      <path ${g('#CC3333','#CC3333',2)} d="M50 22 L54 50 L50 46 L46 50 Z"/>
      <path ${g('#333','#333',2)} d="M50 78 L46 50 L50 54 L54 50 Z"/>
      <path ${g('#888','#888',1.5)} d="M22 50 L46 46 L42 50 L46 54 Z"/>
      <path ${g('#888','#888',1.5)} d="M78 50 L54 54 L58 50 L54 46 Z"/>
      <circle cx="50" cy="50" r="5" ${g('#B8860B','#D4A020',1.5)}/>
      <text x="50" y="20" text-anchor="middle" font-size="8" fill="#333" font-weight="bold">N</text>
      <text x="50" y="84" text-anchor="middle" font-size="8" fill="#333">S</text>
      <text x="18" y="54" text-anchor="middle" font-size="8" fill="#333">W</text>
      <text x="82" y="54" text-anchor="middle" font-size="8" fill="#333">E</text>
    `)
  },
  {
    id: 'vintage-envelope',
    name: 'Sealed Letter',
    tags: ['envelope', 'letter', 'mail', 'vintage', 'correspondence'],
    defaultSize: 200,
    svg: s(`
      <rect x="12" y="32" width="76" height="52" rx="4" ${g('#C8A050','#FFF8E7',2.5)}/>
      <path ${g('#B89040','none',2)} d="M12 32 L50 60 L88 32"/>
      <path ${g('#B89040','none',1.5)} d="M12 84 L38 58"/>
      <path ${g('#B89040','none',1.5)} d="M88 84 L62 58"/>
      <circle cx="50" cy="58" r="10" ${g('#CC3333','#E84040',2)}/>
      <path ${g('#AA2222','none',1.5)} d="M50 50 L54 62 L50 58 L46 62 Z"/>
    `)
  },
  {
    id: 'vintage-pocketwatch',
    name: 'Pocket Watch',
    tags: ['pocket watch', 'watch', 'vintage', 'time', 'antique'],
    defaultSize: 200,
    svg: s(`
      <circle cx="50" cy="55" r="32" ${g('#B8860B','#F5EDD6',2.5)}/>
      <circle cx="50" cy="55" r="26" ${g('#C8A050','#FFFEF0',1.5)}/>
      <path ${g('#333','none',2.5)} d="M50 31 L50 55"/>
      <path ${g('#CC3333','none',2)} d="M50 55 L64 48"/>
      <circle cx="50" cy="55" r="3" fill="#B8860B"/>
      <rect x="44" y="16" width="12" height="8" rx="3" ${g('#B8860B','#D4A020',2)}/>
      <path ${g('#B8860B','none',1.5)} d="M50 15 C46 10 44 6 46 4 C48 2 52 4 50 10"/>
      <text x="50" y="74" text-anchor="middle" font-size="7" fill="#888">SWISS MADE</text>
      <text x="36" y="58" text-anchor="middle" font-size="7" fill="#555">9</text>
      <text x="64" y="58" text-anchor="middle" font-size="7" fill="#555">3</text>
      <text x="50" y="38" text-anchor="middle" font-size="7" fill="#555">12</text>
    `)
  },
  {
    id: 'vintage-lantern',
    name: 'Lantern',
    tags: ['lantern', 'light', 'vintage', 'cozy', 'antique'],
    defaultSize: 190,
    svg: s(`
      <path ${g('#B8860B','#D4A020',2.5)} d="M38 28 L30 70 L30 80 L70 80 L70 70 L62 28 Z"/>
      <path ${g('#FFF176','rgba(255,241,118,0.4)',1.5)} d="M40 30 L32 70 L68 70 L60 30 Z"/>
      <line x1="36" y1="40" x2="64" y2="40" ${g('#B8860B','none',1.5)}/>
      <line x1="34" y1="52" x2="66" y2="52" ${g('#B8860B','none',1.5)}/>
      <line x1="32" y1="64" x2="68" y2="64" ${g('#B8860B','none',1.5)}/>
      <rect x="30" y="76" width="40" height="6" rx="2" ${g('#B8860B','#D4A020',2)}/>
      <path ${g('#B8860B','none',2)} d="M44 28 L56 28 L54 18 L46 18 Z"/>
      <circle cx="50" cy="12" r="4" ${g('#B8860B','#FFD700',1.5)}/>
      <path ${g('#F4A020','rgba(255,200,0,0.4)',1.5)} d="M50 54 C46 48 44 42 48 36 C50 42 54 40 52 36 C56 42 54 48 50 54"/>
    `)
  },
  {
    id: 'vintage-stamp',
    name: 'Postage Stamp',
    tags: ['stamp', 'postage', 'vintage', 'mail', 'philately'],
    defaultSize: 190,
    svg: s(`
      <path ${g('#C8A050','#FFF8E7',2)} d="M18 18 L82 18 L82 82 L18 82 Z" stroke-dasharray="6,6" stroke-dashoffset="0"/>
      <rect x="24" y="24" width="52" height="52" ${g('#B89040','#EDE0C4',1.5)}/>
      <rect x="30" y="30" width="40" height="32" ${g('#888','#AAB0CC',1.5)}/>
      <text x="50" y="76" text-anchor="middle" font-size="9" font-weight="bold" fill="#8B4513">INDIA</text>
      <text x="50" y="68" text-anchor="middle" font-size="8" fill="#8B4513">₹5</text>
    `)
  },
  {
    id: 'vintage-gramophone',
    name: 'Gramophone Horn',
    tags: ['gramophone', 'music', 'vintage', 'record', 'phonograph'],
    defaultSize: 200,
    svg: s(`
      <path ${g('#B8860B','#D4A020',2.5)} d="M20 75 C20 60 30 52 42 52 C38 45 35 36 38 28 C42 20 52 20 58 26 C64 32 62 42 56 50 L68 38 C78 28 88 36 82 48 C76 60 58 62 42 52"/>
      <rect x="14" y="70" width="30" height="14" rx="5" ${g('#5C3A1E','#8B6914',2.5)}/>
      <ellipse cx="42" cy="52" rx="8" ry="10" ${g('#B8860B','#D4A020',1.5)}/>
    `)
  },
  {
    id: 'vintage-typewriter-key',
    name: 'Typewriter Key',
    tags: ['typewriter', 'key', 'vintage', 'writing', 'retro'],
    defaultSize: 160,
    svg: s(`
      <circle cx="50" cy="50" r="32" ${g('#333','#444',2.5)}/>
      <circle cx="50" cy="50" r="26" ${g('#222','#2A2A2A',2)}/>
      <circle cx="50" cy="50" r="22" ${g('#555','#EEEEEE',1.5)}/>
      <text x="50" y="56" text-anchor="middle" font-size="22" font-weight="bold" font-family="Courier New,monospace" fill="#1a1a1a">A</text>
    `)
  }
];

// ─── Base Built-In Catalog ───────────────────────────────────────────────────
export const BUILTIN_STICKERS = [
  ...OCEAN.map(s => ({ ...s, pack: 'ocean' })),
  ...SUMMER.map(s => ({ ...s, pack: 'summer' })),
  ...PHOTOGRAPHY.map(s => ({ ...s, pack: 'photography' })),
  ...FLORAL.map(s => ({ ...s, pack: 'floral' })),
  ...VINTAGE.map(s => ({ ...s, pack: 'vintage' }))
];

const BUILTIN_PACKS = [
  { id: 'ocean',       label: 'Ocean',        emoji: '🌊', count: OCEAN.length },
  { id: 'summer',      label: 'Summer',       emoji: '☀️', count: SUMMER.length },
  { id: 'photography', label: 'Photography',  emoji: '📷', count: PHOTOGRAPHY.length },
  { id: 'floral',      label: 'Floral',       emoji: '🌸', count: FLORAL.length },
  { id: 'vintage',     label: 'Vintage',      emoji: '🕰️', count: VINTAGE.length }
];

// Runtime dynamic store
let _customStickers = [];
let _customPacks = [];
let _deletedPacks = new Set();

function _normalizePackId(id) {
  if (!id) return '';
  return String(id).toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function _isPackDeleted(id) {
  if (!id) return false;
  const raw = String(id).toLowerCase().trim();
  const slug = _normalizePackId(id);
  return _deletedPacks.has(id) || _deletedPacks.has(raw) || _deletedPacks.has(slug);
}

/**
 * Sync dynamic stickers from backend (/api/stickers)
 */
export function setCustomStickerData({ stickers = [], packs = [], deletedBuiltinPacks = [], deletedPacks = [] } = {}) {
  // Combine all deleted pack records
  const allDeleted = [
    ...(Array.isArray(deletedBuiltinPacks) ? deletedBuiltinPacks : []),
    ...(Array.isArray(deletedPacks) ? deletedPacks : [])
  ];

  _deletedPacks = new Set();
  allDeleted.forEach(d => {
    if (d) {
      _deletedPacks.add(d);
      _deletedPacks.add(String(d).toLowerCase().trim());
      _deletedPacks.add(_normalizePackId(d));
    }
  });

  // Filter custom stickers and packs against deleted packs
  const rawStickers = Array.isArray(stickers) ? stickers : [];
  const rawPacks = Array.isArray(packs) ? packs : [];

  _customStickers = rawStickers.filter(s => !_isPackDeleted(s.pack));
  _customPacks = rawPacks.filter(p => !_isPackDeleted(p.id));

  // Update STICKER_CATALOG and STICKER_PACKS arrays in place for backwards compatibility
  STICKER_CATALOG.length = 0;
  STICKER_CATALOG.push(...getAllStickers());

  STICKER_PACKS.length = 0;
  STICKER_PACKS.push(...getActivePacks());
}

/**
 * Get all active stickers (built-ins not in deletedPacks + custom stickers)
 */
export function getAllStickers() {
  const activeBuiltins = BUILTIN_STICKERS.filter(s => !_isPackDeleted(s.pack));
  return [...activeBuiltins, ..._customStickers];
}

/**
 * Get all active packs
 */
export function getActivePacks() {
  const allStickers = getAllStickers();
  const activeBuiltinPacks = BUILTIN_PACKS
    .filter(p => !_isPackDeleted(p.id))
    .map(p => ({
      ...p,
      count: allStickers.filter(s => s.pack === p.id).length
    }));

  const activeCustomPacks = _customPacks
    .filter(p => !_isPackDeleted(p.id))
    .map(p => ({
      ...p,
      count: allStickers.filter(s => s.pack === p.id).length
    }));

  return [
    { id: 'all', label: 'All', emoji: '✦', count: allStickers.length },
    ...activeBuiltinPacks,
    ...activeCustomPacks
  ];
}

// Mutable arrays for initial load & backwards compatibility
export const STICKER_CATALOG = [...BUILTIN_STICKERS];
export const STICKER_PACKS = [
  { id: 'all', label: 'All', emoji: '✦', count: BUILTIN_STICKERS.length },
  ...BUILTIN_PACKS
];

/**
 * Get stickers for a given pack (or all)
 */
export function getStickersByPack(packId) {
  const all = getAllStickers();
  if (!packId || packId === 'all') return all;
  return all.filter(s => s.pack === packId);
}

/**
 * Search stickers by query
 */
export function searchStickers(query) {
  const all = getAllStickers();
  const q = (query || '').toLowerCase().trim();
  if (!q) return all;
  return all.filter(s =>
    s.name.toLowerCase().includes(q) || (s.tags && s.tags.some(t => t.toLowerCase().includes(q)))
  );
}

/**
 * Get sticker by id
 */
export function getStickerById(id) {
  return getAllStickers().find(s => s.id === id);
}
