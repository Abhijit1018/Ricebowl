"""Build both self-contained pages: python build-site.py (no dependencies)."""
import json
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / 'menu-data.json').read_text(encoding='utf-8'))
ITEMS = {item['id']: item for item in DATA}
CSS = (ROOT / 'site.css').read_text(encoding='utf-8')
# Live ordering styles (order page, basket, tracking). Kept in their own file for clarity.
STORE_CSS = (ROOT / 'store.css').read_text(encoding='utf-8')
JS = (ROOT / 'site.js').read_text(encoding='utf-8')
CATEGORIES = {'all': 'Everything', 'bowls': 'Chicken bowls', 'veg': 'Vegetarian bowls', 'two': 'Meals for two', 'sides': 'Sides', 'drinks': 'Drinks', 'dessert': 'Dessert'}
MARK = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M5 23h38c-1 12-8 19-19 19S6 35 5 23Z" fill="currentColor"/><path d="M3 23h42M18 42h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M15 16c-6-5 6-6 0-11M24 16c-6-5 6-6 0-11M33 16c-6-5 6-6 0-11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'


def photo(item, eager=False):
    return f'<img src="{escape(item["image"])}" alt="{escape(item["name"])}" loading="{"eager" if eager else "lazy"}" decoding="async" width="720" height="540"{" fetchpriority=high" if eager else ""}>'


def product(item):
    diet = ('<span class="diet">Vegetarian</span>' if item['vegetarian'] else '<span class="diet chicken">Chicken</span>' if item['category'] in ('bowls', 'two') else '<span>' + CATEGORIES[item['category']] + '</span>')
    heat = '<span class="heat">Chilli</span>' if item['spicy'] else ''
    return f'''<article class="product" data-product="{item['id']}">
      <div class="product-photo">{photo(item)}</div>
      <div class="product-body"><div class="product-meta">{diet}{heat}</div>
      <h3>{escape(item['name'])}</h3><p>{escape(item['description'])}</p>
      <div class="product-bottom"><span class="price">₹{item['price']}</span><button class="add" type="button" data-add="{item['id']}" aria-label="Add {escape(item['name'])} to bag">Add <span aria-hidden="true">+</span></button></div></div>
    </article>'''


def header(nav='home'):
    # `nav` is the page we are on, so only that link is marked current.
    home = 'index-standalone.html'
    on_home = nav == 'home'
    section_page = '' if on_home else home
    current = lambda name: ' aria-current="page"' if nav == name else ''
    links = f'<a href="{"#top" if on_home else home}" data-nav="home"{current("home")}>Home</a><a href="menu-standalone.html" data-nav="menu"{current("menu")}>The menu</a><a href="order-standalone.html" data-nav="order"{current("order")}>Order online</a><a href="{section_page}#story" data-nav="story">Our food</a><a href="{section_page}#faq" data-nav="faq">Good to know</a>'
    return f'''<a class="skip" href="#main">Skip to content</a>
    <header class="site-header"><div class="shell header-inner">
      <a class="brand" href="{home}" aria-label="Rice Bowl home">{MARK}<span>rice bowl</span></a>
      <nav class="desktop-nav" aria-label="Main navigation">{links}</nav>
      <a class="btn small order-cta" href="order-standalone.html" data-order-cta>Order online</a>
      <button class="bag-button" type="button" data-open-bag aria-haspopup="dialog">Bag <span class="bag-count">0</span></button>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-navigation" aria-label="Toggle navigation">Menu</button>
      <nav class="mobile-nav" id="mobile-navigation" aria-label="Mobile navigation" hidden>{links}</nav>
    </div></header>'''


