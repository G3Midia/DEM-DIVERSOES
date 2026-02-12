(() => {
  const CART_KEY = "dm_cart";
  let memoryCart = [];

  const getStorage = () => {
    try {
      const testKey = "__dm_cart_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (err) {
      return null;
    }
  };

  const storage = getStorage();

  const normalizeId = (value) => String(value ?? "").trim();

  const safeParse = (value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  };

  const readCart = () => {
    if (!storage) return memoryCart;
    const raw = storage.getItem(CART_KEY);
    return raw ? safeParse(raw) : [];
  };

  const writeCart = (items) => {
    const clean = Array.isArray(items) ? items : [];
    if (!storage) {
      memoryCart = clean;
      return;
    }
    storage.setItem(CART_KEY, JSON.stringify(clean));
  };

  const getItems = () => readCart();

  const setItems = (items) => {
    writeCart(items);
  };

  const addItem = ({ id, nome, preco }) => {
    const safeId = normalizeId(id);
    if (!safeId) return false;
    const items = getItems();
    const existing = items.find((item) => normalizeId(item.id) === safeId);
    if (existing) {
      existing.qty = Number(existing.qty || 1) + 1;
    } else {
      items.push({
        id: safeId,
        nome: String(nome || "").trim() || "Item",
        preco: String(preco || "").trim(),
        qty: 1,
      });
    }
    setItems(items);
    return true;
  };

  const updateQty = (id, qty) => {
    const safeId = normalizeId(id);
    if (!safeId) return;
    const items = getItems();
    const item = items.find((entry) => normalizeId(entry.id) === safeId);
    if (!item) return;
    const nextQty = Math.max(1, Number(qty || 1));
    item.qty = nextQty;
    setItems(items);
  };

  const removeItem = (id) => {
    const safeId = normalizeId(id);
    if (!safeId) return;
    const items = getItems().filter(
      (item) => normalizeId(item.id) !== safeId
    );
    setItems(items);
  };

  const clear = () => {
    setItems([]);
  };

  const getCount = (items = getItems()) =>
    items.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  const parsePriceValue = (priceText) => {
    if (!priceText) return null;
    const raw = String(priceText).match(/[\d.,]+/g);
    if (!raw) return null;
    const normalized = raw.join("").replace(/\./g, "").replace(",", ".");
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);

  const getTotal = (items = getItems()) => {
    let total = 0;
    let hasUnpriced = false;
    items.forEach((item) => {
      const priceValue = parsePriceValue(item.preco);
      if (priceValue === null) {
        hasUnpriced = true;
        return;
      }
      total += priceValue * Number(item.qty || 1);
    });
    return { total, hasUnpriced };
  };

  const updateBadge = (root = document) => {
    const badges = root.querySelectorAll("[data-cart-badge]");
    if (!badges.length) return;
    const count = getCount();
    badges.forEach((badge) => {
      badge.textContent = String(count);
      badge.classList.toggle("is-hidden", count === 0);
    });
  };

  window.Cart = {
    getItems,
    addItem,
    updateQty,
    removeItem,
    clear,
    getTotal,
    getCount,
    formatCurrency,
    parsePriceValue,
    updateBadge,
  };

  window.addEventListener("storage", (event) => {
    if (event.key === CART_KEY) updateBadge();
  });
})();
