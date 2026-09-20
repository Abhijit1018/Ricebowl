/**
 * Rice Bowl live ordering.
 *
 * The POS (CafePOS) owns the menu, prices, stock and orders; this file is the website's client.
 *  - every page: refreshes the printed prices and marks sold-out dishes from the live menu
 *  - order page: live menu, basket with add-ons, checkout (pay online or at the counter)
 *  - track page: live status and ETA over Socket.io, with polling as a fallback
 * If the API is unreachable, the static menu still renders, and ordering says so plainly.
 */
(() => {
  const CONFIG = window.RICE_BOWL_CONFIG || {};
  const API = (CONFIG.apiBase || '').replace(/\/$/, '');
  const OUTLET = CONFIG.outlet || 'rice-bowl';
  const CUR = CONFIG.currency || '₹';
  const BASKET_KEY = 'rice-bowl-basket-v1';
  // The browsing pages keep a simple {dish-slug: qty} bag; the order page carries it over once.
  const LEGACY_BAG_KEY = 'rice-bowl-bag-v1';
  const LAST_ORDER_KEY = 'rice-bowl-last-order';

  const money = (n) => `${CUR}${Number(n || 0).toFixed(2)}`;
  const el = (sel, root = document) => root.querySelector(sel);
  const els = (sel, root = document) => [...root.querySelectorAll(sel)];
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(path, options) {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
  }

  let menuPromise = null;
  const loadMenu = () => (menuPromise = menuPromise || api(`/public/${OUTLET}/menu`));

  // ── basket ────────────────────────────────────────────────────────────────
  const readBasket = () => {
    try { return JSON.parse(localStorage.getItem(BASKET_KEY)) || []; } catch { return []; }
  };
  const writeBasket = (lines) => {
    try { localStorage.setItem(BASKET_KEY, JSON.stringify(lines)); } catch { /* private mode */ }
    document.dispatchEvent(new CustomEvent('basket:changed'));
  };
  const lineKey = (productId, addonIds) => `${productId}|${[...(addonIds || [])].sort().join(',')}`;

  function addToBasket(product, addonIds = [], qty = 1) {
    const lines = readBasket();
    const key = lineKey(product.id, addonIds);
    const addons = (product.addons || []).filter((a) => addonIds.includes(a.id));
    const existing = lines.find((l) => l.key === key);
    if (existing) existing.qty += qty;
    else lines.push({
      key,
      productId: product.id,
      name: product.name,
      unitPrice: product.price + addons.reduce((s, a) => s + a.price, 0),
      addonIds,
      addonNames: addons.map((a) => a.name),
      image: product.image,
      qty,
    });
    writeBasket(lines);
  }

  function setQty(key, qty) {
    const lines = readBasket().map((l) => (l.key === key ? { ...l, qty } : l)).filter((l) => l.qty > 0);
    writeBasket(lines);
  }

  /**
   * Move whatever is in the browsing bag into the live basket, once, so nobody has to pick
   * their dishes a second time. Bag ids are slugs of the dish name, which is how they match
   * the live menu.
   */
  function carryBrowsingBag(products) {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(LEGACY_BAG_KEY) || 'null'); } catch { return null; }
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null;
    const entries = Object.entries(stored).filter(([, qty]) => Number.isInteger(qty) && qty > 0);
    try { localStorage.removeItem(LEGACY_BAG_KEY); } catch { /* private mode */ }
    if (entries.length === 0) return null;

    const byName = new Map(products.map((p) => [norm(p.name), p]));
    let carried = 0;
    const missed = [];
    entries.forEach(([id, qty]) => {
      const product = byName.get(norm(id));
      if (!product || product.soldOut) { missed.push(String(id).replace(/-/g, ' ')); return; }
      addToBasket(product, [], Math.min(qty, 99));
      carried += qty;
    });
    return { carried, missed };
  }

  const basketCount = () => readBasket().reduce((n, l) => n + l.qty, 0);
  const basketTotal = () => readBasket().reduce((n, l) => n + l.qty * l.unitPrice, 0);

  // ── live prices on the static marketing pages ─────────────────────────────
  async function refreshStaticMenu() {
    const cards = els('[data-product]');
    if (cards.length === 0) return;
    try {
      const menu = await loadMenu();
      const byName = new Map();
      menu.categories.forEach((c) => c.products.forEach((p) => byName.set(norm(p.name), p)));

      cards.forEach((card) => {
        const title = el('h3', card)?.textContent;
        const live = byName.get(norm(title));
        const priceEl = el('.price', card);
        const addBtn = el('[data-add]', card);
        if (!live) {
          // Dish is no longer on the POS menu: keep the card, but don't let anyone order it.
          if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Unavailable'; }
          return;
        }
        if (priceEl) priceEl.textContent = `${CUR}${live.price}`;
        if (addBtn) {
          addBtn.dataset.liveId = live.id;
          if (live.soldOut) {
            addBtn.disabled = true;
            addBtn.textContent = 'Sold out';
          } else if (live.stockLeft !== null && live.stockLeft <= 5) {
            addBtn.insertAdjacentHTML('beforebegin', `<span class="stock-note">${live.stockLeft} left</span>`);
          }
        }
      });

      if (!menu.outlet.acceptingOrders || !menu.outlet.onlineOrderingEnabled) {
        els('[data-order-cta]').forEach((cta) => {
          cta.classList.add('is-closed');
          cta.textContent = menu.outlet.open ? 'Ordering paused' : 'Closed right now';
        });
      }
    } catch {
      // Offline or API down: the printed menu stays as it is.
    }
  }

  // ── order page ────────────────────────────────────────────────────────────
  async function initOrderPage() {
    const root = el('[data-order-page]');
    // Guard against a second run (e.g. the script included twice), which would double-bind the
    // add buttons and add each dish twice.
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';

    const menuHost = el('[data-order-menu]', root);
    const basketHost = el('[data-order-basket]', root);
    const statusHost = el('[data-order-status]', root);
    const form = el('[data-order-form]', root);
    let menu = null;

    try {
      menu = await loadMenu();
    } catch (error) {
      menuHost.innerHTML = `<div class="order-error"><h2>We can't load the menu right now.</h2><p>Please refresh, or call us to order.</p></div>`;
      return;
    }

    const outlet = menu.outlet;
    const canOrder = outlet.onlineOrderingEnabled && outlet.acceptingOrders;
    statusHost.innerHTML = canOrder
      ? `<span class="badge open">Taking orders</span>${outlet.openTime ? `<span>Open ${outlet.openTime}–${outlet.closeTime}</span>` : ''}${outlet.busyExtraMinutes > 0 ? '<span>Kitchen is busy — waits are longer</span>' : ''}`
      : `<span class="badge closed">${outlet.open ? 'Ordering paused' : 'Closed right now'}</span>${outlet.openTime ? `<span>Open ${outlet.openTime}–${outlet.closeTime}</span>` : ''}`;

    // fulfilment options follow what the outlet allows
    const typeWrap = el('[data-fulfilment]', root);
    const types = [
      outlet.pickupEnabled ? { value: 'PICKUP', label: 'Pickup' } : null,
      outlet.deliveryEnabled ? { value: 'DELIVERY', label: `Delivery${outlet.deliveryFee ? ` · ${money(outlet.deliveryFee)}` : ''}` } : null,
    ].filter(Boolean);
    typeWrap.innerHTML = types
      .map((t, i) => `<label class="choice-pill"><input type="radio" name="pickupType" value="${t.value}"${i === 0 ? ' checked' : ''}> ${t.label}</label>`)
      .join('');

    const products = menu.categories.flatMap((c) => c.products);
    const findProduct = (id) => products.find((p) => p.id === id);

    // Whatever they picked while browsing is already their order — don't make them choose again.
    const carried = carryBrowsingBag(products);

    // The header's "Order online" button would link to this very page; make it say how the
    // kitchen is doing and jump to the basket instead.
    els('.order-cta').forEach((cta) => {
      cta.textContent = canOrder ? 'Your order' : outlet.open ? 'Ordering paused' : 'Closed right now';
      if (!canOrder) cta.classList.add('is-closed');
      cta.setAttribute('href', '#your-order');
    });

    // The header keeps its bag button, but here it belongs to the live basket: re-created to
    // drop the browsing page's handler, then pointed at the order card.
    els('.bag-button').forEach((button) => {
      const fresh = button.cloneNode(true);
      button.replaceWith(fresh);
      fresh.removeAttribute('aria-haspopup');
      fresh.addEventListener('click', () => {
        el('.order-side', root)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    menuHost.innerHTML = menu.categories.map((cat) => `
      <section class="order-group" id="cat-${cat.id}">
        <h2>${escapeHtml(cat.name)}</h2>
        <div class="order-items">
          ${cat.products.map((p) => `
            <article class="order-item${p.soldOut ? ' sold-out' : ''}">
              ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" width="180" height="140">` : ''}
              <div class="order-item-body">
                <h3>${escapeHtml(p.name)}</h3>
                <p>${escapeHtml(p.description || '')}</p>
                <div class="order-item-foot">
                  <strong>${money(p.price)}</strong>
                  ${p.soldOut
                    ? '<span class="sold-tag">Sold out</span>'
                    : `<button class="btn small" type="button" data-add-live="${p.id}">Add${p.addons.length ? ' · choose extras' : ''}</button>`}
                </div>
                ${!p.soldOut && p.stockLeft !== null && p.stockLeft <= 5 ? `<span class="stock-note">Only ${p.stockLeft} left</span>` : ''}
              </div>
            </article>`).join('')}
        </div>
      </section>`).join('');

    const catNav = el('[data-order-nav]', root);
    if (catNav) {
      catNav.innerHTML = menu.categories.map((c) => `<a href="#cat-${c.id}">${escapeHtml(c.name)}</a>`).join('');
    }

    menuHost.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-live]');
      if (!button) return;
      const product = findProduct(button.dataset.addLive);
      if (!product) return;
      if (product.addons.length) openAddonPicker(product);
      else { addToBasket(product); flash(`${product.name} added`); }
    });

    function openAddonPicker(product) {
      const dialog = el('[data-addon-dialog]', root);
      el('[data-addon-title]', dialog).textContent = product.name;
      el('[data-addon-list]', dialog).innerHTML = product.addons
        .map((a) => `<label class="addon-row"><input type="checkbox" value="${a.id}"> <span>${escapeHtml(a.name)}</span> <strong>+${money(a.price)}</strong></label>`)
        .join('');
      const confirm = el('[data-addon-confirm]', dialog);
      const update = () => {
        const chosen = els('input:checked', dialog).map((i) => i.value);
        const extra = product.addons.filter((a) => chosen.includes(a.id)).reduce((s, a) => s + a.price, 0);
        confirm.textContent = `Add · ${money(product.price + extra)}`;
      };
      els('input', dialog).forEach((i) => i.addEventListener('change', update));
      update();
      confirm.onclick = () => {
        addToBasket(product, els('input:checked', dialog).map((i) => i.value));
        dialog.close();
        flash(`${product.name} added`);
      };
      dialog.showModal();
    }

    function renderBasket() {
      const lines = readBasket();
      const isDelivery = el('input[name="pickupType"]:checked', root)?.value === 'DELIVERY';
      const food = basketTotal();
      const packaging = isDelivery || !outlet.packagingCharge ? outlet.packagingCharge : outlet.packagingCharge;
      const delivery = isDelivery ? outlet.deliveryFee : 0;
      const minimum = isDelivery ? Math.max(outlet.minOrderValue, outlet.deliveryMinOrderValue) : outlet.minOrderValue;

      basketHost.innerHTML = lines.length === 0
        ? `<p class="basket-empty">Your basket is empty. Add a bowl to get started.</p>`
        : `<ul class="basket-lines">${lines.map((l) => `
            <li>
              <div>
                <strong>${escapeHtml(l.name)}</strong>
                ${l.addonNames.length ? `<span class="addon-note">+ ${escapeHtml(l.addonNames.join(', '))}</span>` : ''}
                <span class="line-price">${money(l.unitPrice)} each</span>
              </div>
              <div class="qty">
                <button type="button" data-qty="${l.key}" data-step="-1" aria-label="Remove one ${escapeHtml(l.name)}">−</button>
                <span>${l.qty}</span>
                <button type="button" data-qty="${l.key}" data-step="1" aria-label="Add one ${escapeHtml(l.name)}">+</button>
              </div>
              <strong>${money(l.qty * l.unitPrice)}</strong>
            </li>`).join('')}</ul>
          <dl class="basket-totals">
            <div><dt>Food</dt><dd>${money(food)}</dd></div>
            ${packaging ? `<div><dt>Packaging</dt><dd>${money(packaging)}</dd></div>` : ''}
            ${delivery ? `<div><dt>Delivery</dt><dd>${money(delivery)}</dd></div>` : ''}
            <div class="grand"><dt>Estimated total</dt><dd>${money(food + packaging + delivery)}</dd></div>
          </dl>
          <p class="tax-note">Taxes are added on the final bill.</p>
          ${minimum && food < minimum ? `<p class="min-note">Minimum order ${money(minimum)} — add ${money(minimum - food)} more.</p>` : ''}`;

      els('.bag-count, [data-basket-count]').forEach((n) => (n.textContent = String(basketCount())));
      const submit = el('[data-submit]', root);
      if (submit) submit.disabled = !canOrder || lines.length === 0 || (minimum && food < minimum);
    }

    basketHost.addEventListener('click', (event) => {
      const button = event.target.closest('[data-qty]');
      if (!button) return;
      const line = readBasket().find((l) => l.key === button.dataset.qty);
      if (line) setQty(line.key, line.qty + Number(button.dataset.step));
    });

    document.addEventListener('basket:changed', renderBasket);
    root.addEventListener('change', (event) => {
      if (event.target.name === 'pickupType') {
        el('[data-address-field]', root).hidden = event.target.value !== 'DELIVERY';
        renderBasket();
      }
    });
    renderBasket();

    if (carried && (carried.carried || carried.missed.length)) {
      const said = [];
      if (carried.carried) said.push(`${carried.carried} ${carried.carried === 1 ? 'item' : 'items'} moved over from your bag`);
      if (carried.missed.length) said.push(`${carried.missed.join(', ')} is not available today`);
      basketHost.insertAdjacentHTML('beforebegin', `<p class="carry-note">${escapeHtml(said.join(' · '))}.</p>`);
      flash(said[0] + '.');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = el('[data-submit]', root);
      const data = new FormData(form);
      const payload = {
        items: readBasket().map((l) => ({ productId: l.productId, qty: l.qty, addonIds: l.addonIds })),
        customer: {
          name: String(data.get('name') || '').trim(),
          phone: String(data.get('phone') || '').trim(),
          email: String(data.get('email') || '').trim() || undefined,
        },
        pickupType: String(data.get('pickupType') || 'PICKUP'),
        paymentMode: String(data.get('paymentMode') || 'COUNTER'),
        deliveryAddress: String(data.get('deliveryAddress') || '').trim() || undefined,
        couponCode: String(data.get('couponCode') || '').trim() || undefined,
      };

      submit.disabled = true;
      submit.textContent = 'Placing your order…';
      try {
        const order = await api(`/public/${OUTLET}/orders`, { method: 'POST', body: JSON.stringify(payload) });
        try { localStorage.setItem(LAST_ORDER_KEY, order.token); } catch {}
        writeBasket([]);

        if (payload.paymentMode === 'ONLINE') {
          await payNow(order);
        }
        location.href = `track-standalone.html?token=${encodeURIComponent(order.token)}`;
      } catch (error) {
        flash(error.message, true);
        submit.disabled = false;
        submit.textContent = 'Place order';
      }
    });

    async function payNow(order) {
      try {
        const intent = await api(`/public/orders/${order.token}/pay`, { method: 'POST' });
        await new Promise((resolve) => {
          const rzp = new window.Razorpay({
            key: intent.keyId,
            order_id: intent.razorpayOrderId,
            amount: intent.amount,
            currency: intent.currency,
            name: intent.name,
            description: `Order #${order.tokenNo}`,
            prefill: intent.prefill,
            theme: { color: '#c94934' },
            // The order is confirmed by Razorpay's webhook, so closing this window is safe.
            handler: () => resolve(),
            modal: { ondismiss: () => resolve() },
          });
          rzp.open();
        });
      } catch (error) {
        flash(`${error.message} — you can still pay at the counter.`, true);
      }
    }
  }

  // ── track page ────────────────────────────────────────────────────────────
  const STEPS = [
    { key: 'PLACED', label: 'Order received' },
    { key: 'ACCEPTED', label: 'Confirmed by the kitchen' },
    { key: 'PREPARING', label: 'Cooking' },
    { key: 'READY', label: 'Ready' },
    { key: 'COMPLETED', label: 'Picked up' },
  ];

  async function initTrackPage() {
    const root = el('[data-track-page]');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';

    const params = new URLSearchParams(location.search);
    let token = params.get('token');
    if (!token) {
      try { token = localStorage.getItem(LAST_ORDER_KEY); } catch {}
    }
    if (!token) {
      root.innerHTML = `<div class="track-card"><h1>No order to show</h1><p>Open the link from your confirmation email, or <a href="order-standalone.html">start a new order</a>.</p></div>`;
      return;
    }

    const render = (order) => {
      const rejected = order.status === 'REJECTED';
      const activeIndex = STEPS.findIndex((s) => s.key === order.status);
      const eta = order.readyEstimateAt ? new Date(order.readyEstimateAt) : null;
      const etaText = rejected
        ? ''
        : order.status === 'READY'
          ? 'Ready now'
          : eta
            ? `Ready around ${eta.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : 'We will confirm your wait time in a moment';

      root.innerHTML = `
        <div class="track-card">
          <p class="track-token">Token <strong>#${order.tokenNo}</strong></p>
          <h1>${rejected ? 'Order cancelled' : escapeHtml(etaText)}</h1>
          ${rejected
            ? `<p class="track-reason">${escapeHtml(order.rejectionReason || 'The kitchen could not take this order.')}${order.paymentMode === 'ONLINE' ? ' Your payment will be refunded.' : ''}</p>`
            : `<ol class="track-steps">${STEPS.map((step, i) => `
                <li class="${i < activeIndex ? 'done' : i === activeIndex ? 'current' : ''}">
                  <span class="dot"></span>${step.label}
                </li>`).join('')}</ol>`}

          <ul class="track-items">
            ${order.items.map((i) => `<li><span>${i.qty}× ${escapeHtml(i.name)}${i.addons.length ? ` <em>+ ${escapeHtml(i.addons.join(', '))}</em>` : ''}</span><span>${money(i.lineTotal)}</span></li>`).join('')}
          </ul>
          <dl class="basket-totals">
            <div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>
            ${order.discount ? `<div><dt>Discount</dt><dd>−${money(order.discount)}</dd></div>` : ''}
            ${order.packagingCharge ? `<div><dt>Packaging</dt><dd>${money(order.packagingCharge)}</dd></div>` : ''}
            ${order.deliveryFee ? `<div><dt>Delivery</dt><dd>${money(order.deliveryFee)}</dd></div>` : ''}
            <div><dt>GST</dt><dd>${money(order.tax)}</dd></div>
            <div class="grand"><dt>Total</dt><dd>${money(order.total)}</dd></div>
          </dl>
          <p class="pay-state">${order.paid ? 'Paid' : order.paymentMode === 'ONLINE' ? 'Waiting for payment confirmation' : 'Pay at the counter'}</p>
          ${order.outlet?.phone ? `<p class="track-help">Questions? Call <a href="tel:${escapeHtml(order.outlet.phone)}">${escapeHtml(order.outlet.phone)}</a></p>` : ''}
          <div class="track-actions">
            <a class="btn secondary" href="order-standalone.html">Order again</a>
            <button class="text-link" type="button" data-reorder>Repeat this order</button>
          </div>
        </div>`;

      const repeat = el('[data-reorder]', root);
      if (repeat) repeat.onclick = async () => {
        try {
          const { items } = await api(`/public/orders/${token}/reorder`);
          const menu = await loadMenu();
          const products = menu.categories.flatMap((c) => c.products);
          writeBasket([]);
          items.forEach((line) => {
            const product = products.find((p) => p.id === line.productId);
            if (product && !product.soldOut) addToBasket(product, line.addonIds, line.qty);
          });
          location.href = 'order-standalone.html';
        } catch (error) {
          flash(error.message, true);
        }
      };
    };

    const refresh = async () => {
      try { render(await api(`/public/orders/${token}`)); } catch (error) {
        root.innerHTML = `<div class="track-card"><h1>We can't find that order</h1><p>${escapeHtml(error.message)}</p></div>`;
      }
    };
    await refresh();

    // Live updates; polling keeps things honest if the socket drops.
    const poll = setInterval(refresh, 20000);
    loadSocket().then((io) => {
      if (!io) return;
      const socket = io(API.replace(/\/api$/, ''), { transports: ['websocket', 'polling'] });
      socket.on('connect', () => socket.emit('JOIN_ROOM', `track:${token}`));
      socket.on('order-updated', (order) => render(order));
    }).catch(() => {});
    window.addEventListener('beforeunload', () => clearInterval(poll));
  }

  function loadSocket() {
    if (window.io) return Promise.resolve(window.io);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
      script.onload = () => resolve(window.io);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  // ── shared bits ───────────────────────────────────────────────────────────
  function flash(message, isError = false) {
    const toast = el('.toast') || Object.assign(document.createElement('div'), { className: 'toast' });
    if (!toast.isConnected) document.body.appendChild(toast);
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.toggle('is-error', isError);
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function syncBasketBadges() {
    els('[data-basket-count]').forEach((n) => (n.textContent = String(basketCount())));
  }

  document.addEventListener('basket:changed', syncBasketBadges);
  document.addEventListener('DOMContentLoaded', () => {
    syncBasketBadges();
    refreshStaticMenu();
    initOrderPage();
    initTrackPage();
  });

  // Let the existing site.js bag hand over to the live order page.
  window.RiceBowlStore = { addToBasket, readBasket, writeBasket, loadMenu, basketCount };
})();