def footer():
    return f'''<footer class="site-footer"><div class="shell"><div class="footer-top">
      <div><a class="brand" href="index-standalone.html">{MARK}<span>rice bowl</span></a><p>Rice, something spicy, and a little extra on the side.</p></div>
      <nav class="footer-links" aria-label="Footer navigation"><a href="menu-standalone.html">The menu</a><a href="index-standalone.html#story">Our food</a><a href="index-standalone.html#faq">Good to know</a><a href="#top">Back to top</a></nav>
    </div><div class="footer-bottom"><span>© 2026 Rice Bowl</span><span>Bowls from ₹219 · Sides from ₹129</span></div></div></footer>'''


def bag():
    return '''<dialog class="bag-dialog" aria-labelledby="bag-title"><div class="bag-shell">
      <div class="bag-head"><h2 id="bag-title">Your bag</h2><button class="icon-button" type="button" data-close-bag aria-label="Close bag">×</button></div>
      <div class="bag-content"><div class="bag-empty"><h3>What looks good?</h3><p>Add a bowl or a side to start your list.</p><button class="btn" type="button" data-close-bag>Keep browsing</button></div><div class="bag-items"></div>
      <div class="saved-summary" hidden><label for="bag-summary" id="summary-label">Your saved selection</label><textarea id="bag-summary" readonly></textarea></div></div>
      <div class="bag-footer" hidden><div class="subtotal"><span>Subtotal</span><strong class="bag-total">₹0</strong></div><a class="btn" href="order-standalone.html">Order these online</a><button class="btn secondary" type="button" data-copy-bag>Copy your selection</button><button class="text-link" type="button" data-download-bag>Download as a text file</button><p class="bag-notice">Prices and availability come live from the kitchen. Continue on the order page to place it.</p></div>
      <p class="sr-only bag-status" role="status" aria-live="polite"></p>
    </div></dialog>
    <button class="floating-bag" type="button" data-open-bag aria-haspopup="dialog" hidden><span>View your bag</span><strong class="floating-total"></strong></button>
    <div class="toast" role="status" aria-live="polite" hidden></div>'''


def intro(menu=False):
    return f'''<div class="page-loader" id="page-loader" hidden>
      <div class="loader-lockup"><svg class="loader-bowl" viewBox="0 0 220 190" fill="none" aria-hidden="true">
        <ellipse class="bowl-shadow" cx="110" cy="166" rx="62" ry="7" fill="#102736" opacity=".3"/>
        <g class="loader-steam" stroke="#c9d6d1" stroke-width="3" stroke-linecap="round"><path d="M86 54c-12-15 12-18 0-34"/><path d="M110 48c-12-15 12-18 0-34"/><path d="M134 54c-12-15 12-18 0-34"/></g>
        <path class="loader-rice" d="M48 107c0-33 26-49 62-49s62 16 62 49Z" fill="#fffdf3"/>
        <g stroke="#d4c8a5" stroke-width="3" stroke-linecap="round"><path class="rice-grain" style="--grain:0" d="m70 89 8-4"/><path class="rice-grain" style="--grain:1" d="m92 77 8 3"/><path class="rice-grain" style="--grain:2" d="m119 77 7-4"/><path class="rice-grain" style="--grain:3" d="m143 91 7 3"/><path class="rice-grain" style="--grain:4" d="m104 96 7-3"/></g>
        <g class="loader-garnish" stroke="#537653" stroke-width="5" stroke-linecap="round"><path d="m103 66 8 3"/><path d="m128 85 7-3"/></g>
        <g class="loader-dish"><path d="M39 103h142c-4 36-27 60-71 60s-67-24-71-60Z" fill="#c94934"/><path d="M48 121c9 25 29 36 62 36s53-11 62-36c-12 17-32 24-62 24s-50-7-62-24Z" fill="#ac3224"/><path d="M37 103h146" stroke="#f6d995" stroke-width="7" stroke-linecap="round"/><path d="M86 164h48" stroke="#c94934" stroke-width="6" stroke-linecap="round"/><path d="M57 116c3 9 7 14 12 18" stroke="#e47860" stroke-width="5" stroke-linecap="round"/></g>
      </svg><p class="loader-name">rice bowl</p><p class="loader-caption" role="status">{'Opening the menu' if menu else 'Pull up a chair.'}</p></div>
      <button class="loader-skip" type="button">Skip intro</button>
    </div>'''


