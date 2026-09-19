(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const activeMotion = new WeakMap();
  function animateIn(element, delay = 0, frames = [{opacity:0, transform:'translateY(10px)'}, {opacity:1, transform:'none'}], duration = 360) {
    if(reducedMotion.matches || !element?.animate) return;
    activeMotion.get(element)?.cancel();
    const animation = element.animate(frames, {duration, delay, easing:'cubic-bezier(.22,1,.36,1)', fill:'backwards'});
    activeMotion.set(element, animation);
  }
  reducedMotion.addEventListener('change', event => {if(event.matches) document.getAnimations().forEach(animation => animation.cancel());});
  const intro = window.riceBowlIntro;
  if(intro) {
    const heroImage = document.querySelector('.hero-image img');
    const imageReady = !heroImage || heroImage.complete ? Promise.resolve() : new Promise(resolve => {
      heroImage.addEventListener('load', resolve, {once:true});
      heroImage.addEventListener('error', resolve, {once:true});
    });
    const minTime = new Promise(resolve => setTimeout(resolve, Math.max(0, 1200 - (performance.now() - intro.started))));
    Promise.all([imageReady, document.fonts?.ready || Promise.resolve(), minTime]).then(intro.finish);
  }
  // Reveal a few editorial sections once, without hiding content before JS runs.
  if('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if(!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      animateIn(entry.target, 0, undefined, 600);
    }), {threshold:.12});
    document.querySelectorAll('.kitchen-copy,.sauce-grid,.share-copy,.faq-intro').forEach(element => observer.observe(element));
  }
  const catalog = JSON.parse(document.getElementById('menu-data').textContent);
  const products = new Map(catalog.map(item => [item.id, item]));
  const money = value => new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}).format(value);
  const key = 'rice-bowl-bag-v1';
  const bag = new Map();
  let storageAvailable = true;
  function loadBag() {
    bag.clear();
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
      Object.entries(stored).forEach(([id, qty]) => {
        if (products.has(id) && Number.isInteger(qty) && qty > 0 && qty <= 99) bag.set(id, qty);
      });
    } catch { storageAvailable = false; }
  }
  loadBag();
  const toast = document.querySelector('.toast');
  let toastTimer;
  function announce(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => {toast.hidden = true;}, 3200);
  }
  const navToggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  function closeNav(returnFocus = false) {
    mobileNav.hidden = true;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.textContent = 'Menu';
    if (returnFocus) navToggle.focus();
  }
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    mobileNav.hidden = !open;
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.textContent = open ? 'Close' : 'Menu';
  });
  mobileNav.addEventListener('click', event => {if(event.target.closest('a')) closeNav();});
  document.addEventListener('click', event => {if (!event.target.closest('.site-header')) closeNav();});
  document.addEventListener('keydown', event => {if(event.key === 'Escape' && !mobileNav.hidden) closeNav(true);});
  matchMedia('(min-width:901px)').addEventListener('change', event => {if(event.matches) closeNav();});

  // Keep desktop and mobile navigation aligned with the section being viewed.
  const primaryLinks = [...document.querySelectorAll('[data-nav]')];
  function markNavigation(id) {
    primaryLinks.forEach(link => {
      if(link.dataset.nav === id) link.setAttribute('aria-current', ['home', 'menu'].includes(id) ? 'page' : 'location');
      else link.removeAttribute('aria-current');
    });
  }
  if(document.body.classList.contains('menu-page')) {
    markNavigation('menu');
  } else {
    const sections = ['story', 'faq'].map(id => document.getElementById(id));
    let destination = null, destinationTimer, frame;
    function updateNavigation() {
      frame = null;
      const readingLine = document.querySelector('.site-header').getBoundingClientRect().bottom + 48;
      const atBottom = scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 3;
      if(destination) {
        const target = document.getElementById(destination);
        const targetTop = target?.getBoundingClientRect().top;
        const reached = destination === 'top' ? scrollY < 3 : targetTop >= 0 && targetTop <= readingLine;
        if(!reached && !(atBottom && destination === 'faq')) return;
        destination = null;
      }
      let active = 'home';
      sections.forEach(section => {if(section && section.getBoundingClientRect().top <= readingLine) active = section.id;});
      if(atBottom) active = 'faq';
      markNavigation(active);
    }
    function scheduleNavigation() {
      if(!frame) frame = requestAnimationFrame(updateNavigation);
    }
    function followFragment(id = location.hash.slice(1)) {
      destination = ['story', 'faq', 'top'].includes(id) ? id : null;
      clearTimeout(destinationTimer);
      if(destination) {
        markNavigation(destination === 'top' ? 'home' : destination);
        // Hold the clicked label while native smooth scrolling passes other sections.
        destinationTimer = setTimeout(() => {destination = null;scheduleNavigation();}, 1600);
      } else scheduleNavigation();
    }
    function resumeScrollTracking() {destination = null;clearTimeout(destinationTimer);scheduleNavigation();}
    window.addEventListener('scroll', scheduleNavigation, {passive:true});
    window.addEventListener('resize', scheduleNavigation, {passive:true});
    window.addEventListener('hashchange', () => followFragment());
    window.addEventListener('pageshow', () => followFragment());
    primaryLinks.forEach(link => link.addEventListener('click', event => {
      if(event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if(link.getAttribute('href').startsWith('#')) followFragment(link.hash.slice(1));
    }));
    window.addEventListener('wheel', resumeScrollTracking, {passive:true});
    window.addEventListener('touchstart', resumeScrollTracking, {passive:true});
    window.addEventListener('keydown', event => {if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) resumeScrollTracking();});
    followFragment();
  }

  const dialog = document.querySelector('.bag-dialog');
  let bagOpener;
  let closeTimer;
  function openBag(event) {
    closeNav();
    clearTimeout(closeTimer);
    dialog.classList.remove('bag-closing');
    bagOpener = event.currentTarget;
    dialog.showModal();
    document.body.classList.add('modal-open');
    document.querySelector('[data-close-bag]').focus();
  }
  function closeBag() {
    if(!dialog.open || dialog.classList.contains('bag-closing')) return;
    if(reducedMotion.matches) {dialog.close();return;}
    dialog.classList.add('bag-closing');
    closeTimer = setTimeout(() => dialog.close(), 180);
  }
  dialog.addEventListener('cancel', event => {event.preventDefault();closeBag();});
  document.querySelectorAll('[data-open-bag]').forEach(button => button.addEventListener('click', openBag));
  document.querySelectorAll('[data-close-bag]').forEach(button => button.addEventListener('click', closeBag));
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeBag();
  });
  dialog.addEventListener('close', () => {
    clearTimeout(closeTimer);
    dialog.classList.remove('bag-closing');
    document.body.classList.remove('modal-open');
    (bagOpener && !bagOpener.hidden ? bagOpener : document.querySelector('.bag-button')).focus();
  });
  dialog.addEventListener('keydown', event => {
    if(event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], textarea, input, select, [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if(event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
  });
  function saveBag() {
    try {localStorage.setItem(key, JSON.stringify(Object.fromEntries(bag)));}
    catch {storageAvailable = false;}
  }
  function renderBag(focusId, action) {
    const rows = document.querySelector('.bag-items');
    rows.replaceChildren();
    let count = 0, total = 0;
    bag.forEach((qty, id) => {
      const item = products.get(id);
      count += qty;
      total += qty * item.price;
      const row = document.createElement('div');
      row.className = 'bag-line';
      const description = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = item.name;
      const price = document.createElement('p');
      price.textContent = `${money(item.price)} each · ${money(item.price * qty)}`;
      description.append(title, price);
      const controls = document.createElement('div');
      controls.className = 'quantity';
      const output = document.createElement('output');
      output.textContent = qty;
      output.setAttribute('aria-label', `${item.name} quantity`);
      ['decrease', 'increase'].forEach(direction => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = direction === 'decrease' ? '−' : '+';
        button.dataset.quantity = direction;
        button.dataset.id = id;
        button.setAttribute('aria-label', `${direction === 'decrease' ? 'Remove one' : 'Add one'} ${item.name}`);
        if(direction === 'increase') button.disabled = qty >= 99;
        controls.append(button);
        if(direction === 'decrease') controls.append(output);
      });
      row.append(description, controls);
      rows.append(row);
    });
    document.querySelectorAll('.bag-count').forEach(el => {el.textContent = count;});
    document.querySelectorAll('[data-open-bag]').forEach(el => el.setAttribute('aria-label', `View bag, ${count} ${count === 1 ? 'item' : 'items'}`));
    document.querySelector('.bag-total').textContent = money(total);
    document.querySelector('.floating-total').textContent = `${count} ${count === 1 ? 'item' : 'items'} · ${money(total)}`;
    document.querySelector('.floating-bag').hidden = count === 0;
    document.body.classList.toggle('has-bag', count > 0);
    document.querySelector('.bag-empty').hidden = count > 0;
    document.querySelector('.bag-footer').hidden = count === 0;
    document.querySelector('.saved-summary').hidden = true;
    document.querySelector('.bag-notice').textContent = `Online ordering is not available yet. This bag is a ${storageAvailable ? 'saved' : 'temporary'} list, not a placed order.`;
    document.querySelectorAll('[data-add]').forEach(button => {
      const item = products.get(button.dataset.add);
      const qty = bag.get(item.id) || 0;
      button.setAttribute('aria-label', `Add ${item.name} to bag${qty ? `, ${qty} already in bag` : ''}`);
      button.innerHTML = qty ? `Add (${qty}) <span aria-hidden="true">+</span>` : 'Add <span aria-hidden="true">+</span>';
      button.disabled = qty >= 99;
    });
    if (focusId) {
      const control = [...rows.querySelectorAll('[data-quantity]')].find(el => el.dataset.id === focusId && el.dataset.quantity === action && !el.disabled);
      (control || rows.querySelector('[data-quantity]') || document.querySelector('[data-close-bag]')).focus();
    }
  }
  document.addEventListener('click', event => {
    const add = event.target.closest('[data-add]');
    const quantity = event.target.closest('[data-quantity]');
    if (!add && !quantity) return;
    const id = add ? add.dataset.add : quantity.dataset.id;
    if (!products.has(id)) return;
    const current = bag.get(id) || 0;
    const next = Math.min(99, Math.max(0, current + (quantity?.dataset.quantity === 'decrease' ? -1 : 1)));
    if(next) bag.set(id, next); else bag.delete(id);
    saveBag();
    renderBag(quantity ? id : null, quantity?.dataset.quantity);
    const message = add ? `${products.get(id).name} added to bag` : `${products.get(id).name}: ${next} in bag`;
    document.querySelector('.bag-status').textContent = message;
    if(add) announce(message);
    if(add) document.querySelectorAll('.bag-count').forEach(element => animateIn(element, 0, [{transform:'scale(1)'},{transform:'scale(1.22)',offset:.4},{transform:'scale(1)'}], 300));
  });
  function summaryText() {
    let total = 0;
    const lines = ['Rice Bowl — saved selection', ''];
    bag.forEach((qty, id) => {
      const item = products.get(id);
      total += qty * item.price;
      lines.push(`${qty} × ${item.name} — ${money(qty * item.price)}`);
    });
    lines.push('', `Subtotal: ${money(total)}`, 'This is a saved selection. No order has been placed.');
    return lines.join('\n');
  }
  document.querySelector('[data-copy-bag]').addEventListener('click', async () => {
    const summary = summaryText();
    document.querySelector('.saved-summary').hidden = false;
    const field = document.querySelector('#bag-summary');
    field.value = summary;
    try {
      await navigator.clipboard.writeText(summary);
      document.querySelector('.bag-status').textContent = 'Selection copied. No order has been placed.';
      document.querySelector('#summary-label').textContent = 'Copied to clipboard';
    } catch {
      document.querySelector('#summary-label').textContent = 'Select and copy your list';
      field.focus();field.select();
    }
  });
  document.querySelector('[data-download-bag]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([summaryText()], {type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;link.download = 'rice-bowl-selection.txt';link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.querySelector('.bag-status').textContent = 'Selection downloaded. No order has been placed.';
  });
  window.addEventListener('storage', event => {if(event.key === key || event.key === null) {loadBag();renderBag();}});
  renderBag();

  const moods = {comfort:'rajma-comfort',spicy:'firecracker-chicken',vegetarian:'garden-miso'};
  document.querySelectorAll('[data-mood]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-mood]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    const item = products.get(moods[button.dataset.mood]);
    const result = document.querySelector('.finder-result');
    const img = result.querySelector('img');
    img.hidden = false;
    result.querySelector('.image-fallback')?.remove();
    img.src = item.image;img.alt = item.name;
    result.querySelector('h3').textContent = item.name;
    result.querySelector('p').textContent = item.description;
    result.querySelector('a').href = `menu-standalone.html?q=${encodeURIComponent(item.name)}`;
    result.querySelector('a').textContent = `View bowl · ${money(item.price)}`;
    animateIn(result, 0, [{opacity:.35,transform:'translateX(7px)'},{opacity:1,transform:'none'}]);
  }));

  const search = document.querySelector('#menu-search');
  if(search) {
    const categorySelect = document.querySelector('#category-select');
    const cards = [...document.querySelectorAll('[data-product]')];
    const categoryLinks = [...document.querySelectorAll('[data-category-link]')];
    const filters = [...document.querySelectorAll('[data-filter]')];
    const categories = new Set(['all', ...catalog.map(item => item.category)]);
    let category = 'all', filter = 'all';
    function readURL() {
      const params = new URLSearchParams(location.search);
      category = categories.has(params.get('category')) ? params.get('category') : 'all';
      filter = ['vegetarian','spicy'].includes(params.get('filter')) ? params.get('filter') : 'all';
      search.value = (params.get('q') || '').slice(0, 120);
      const aliases = {today:'bowls',two:'two',bowls:'bowls',veg:'veg',sides:'sides',drinks:'drinks',dessert:'dessert'};
      if(!params.has('category') && aliases[location.hash.slice(1)]) category = aliases[location.hash.slice(1)];
    }
    function applyFilters(animate = false) {
      const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let count = 0;
      cards.forEach(card => {
        const item = products.get(card.dataset.product);
        const text = `${item.name} ${item.description}`.toLowerCase();
        const visible = (category === 'all' || item.category === category) && (filter === 'all' || item[filter]) && words.every(word => text.includes(word));
        card.hidden = !visible;
        if(visible) count++;
      });
      document.querySelectorAll('.menu-group').forEach(section => {
        const visible = [...section.querySelectorAll('[data-product]')].filter(card => !card.hidden).length;
        section.hidden = visible === 0;
        section.querySelector('.menu-group-heading span').textContent = `${visible} ${visible === 1 ? 'dish' : 'dishes'}`;
      });
      categoryLinks.forEach(link => link.setAttribute('aria-current', String(link.dataset.categoryLink === category)));
      categorySelect.value = category;
      filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
      document.querySelector('.result-count').textContent = `${count} ${count === 1 ? 'dish' : 'dishes'}`;
      document.querySelector('.empty-results').hidden = count !== 0;
      document.querySelector('.clear-search').hidden = !search.value;
      if(animate) cards.filter(card => !card.hidden).slice(0, 6).forEach((card, index) => animateIn(card, index * 30));
    }
    function updateURL(push = false) {
      const url = new URL(location.href);
      url.search = '';url.hash = '';
      if(category !== 'all') url.searchParams.set('category', category);
      if(filter !== 'all') url.searchParams.set('filter', filter);
      if(search.value.trim()) url.searchParams.set('q', search.value.trim());
      try {history[push ? 'pushState' : 'replaceState']({}, '', url);} catch { /* File previews can restrict history updates. */ }
      applyFilters(push);
    }
    search.addEventListener('input', () => updateURL());
    document.querySelector('.clear-search').addEventListener('click', () => {search.value = '';updateURL();search.focus();});
    categoryLinks.forEach(link => link.addEventListener('click', event => {
      if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();category = link.dataset.categoryLink;updateURL(true);
    }));
    categorySelect.addEventListener('change', () => {category = categorySelect.value;updateURL(true);});
    filters.forEach(button => button.addEventListener('click', () => {filter = button.dataset.filter;updateURL(true);}));
    document.querySelector('[data-reset]').addEventListener('click', () => {category = filter = 'all';search.value = '';updateURL(true);search.focus();});
    window.addEventListener('popstate', () => {readURL();applyFilters();});
    readURL();applyFilters();
  }
  document.querySelectorAll('img').forEach(img => {
    function fallback() {
      if(img.hidden) return;
      img.hidden = true;
      const label = document.createElement('div');
      label.className = 'image-fallback';label.textContent = img.alt;
      img.after(label);
    }
    img.addEventListener('error', fallback);
    if(img.complete && !img.naturalWidth) fallback();
  });
})();
