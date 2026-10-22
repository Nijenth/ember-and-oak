/**
 * Pickup ordering: the cart, quantity controls, pickup times and the WhatsApp hand-off.
 *
 * The cart lives in the visitor's browser (localStorage) so it survives a reload.
 * Nothing is sent anywhere until the customer presses "Send order on WhatsApp", which
 * opens WhatsApp with the order typed out; the customer then presses Send in WhatsApp.
 */

type Day = { day: string; closed: boolean; open: string; close: string };
type CartData = {
  cafe: string;
  items: Record<string, { name: string; price: number }>;
  whatsapp: string;
  lead: number;
  currency: string;
  locale: string;
  tz: string;
  hours: Day[];
};

const dataEl = document.getElementById('cart-data');
if (dataEl) init(JSON.parse(dataEl.textContent || '{}') as CartData);

function init(data: CartData) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const MAX_QTY = 20;
  const KEY = 'cafe-cart';

  let money: Intl.NumberFormat;
  try {
    money = new Intl.NumberFormat(data.locale || 'en-US', { style: 'currency', currency: data.currency, minimumFractionDigits: 2 });
  } catch {
    money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
  const fmt = (n: number) => money.format(n);

  /* ---------- State ---------- */
  const store = {
    get<T>(k: string, fallback: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } },
    set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // Keep only items that are still on the menu, with sane quantities.
  const cart = new Map<string, number>();
  for (const [id, q] of Object.entries(store.get<Record<string, number>>(KEY, {}))) {
    if (data.items[id] && Number.isFinite(q) && q > 0) cart.set(id, Math.min(MAX_QTY, Math.floor(q)));
  }

  const count = () => [...cart.values()].reduce((a, b) => a + b, 0);
  const total = () => [...cart].reduce((sum, [id, q]) => sum + data.items[id].price * q, 0);
  const save = () => store.set(KEY, Object.fromEntries(cart));

  function setQty(id: string, q: number) {
    if (!data.items[id]) return;
    q = Math.max(0, Math.min(MAX_QTY, q));
    if (q === 0) cart.delete(id);
    else cart.set(id, q);
    save();
    render();
  }
  const add = (id: string, n = 1) => setQty(id, (cart.get(id) ?? 0) + n);

  /* ---------- Toast ---------- */
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function toast(msg: string) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
  }

  /* ---------- Rendering ---------- */
  function renderControls() {
    document.querySelectorAll<HTMLElement>('[data-qty]').forEach((el) => {
      const q = cart.get(el.dataset.qty!) ?? 0;
      const addBtn = el.querySelector<HTMLElement>('.qty-add')!;
      const step = el.querySelector<HTMLElement>('.qty-step')!;
      const hadFocus = el.contains(document.activeElement);
      addBtn.hidden = q > 0;
      step.hidden = q === 0;
      el.querySelector('.qty-n')!.textContent = String(q);
      el.querySelector<HTMLButtonElement>('[data-delta="1"]')!.disabled = q >= MAX_QTY;
      // Keep keyboard focus inside the control when it swaps between "Add" and the stepper.
      if (hadFocus && !el.contains(document.activeElement)) (q > 0 ? step.querySelector<HTMLElement>('[data-delta="1"]') : addBtn)?.focus();
      el.closest('.drink-row, .bake')?.classList.toggle('in-cart', q > 0);
    });
  }

  function renderSummary() {
    const n = count();
    const label = `${n} item${n === 1 ? '' : 's'}`;
    const badge = $('cartCount');
    if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
    $('cartBtn')?.setAttribute('aria-label', `Your order, ${label}`);
    const bar = $('orderBar');
    if (bar) {
      bar.hidden = n === 0;
      $('orderBarCount')!.textContent = label;
      $('orderBarTotal')!.textContent = fmt(total());
    }
    document.documentElement.classList.toggle('has-order', n > 0);
  }

  function renderDrawer() {
    const list = $('cartList');
    if (!list) return;
    const n = count();
    $('cartEmpty')!.hidden = n > 0;
    $('cartSum')!.hidden = n === 0;
    $('checkout')!.hidden = n === 0;
    $('cartTotal')!.textContent = fmt(total());

    list.replaceChildren(
      ...[...cart].map(([id, q]) => {
        const item = data.items[id];
        const li = document.createElement('li');
        li.className = 'cart-line';
        const name = document.createElement('span');
        name.className = 'cart-line-name';
        name.textContent = item.name;
        const price = document.createElement('span');
        price.className = 'cart-line-price';
        price.textContent = fmt(item.price * q);

        const ctl = document.createElement('div');
        ctl.className = 'qty compact';
        ctl.dataset.qtyLine = id;
        ctl.innerHTML = `<div class="qty-step">
            <button type="button" class="qty-btn" data-delta="-1"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
            <output class="qty-n"></output>
            <button type="button" class="qty-btn" data-delta="1"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
          </div>`;
        const [minus, plus] = ctl.querySelectorAll<HTMLButtonElement>('.qty-btn');
        minus.setAttribute('aria-label', q === 1 ? `Remove ${item.name}` : `Remove one ${item.name}`);
        plus.setAttribute('aria-label', `Add one more ${item.name}`);
        plus.disabled = q >= MAX_QTY;
        ctl.querySelector('.qty-n')!.textContent = String(q);
        ctl.querySelector('.qty-n')!.setAttribute('aria-label', `${item.name} quantity`);

        li.append(name, price, ctl);
        return li;
      }),
    );
  }

  function render() {
    renderControls();
    renderSummary();
    renderDrawer();
  }

  /* ---------- Clicks ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target as Element;

    const addBtn = t.closest('.qty-add');
    if (addBtn) {
      const id = addBtn.closest<HTMLElement>('[data-qty]')!.dataset.qty!;
      add(id);
      toast(`Added ${data.items[id]?.name ?? 'item'}`);
      return;
    }

    const step = t.closest<HTMLButtonElement>('.qty-btn');
    if (step) {
      const host = step.closest<HTMLElement>('[data-qty], [data-qty-line]')!;
      const id = host.dataset.qty ?? host.dataset.qtyLine!;
      const delta = Number(step.dataset.delta);
      // In the drawer, keep focus on the same line's button after it re-renders.
      const inDrawer = !!host.dataset.qtyLine;
      add(id, delta);
      if (inDrawer) {
        const again = document.querySelector<HTMLElement>(`[data-qty-line="${CSS.escape(id)}"] [data-delta="${delta}"]`);
        (again ?? document.getElementById('cartClose'))?.focus();
      }
      return;
    }

    const winAdd = t.closest<HTMLElement>('#winAdd');
    if (winAdd?.dataset.item) {
      add(winAdd.dataset.item);
      toast(`Added ${data.items[winAdd.dataset.item]?.name ?? 'item'}`);
    }
  });

  /* ---------- Drawer ---------- */
  const dialog = $<HTMLDialogElement>('cart');
  const view = $('cartView');
  const sent = $('cartSent');

  function openCart() {
    if (!dialog) return;
    view!.hidden = false;
    sent!.hidden = true;
    fillPickupTimes();
    renderDrawer();
    if (!dialog.open) dialog.showModal();
  }
  const closeCart = () => dialog?.close();

  $('cartBtn')?.addEventListener('click', openCart);
  $('orderBar')?.addEventListener('click', openCart);
  $('cartClose')?.addEventListener('click', closeCart);
  // Click on the dimmed backdrop closes the drawer.
  dialog?.addEventListener('click', (e) => { if (e.target === dialog) closeCart(); });

  /* ---------- Pickup times (in the café's time zone) ---------- */
  function cafeNow() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: data.tz || undefined, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    return { weekday: get('weekday'), minutes: +get('hour') * 60 + +get('minute') };
  }
  const toM = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  function fillPickupTimes() {
    const select = $<HTMLSelectElement>('coPickup');
    if (!select || data.hours.length !== 7) return;
    const previous = select.value;
    let now: ReturnType<typeof cafeNow>;
    try { now = cafeNow(); } catch { const d = new Date(); now = { weekday: d.toLocaleDateString('en-US', { weekday: 'long' }), minutes: d.getHours() * 60 + d.getMinutes() }; }
    const todayIdx = Math.max(0, data.hours.findIndex((h) => h.day === now.weekday));

    const groups: { label: string; slots: string[]; asap?: number }[] = [];
    for (let k = 0; k < 7 && groups.length < 2; k++) {
      const h = data.hours[(todayIdx + k) % 7];
      if (h.closed) continue;
      const open = toM(h.open), lastPickup = toM(h.close) - 15;
      let start = open;
      if (k === 0) start = Math.max(open, Math.ceil((now.minutes + data.lead) / 15) * 15);
      const slots: string[] = [];
      for (let m = start; m <= lastPickup; m += 15) slots.push(hhmm(m));
      if (!slots.length) continue;
      const label = k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : h.day;
      const isOpenNow = k === 0 && now.minutes >= open && now.minutes + data.lead <= lastPickup;
      groups.push({ label, slots, asap: isOpenNow ? data.lead : undefined });
    }

    select.replaceChildren();
    for (const g of groups) {
      const og = document.createElement('optgroup');
      og.label = g.label;
      if (g.asap) og.append(new Option(`As soon as possible (about ${g.asap} min)`, 'As soon as possible'));
      for (const s of g.slots) og.append(new Option(`${g.label}, ${s}`, `${g.label} at ${s}`));
      select.append(og);
    }
    const hasSlots = groups.length > 0;
    select.disabled = !hasSlots;
    $('coPickupErr')!.hidden = hasSlots;
    if (previous && [...select.options].some((o) => o.value === previous)) select.value = previous;
  }

  /* ---------- Checkout → WhatsApp ---------- */
  const form = $<HTMLFormElement>('checkout');
  const nameInput = $<HTMLInputElement>('coName');
  if (nameInput) nameInput.value = store.get<string>('cafe-name', '');

  let lastUrl = '';
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!data.whatsapp || count() === 0) return;
    const name = nameInput!.value.trim();
    const pickup = $<HTMLSelectElement>('coPickup')!.value;
    const note = $<HTMLTextAreaElement>('coNote')!.value.trim();

    $('coNameErr')!.hidden = !!name;
    nameInput!.setAttribute('aria-invalid', String(!name));
    if (!name) { nameInput!.focus(); return; }
    if (!pickup) { $('coPickup')!.focus(); return; }
    store.set('cafe-name', name);

    const lines = [...cart].map(([id, q]) => `${q} × ${data.items[id].name} — ${fmt(data.items[id].price * q)}`);
    const message = [
      `New pickup order for ${data.cafe}`,
      '',
      `Name: ${name}`,
      `Pickup: ${pickup}`,
      '',
      ...lines,
      '',
      `Total: ${fmt(total())}`,
      ...(note ? ['', `Note: ${note}`] : []),
    ].join('\n');

    lastUrl = `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(message)}`;
    const retry = $<HTMLAnchorElement>('coRetry');
    if (retry) retry.href = lastUrl;
    window.open(lastUrl, '_blank', 'noopener');
    view!.hidden = true;
    sent!.hidden = false;
    $('coDone')?.focus();
  });

  $('coDone')?.addEventListener('click', () => {
    cart.clear();
    save();
    render();
    $<HTMLTextAreaElement>('coNote')!.value = '';
    closeCart();
    toast('Thanks! See you soon.');
  });
  $('coBack')?.addEventListener('click', () => { view!.hidden = false; sent!.hidden = true; });

  // Keep the cart in step if it's changed in another tab.
  addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    cart.clear();
    for (const [id, q] of Object.entries(store.get<Record<string, number>>(KEY, {}))) if (data.items[id] && q > 0) cart.set(id, Math.min(MAX_QTY, q));
    render();
  });

  render();
}