INTRO_BOOT = r'''(() => {
  const loader = document.getElementById('page-loader');
  const content = document.getElementById('site-content');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let done = false;
  function finish() {
    if(done) return;
    done = true;
    content.inert = false;
    document.documentElement.classList.remove('intro-pending');
    document.documentElement.classList.add('page-ready');
    loader.classList.add('loader-leaving');
    loader.setAttribute('aria-hidden', 'true');
    loader.querySelector('button').disabled = true;
    if(loader.contains(document.activeElement)) content.querySelector('a')?.focus();
    setTimeout(() => {loader.hidden = true;}, reduced.matches ? 0 : 260);
  }
  window.riceBowlIntro = {started: performance.now(), finish};
  if(reduced.matches) {finish();return;}
  content.inert = true;
  loader.hidden = false;
  document.documentElement.classList.add('intro-pending');
  loader.querySelector('button').addEventListener('click', finish);
  document.addEventListener('keydown', event => {if(event.key === 'Escape') finish();});
  reduced.addEventListener('change', event => {if(event.matches) finish();});
  // Independent failsafe: a failed image, font or main script cannot trap the visitor.
  setTimeout(finish, 2200);
  window.addEventListener('pageshow', event => {if(event.persisted) finish();});
})();'''


def page(title, description, body, menu=False, extra_scripts='', nav=None):
    data = json.dumps(DATA, ensure_ascii=False).replace('<', '\\u003c')
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f8f9f5">
<title>{title}</title><meta name="description" content="{description}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath fill='%23b93828' d='M3 15h34c-1 13-8 21-17 21S4 28 3 15Z'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preconnect" href="https://images.pexels.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&amp;family=DM+Sans:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
<style>{CSS}{STORE_CSS}</style></head><body id="top"{' class="menu-page"' if menu else ''}>
{intro(menu)}<div id="site-content"><script>{INTRO_BOOT}</script>
{header(nav or ('menu' if menu else 'home'))}<noscript><p class="noscript">You can browse the full menu below. Enable JavaScript to search dishes and save a bag.</p></noscript>
{body}{footer()}{bag()}</div>
<script type="application/json" id="menu-data">{data}</script><script>{JS}</script>
<script src="store-config.js"></script><script src="store.js"></script>{extra_scripts}</body></html>
'''


firecracker = ITEMS['firecracker-chicken']
rajma = ITEMS['rajma-comfort']
home_body = f'''<main id="main">
  <section class="hero shell" aria-labelledby="hero-title">
    <div class="hero-copy"><h1 id="hero-title">Lunch starts<br>with rice.</h1><p>Chicken with a chilli kick. Paneer with peppers. Or a bowl of rajma when that’s all you want.</p><div class="actions"><a class="btn" href="menu-standalone.html">Find your bowl</a><a class="text-link" href="menu-standalone.html?category=veg">Something vegetarian</a></div><p class="hero-note">Bowls, sides and something cold to drink.</p></div>
    <div class="hero-image">{photo(firecracker, True)}<div class="image-credit"><div>Firecracker Chicken<small>Garlic rice · Sesame slaw · Chilli sauce</small></div><strong>₹279</strong></div></div>
  </section>
  <section class="finder" aria-labelledby="finder-title"><div class="shell finder-inner"><div><h2 id="finder-title">What are you in the mood for?</h2><div class="choices" role="group" aria-label="Find a bowl"><button class="choice" type="button" data-mood="comfort" aria-pressed="true">Something familiar</button><button class="choice" type="button" data-mood="spicy" aria-pressed="false">A little heat</button><button class="choice" type="button" data-mood="vegetarian" aria-pressed="false">More greens</button></div></div>
    <div class="finder-result" aria-live="polite">{photo(rajma)}<div><h3>Rajma Comfort</h3><p>{rajma['description']}</p></div><a href="menu-standalone.html?q=Rajma+Comfort">View bowl · ₹219</a></div>
  </div></section>
  <section class="section shell" id="menu" aria-labelledby="bowls-title"><div class="section-heading"><div><h2 id="bowls-title">A few to start with.</h2><p>Pick your main. Leave room for the fries.</p></div><a class="text-link" href="menu-standalone.html">See all 15 dishes</a></div><div class="product-grid">{''.join(product(ITEMS[item]) for item in ['firecracker-chicken','paneer-pepper','garden-miso'])}</div></section>
  <section class="kitchen" id="story" aria-labelledby="kitchen-title"><div class="kitchen-image">{photo(ITEMS['teriyaki-crunch'])}</div><div class="kitchen-copy"><h2 id="kitchen-title">It’s what goes<br>with the rice.</h2><p>Sticky teriyaki and crispy garlic. Paneer, peppers and smoky chilli. Every bowl brings together a main, vegetables and a sauce that ties it all together.</p><div class="kitchen-list"><div><h3>For the crunch</h3><p>Slaw, cucumber, pickled onion and crisp toppings.</p></div><div><h3>For the sauce</h3><p>Sweet teriyaki, savoury miso or hot-sweet firecracker.</p></div></div></div></section>
  <section class="section shell" id="sauces" aria-labelledby="sauce-title"><div class="section-heading"><div><h2 id="sauce-title">Get to know the sauces.</h2><p>A good place to start if you haven’t picked a bowl.</p></div></div><div class="sauce-grid">
    <article class="sauce"><h3>Teriyaki</h3><p>A sticky, sweet-savoury glaze with sesame greens and crispy garlic.</p><a class="text-link" href="menu-standalone.html?q=Teriyaki+Crunch">Try Teriyaki Crunch</a></article>
    <article class="sauce"><h3>Firecracker</h3><p>Hot-sweet chilli sauce with chicken, garlic rice and a cooling sesame slaw.</p><a class="text-link" href="menu-standalone.html?q=Firecracker+Chicken">Try Firecracker Chicken</a></article>
    <article class="sauce"><h3>Miso</h3><p>A savoury dressing for vegetables, edamame, cabbage and toasted sesame.</p><a class="text-link" href="menu-standalone.html?q=Garden+Miso">Try Garden Miso</a></article>
  </div></section>
  <section class="shell share-section" aria-labelledby="share-title"><div class="share-copy"><h2 id="share-title">Lunch for two.<br>Fries in the middle.</h2><p>Two bowls, a side and two coolers. Choose the chicken duo for ₹699 or the vegetarian duo for ₹649.</p><a class="btn" href="menu-standalone.html?category=two">See meals for two</a></div>{photo(ITEMS['the-duo-box'])}</section>
  <section class="section shell faq-layout" id="faq" aria-labelledby="faq-title"><div class="faq-intro"><h2 id="faq-title">Good to know.</h2><p>A few answers before you choose.</p><div class="visit-note" id="visit"><h3>Planning your meal?</h3><p>Browse the menu and keep your picks together in a bag. You can copy the list or save it for later.</p><a class="text-link" href="menu-standalone.html">Browse the menu</a></div></div>
    <div class="faq-list"><details><summary>What are the vegetarian options?</summary><p>Garden Miso, Paneer Pepper and Rajma Comfort are in the vegetarian bowls section. The Green Duo includes two vegetarian bowls, sesame fries and two coolers.</p></details>
    <details><summary>Which bowls have a chilli kick?</summary><p>Firecracker Chicken, Korean Chilli, Pepper Wok and Paneer Pepper include chilli. Use the “With chilli” filter to find them.</p></details>
    <details><summary>Where can I check ingredients and allergens?</summary><p>Each dish has an ingredient description. These are not complete allergen lists. Before ordering, check with the restaurant about allergies and preparation. The menu includes ingredients such as sesame, soy, dairy and egg.</p></details>
    <details><summary>Can I order from this website?</summary><p>Yes. Build your bag, then open <a href="order-standalone.html">Order online</a> to send it to our kitchen for pickup or delivery. Pay online or at the counter, and follow the live wait time once the kitchen confirms.</p></details>
    <details><summary>Will my bag still be here when I come back?</summary><p>Your selection is saved in this browser when browser storage is available. You can change quantities or remove dishes at any time. Clearing your browser data also clears the bag.</p></details></div>
  </section>
