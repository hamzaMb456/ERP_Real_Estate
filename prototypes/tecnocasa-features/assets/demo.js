/* Code partagé des prototypes — données simulées, navigation, helpers. */
'use strict';

/** Annonces fictives (vit实e : logements Emerald Immobilier). Champs ≈ PublicListing réel. */
const STORE = [
  { id: 'L-0007', kind: 'rent',  title: 'S+2 neuf avec terrasse',            city: 'Aouina',      price: 1850, rooms: 3, surface: 95,  ref: 'REF 0007' },
  { id: 'L-0102', kind: 'rent',  title: 'Appartement lumineux 4e étage',     city: 'Aouina',      price: 1600, rooms: 2, surface: 78,  ref: 'REF 0102' },
  { id: 'L-0114', kind: 'rent',  title: 'Villa duplex et jardin',            city: 'Aouina',      price: 3900, rooms: 5, surface: 220, ref: 'REF 0114' },
  { id: 'L-0121', kind: 'rent',  title: 'Studio meublé centre-ville',        city: 'La Marsa',    price: 1200, rooms: 1, surface: 45,  ref: 'REF 0121' },
  { id: 'L-0135', kind: 'rent',  title: 'S+3 vue mer',                       city: 'La Marsa',    price: 2150, rooms: 4, surface: 120, ref: 'REF 0135' },
  { id: 'L-0148', kind: 'rent',  title: 'Loft neuf Lac 1',                   city: 'Les Berges du Lac', price: 2050, rooms: 2, surface: 85, ref: 'REF 0148' },
  { id: 'L-0155', kind: 'rent',  title: 'Appartement standing Lac 2',        city: 'Les Berges du Lac', price: 2300, rooms: 3, surface: 110, ref: 'REF 0155' },
  { id: 'L-0201', kind: 'sale',  title: 'S+2 en vente',                      city: 'Aouina',      price: 259000, rooms: 3, surface: 111, ref: 'REF 0201', oldPrice: 269000, priceEvents: [ { when: '12/01/2026', price: 269000, label: 'Mise en ligne' }, { when: '28/10/2026', price: 259000, label: 'Réduction', drop: true } ] },
  { id: 'L-0210', kind: 'sale',  title: 'S+1 familial',                      city: 'Aouina',      price: 199000, rooms: 2, surface: 80,  ref: 'REF 0210' },
  { id: 'L-0219', kind: 'sale',  title: 'S+3 avec garage',                   city: 'Aouina',      price: 289000, rooms: 4, surface: 130, ref: 'REF 0219' },
  { id: 'L-0228', kind: 'sale',  title: 'Studio étudiant',                   city: 'La Marsa',    price: 115000, rooms: 1, surface: 40,  ref: 'REF 0228' },
  { id: 'L-0237', kind: 'sale',  title: 'Appartement à rénover',             city: 'Aouina',      price: 210000, rooms: 3, surface: 98,  ref: 'REF 0237' },
];

const AGENCY = { name: 'Emerald Immobilier', phone: '+216 71 000 000', email: 'contact@emerald-immobilier.tn' };
const WA_NUMBER = '21671000000'; // format wa.me : chiffres uniquement

/** Format TND simple (les vrais montants passent par formatTnd). */
const tnd = (n) => n.toLocaleString('fr-TN').replace(/,/g, ' ') + ' DT';

/** wa.me/<num>?text=<message> — le motif utilisé par Tecnocasa (-contact) et notre ShareButton (partage). */
const waHref = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

/** Port fidèle de web/src/lib/site/similar.ts */
const PRICE_BAND = 0.25;
function sameCity(a, b) {
  if (!a || !b) return false;
  const x = a.trim().toLowerCase(), y = b.trim().toLowerCase();
  return x.length > 0 && x === y;
}
function pickSimilar(base, candidates, band = PRICE_BAND, limit = 3) {
  if (!(base.price > 0) || limit <= 0) return [];
  const low = base.price * (1 - band), high = base.price * (1 + band);
  return candidates
    .filter((c) => c.id !== base.id && c.kind === base.kind && sameCity(c.city, base.city) && c.price >= low && c.price <= high)
    .map((c, i) => ({ c, i, d: Math.abs(c.price - base.price) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, limit)
    .map(({ c }) => c);
}

/** Rendu partagé d'une carte annonce. opts: {selected, similar, excluded, onClick} */
function listingCardHtml(l, json, opts = {}) {
  const cls = (opts.selected ? 'selected' : '') + (opts.similar ? ' similar' : '') + (opts.excluded ? ' excluded' : '');
  const kindLabel = l.kind === 'rent' ? 'À louer' : 'À vendre';
  const price = l.kind === 'rent' ? tnd(l.price) + ' <small>/ mois</small>' : tnd(l.price);
  return `
    <article class="listing-card ${cls}" data-id="${l.id}" ${opts.onClick ? 'tabindex="0" role="button"' : ''}>
      <div class="listing-photo" data-a="${l.id}">${l.ref}</div>
      <div class="listing-body">
        <span class="listing-kind">${kindLabel}${l.kind === 'rent' ? '' : ' · S+2 en vente'}</span>
        <span class="listing-title">${l.title}</span>
        <span class="listing-city">${l.city} · ${l.surface} m² · ${l.rooms} pièces</span>
        ${opts.drop ? `<span class="chips"><span class="price-old">${tnd(l.oldPrice)}</span><span class="listing-price" style="margin:0">${tnd(l.price)}</span><span class="price-drop-badge">▼ ${dropPercent(l)} %</span></span>`
          : `<span class="listing-price">${price}</span>`}
      </div>
    </article>`;
}
function dropPercent(l) {
  if (!l.oldPrice || l.oldPrice <= l.price) return 0;
  return Math.round(((l.oldPrice - l.price) / l.oldPrice) * 100);
}

/** Toast simple. */
function toast(msg, ms = 2600) {
  let el = document.getElementById('toast-box');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-box';
    el.style.cssText = 'position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);background:#12261e;color:#cdeadd;padding:.7rem 1.2rem;border-radius:12px;font-size:.85rem;z-index:90;box-shadow:0 12px 30px -10px rgb(0 0 0/.4);max-width:88vw;text-align:center';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), ms);
}

/** Fermeture générique des modales par backdrop. */
function wireModals() {
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.remove('open'); });
    backdrop.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => backdrop.classList.remove('open')));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
  });
}

const ICON = {
  phone: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  mail: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  wa: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>',
};

/** Header de navigation injecté sur chaque page. */
function renderHeader(current) {
  const pages = [
    { href: 'index.html', label: 'Accueil' },
    { href: '01-whatsapp-contact.html', label: 'WhatsApp contact' },
    { href: '02-request-hardening.html', label: 'Anti-abus demandes' },
    { href: '03-similar-listings.html', label: 'Similaires ±25 %' },
    { href: '04-price-drop-badge.html', label: 'Baisse de prix' },
    { href: '05-print-pdf.html', label: 'Fiche PDF' },
  ];
  const header = document.querySelector('.demo-header');
  if (!header) return;
  header.innerHTML = `
    <a class="brand" href="index.html" style="color:#fff;text-decoration:none">Emerald Immobilier
      <small>Prototypes fonctionnels — données 100 % simulées, aucun backend</small></a>
    <nav class="demo-nav" aria-label="Navigation prototypes">
      ${pages.map((p) => `<a href="${p.href}" ${p.href === current ? 'aria-current="page"' : ''}>${p.label}</a>`).join('')}
    </nav>`;
}
renderHeader(document.body.dataset.page);
wireModals();