</main>'''

category_links = ''.join(f'<a href="menu-standalone.html{ "?category=" + key if key != "all" else ""}" data-category-link="{key}" aria-current="{str(key == "all").lower()}">{label}</a>' for key, label in CATEGORIES.items())
options = ''.join(f'<option value="{key}">{label}</option>' for key, label in CATEGORIES.items())
groups = ''.join(f'<section class="menu-group" id="{key}" aria-labelledby="heading-{key}"><div class="menu-group-heading"><h2 id="heading-{key}">{label}</h2><span>{len([item for item in DATA if item["category"] == key])} dishes</span></div><div class="product-grid menu-products">{"".join(product(item) for item in DATA if item["category"] == key)}</div></section>' for key, label in CATEGORIES.items() if key != 'all')
menu_body = f'''<main id="main" class="shell">
  <section class="menu-intro" aria-labelledby="menu-title"><div><h1 id="menu-title">Let’s eat.</h1><p>Find a bowl, add a side, pick a drink.<br>Your bag keeps everything in one place.</p></div><label class="search-box" for="menu-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg><span class="sr-only">Search the menu</span><input id="menu-search" type="search" placeholder="Search dishes or ingredients" maxlength="120" autocomplete="off" aria-controls="menu-results"><button class="clear-search" type="button" aria-label="Clear search" hidden>×</button></label></section>
  <div class="mobile-category"><label for="category-select">On the menu</label><select id="category-select" aria-controls="menu-results">{options}</select></div>
  <div class="menu-layout"><aside class="menu-sidebar"><h2>On the menu</h2><nav class="category-links" aria-label="Menu categories">{category_links}</nav><p class="sidebar-note">Something to share?<br>The duo meals include two bowls, a side and drinks.</p></aside>
    <div><div class="menu-toolbar"><div class="filter-group" role="group" aria-label="Diet and flavour filters"><button class="filter" type="button" data-filter="all" aria-pressed="true">All dishes</button><button class="filter" type="button" data-filter="vegetarian" aria-pressed="false">Vegetarian</button><button class="filter" type="button" data-filter="spicy" aria-pressed="false">With chilli</button></div><span class="result-count" role="status" aria-live="polite">15 dishes</span></div>
    <div id="menu-results">{groups}<div class="empty-results" hidden><h2>No dishes found.</h2><p>Try another ingredient or clear your filters to see the full menu.</p><button class="btn secondary" type="button" data-reset>Show all dishes</button></div></div>
    <p class="allergy-note">Food allergy? Dish descriptions are a starting point, not a full allergen list. Check ingredients and preparation with the restaurant before ordering.</p></div>
  </div></main>'''

(ROOT / 'index-standalone.html').write_text(page('Rice Bowl | Bowls, sides & something cold', 'Chicken, paneer, vegetables and rajma rice bowls. Explore the Rice Bowl menu, find your favourites and save your selection.', home_body), encoding='utf-8')
(ROOT / 'menu-standalone.html').write_text(page('The menu | Rice Bowl', 'Browse rice bowls from ₹219, meals for two, sides, drinks and dessert. Search ingredients and save your favourites in a bag.', menu_body, True), encoding='utf-8')


order_body = '''<main id="main" class="shell" data-order-page>
  <section class="order-head">
    <h1>Order online.</h1>
    <p>Straight to our kitchen. Pick it up at the counter or have it delivered, and follow it live once it is in.</p>
    <div class="order-status" data-order-status></div>
  </section>
  <nav class="order-nav" aria-label="Menu sections" data-order-nav></nav>
  <div class="order-shell">
    <div data-order-menu><p class="muted">Loading today\u2019s menu\u2026</p></div>
    <aside class="order-side">
      <div class="order-card">
        <h2>Your order <span class="bag-count" data-basket-count>0</span></h2>
        <div data-order-basket></div>
      </div>
      <form class="order-card" data-order-form>
        <h2>Where should it go?</h2>
        <div class="choice-row" data-fulfilment></div>
        <div class="field" data-address-field hidden>
          <label for="deliveryAddress">Delivery address</label>
          <textarea id="deliveryAddress" name="deliveryAddress" rows="3" placeholder="Flat, street, landmark, pin code"></textarea>
        </div>
        <div class="field"><label for="name">Your name</label><input id="name" name="name" required autocomplete="name"></div>
        <div class="field-row">
          <div class="field"><label for="phone">Mobile</label><input id="phone" name="phone" required inputmode="tel" autocomplete="tel" placeholder="10-digit number"></div>
          <div class="field"><label for="email">Email (optional)</label><input id="email" name="email" type="email" autocomplete="email"></div>
        </div>
        <div class="field"><label for="couponCode">Coupon (optional)</label><input id="couponCode" name="couponCode" placeholder="e.g. BOWL10"></div>
        <h2>How would you like to pay?</h2>
        <div class="choice-row">
          <label class="choice-pill"><input type="radio" name="paymentMode" value="COUNTER" checked> Pay at the counter</label>
          <label class="choice-pill"><input type="radio" name="paymentMode" value="ONLINE"> Pay now (UPI/card)</label>
        </div>
        <button class="btn order-submit" type="submit" data-submit disabled>Place order</button>
        <p class="tax-note">We confirm every order from the kitchen before cooking. You will see a live wait time next.</p>
      </form>
    </aside>
  </div>
  <dialog class="addon-dialog" data-addon-dialog>
    <div class="addon-inner">
      <h2 data-addon-title>Extras</h2>
      <div data-addon-list></div>
      <div class="addon-actions">
        <button class="btn secondary" type="button" onclick="this.closest('dialog').close()">Cancel</button>
        <button class="btn" type="button" data-addon-confirm>Add</button>
      </div>
    </div>
  </dialog>
</main>'''

track_body = '''<main id="main" class="shell track-wrap" data-track-page>
  <p class="muted">Loading your order\u2026</p>
</main>'''

(ROOT / 'order-standalone.html').write_text(page(
    'Order online | Rice Bowl',
    'Order Rice Bowl online for pickup or delivery. Live menu, live prices and a live wait time once the kitchen confirms.',
    order_body,
    nav='order',
    extra_scripts='<script src="https://checkout.razorpay.com/v1/checkout.js" defer></script>',
), encoding='utf-8')
(ROOT / 'track-standalone.html').write_text(page(
    'Your order | Rice Bowl',
    'Follow your Rice Bowl order: confirmation, cooking and ready for pickup.',
    track_body,
    nav='order',
), encoding='utf-8')

for filename, target in [('index.html', 'index-standalone.html'), ('menu.html', 'menu-standalone.html'), ('order.html', 'order-standalone.html'), ('track.html', 'track-standalone.html')]:
    # JS preserves query and fragment for old bookmarks; the link also works without JS.
    (ROOT / filename).write_text(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rice Bowl</title><meta name="robots" content="noindex"><script>location.replace('{target}' + location.search + location.hash);</script></head><body><p><a href="{target}">Continue to Rice Bowl</a></p></body></html>''', encoding='utf-8')
print('Built index, menu, order and track pages plus their legacy entry points.')
