document.addEventListener("DOMContentLoaded", () => {
  const cartApi = window.Cart;
  cartApi?.updateBadge?.();

  const sheetUrl =
    "https://script.google.com/macros/s/AKfycbxgMNP1sis1Ew1gRs9W76jHD43pDlY2sFHy0hwhzelHbbX1q2fswYOM5y7MHIeWlnip/exec";

  const params = new URLSearchParams(window.location.search);
  const productsParam = params.get("products") || "";
  const couponParam = (params.get("coupon") || params.get("cupom") || "").trim();
  const item = params.get("item") || "";
  const id = params.get("id") || "";
  const price = params.get("preco") || "";

  const parseProducts = (value) => {
    if (!value) return [];
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [rawId, rawQty] = entry.split(":");
        const parsedId = String(rawId || "").trim();
        if (!parsedId) return null;
        const parsedQty = Number.parseInt(String(rawQty || "1"), 10);
        return {
          id: parsedId,
          qty: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
        };
      })
      .filter(Boolean);
  };

  const fetchCatalogMap = async () => {
    const map = new Map();
    try {
      const response = await fetch(sheetUrl);
      const data = await response.json();
      const rows = Array.isArray(data) ? data : data.data || [];
      rows.forEach((row) => {
        const productId = String(row.id || row.Id || row.ID || "").trim();
        if (!productId) return;
        const productName = String(row.nome || row.Nome || "").trim() || `Item ${productId}`;
        const productPrice = String(row.preco || row.Preco || row.Preço || "").trim();
        map.set(productId, { nome: productName, preco: productPrice });
      });
    } catch (error) {
      console.warn("Nao foi possivel carregar catalogo para o checkout URL.", error);
    }
    return map;
  };

  const cartEl = document.getElementById("checkout-cart");
  const itemsEl = document.getElementById("checkout-items");
  const emptyEl = document.getElementById("checkout-empty");
  const clearBtn = document.getElementById("checkout-clear");
  const PRICE_CURRENCY = "BRL";
  let hasTrackedViewCart = false;
  let hasTrackedInitiateCheckout = false;

  const formatDate = (value) => {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
  };

  const compactParams = (params = {}) => {
    const clean = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (typeof value === "string" && value.trim() === "") return;
      if (Array.isArray(value) && value.length === 0) return;
      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      ) {
        return;
      }
      clean[key] = value;
    });
    return clean;
  };

  const trackEvent = (name, params = {}) => {
    if (typeof window.fbq !== "function") return;
    window.fbq("track", name, compactParams(params));
  };

  const parsePriceValue = (priceText) => {
    if (cartApi?.parsePriceValue) return cartApi.parsePriceValue(priceText);
    if (!priceText) return null;
    const raw = String(priceText).match(/[\d.,]+/g);
    if (!raw) return null;
    const normalized = raw.join("").replace(/\./g, "").replace(",", ".");
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  };

  const buildCommercePayload = (entries = []) => {
    const normalizedEntries = Array.isArray(entries) ? entries : [];
    const contentIds = [];
    const contents = [];
    let numItems = 0;
    let totalValue = 0;
    let hasValue = false;

    normalizedEntries.forEach((entry) => {
      const entryId = String(entry?.id ?? "").trim();
      if (!entryId) return;

      const qtyRaw = Number(entry?.qty ?? 1);
      const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
      const priceValue = parsePriceValue(entry?.preco);

      const contentEntry = { id: entryId, quantity };
      if (priceValue !== null) {
        contentEntry.item_price = priceValue;
        totalValue += priceValue * quantity;
        hasValue = true;
      }

      numItems += quantity;
      contentIds.push(entryId);
      contents.push(contentEntry);
    });

    return {
      content_ids: contentIds.length ? contentIds : undefined,
      contents: contents.length ? contents : undefined,
      num_items: numItems || undefined,
      value: hasValue ? totalValue : undefined,
      currency: hasValue ? PRICE_CURRENCY : undefined,
    };
  };

  const trackViewCart = (items) => {
    if (hasTrackedViewCart || !Array.isArray(items) || !items.length) return;
    trackEvent("ViewCart", {
      ...buildCommercePayload(items),
      content_type: "product",
    });
    hasTrackedViewCart = true;
  };

  const trackInitiateCheckout = (items) => {
    if (
      hasTrackedInitiateCheckout ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return;
    }
    trackEvent("InitiateCheckout", {
      ...buildCommercePayload(items),
      content_type: "product",
      source: "checkout_page",
    });
    hasTrackedInitiateCheckout = true;
  };

  const trackAddToCart = (entry, qty = 1) => {
    if (!entry) return;
    trackEvent("AddToCart", {
      ...buildCommercePayload([{ ...entry, qty }]),
      content_name: entry.nome,
      content_type: "product",
    });
  };

  const trackRemoveFromCart = (entry, qty = 1) => {
    if (!entry) return;
    trackEvent("RemoveFromCart", {
      ...buildCommercePayload([{ ...entry, qty }]),
      content_name: entry.nome,
      content_type: "product",
    });
  };

  const trackPurchase = (items) => {
    trackEvent("Purchase", {
      ...buildCommercePayload(items),
      content_type: "product",
      content_name: Array.isArray(items) && items.length
        ? items.map((entry) => entry.nome).filter(Boolean).join(", ")
        : "Checkout WhatsApp",
    });
  };

  const renderCart = () => {
    if (!itemsEl || !cartApi) return;
    const items = cartApi.getItems();
    itemsEl.innerHTML = "";

    const hasItems = items.length > 0;
    cartEl?.classList.toggle("is-hidden", !hasItems);
    emptyEl?.classList.toggle("is-hidden", hasItems);

    if (!hasItems) {
      return;
    }

    items.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "checkout-item";

      const priceLabel = entry.preco ? entry.preco : "Sob consulta";
      row.innerHTML = `
        <div class="checkout-item-info">
          <strong>${entry.nome}</strong>
          <span class="checkout-item-meta">ID: ${entry.id} • ${priceLabel}</span>
        </div>
        <div class="checkout-item-actions">
          <div class="checkout-qty">
            <button type="button" class="checkout-qty-btn" data-action="decrease" data-id="${entry.id}">-</button>
            <span class="checkout-qty-value">${entry.qty || 1}</span>
            <button type="button" class="checkout-qty-btn" data-action="increase" data-id="${entry.id}">+</button>
          </div>
          <button type="button" class="checkout-remove" data-action="remove" data-id="${entry.id}">Remover</button>
        </div>
      `;

      itemsEl.appendChild(row);
    });

    trackViewCart(items);
    trackInitiateCheckout(items);
  };

  itemsEl?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || !cartApi) return;
    const action = button.dataset.action;
    const itemId = button.dataset.id;
    if (!itemId) return;

    const items = cartApi.getItems();
    const itemEntry = items.find((entry) => String(entry.id) === String(itemId));
    if (!itemEntry) return;

    if (action === "increase") {
      trackAddToCart(itemEntry, 1);
      cartApi.updateQty(itemId, Number(itemEntry.qty || 1) + 1);
    } else if (action === "decrease") {
      const nextQty = Number(itemEntry.qty || 1) - 1;
      trackRemoveFromCart(itemEntry, 1);
      if (nextQty <= 0) {
        cartApi.removeItem(itemId);
      } else {
        cartApi.updateQty(itemId, nextQty);
      }
    } else if (action === "remove") {
      trackRemoveFromCart(itemEntry, Number(itemEntry.qty || 1));
      cartApi.removeItem(itemId);
    }

    cartApi.updateBadge();
    renderCart();
  });

  clearBtn?.addEventListener("click", () => {
    const items = cartApi?.getItems?.() || [];
    items.forEach((entry) => {
      trackRemoveFromCart(entry, Number(entry.qty || 1));
    });
    cartApi?.clear();
    cartApi?.updateBadge();
    renderCart();
  });

  const syncCartFromUrl = async () => {
    if (!cartApi) return;

    const parsedProducts = parseProducts(productsParam);
    if (parsedProducts.length > 0) {
      const catalogMap = await fetchCatalogMap();
      cartApi.clear();
      parsedProducts.forEach((entry) => {
        const catalogItem = catalogMap.get(entry.id);
        const nome = catalogItem?.nome || `Item ${entry.id}`;
        const preco = catalogItem?.preco || "";
        for (let index = 0; index < entry.qty; index += 1) {
          cartApi.addItem({ id: entry.id, nome, preco });
        }
      });
      cartApi.updateBadge();
      return;
    }

    if (item || id) {
      const paramId = id || item;
      const exists = cartApi
        .getItems()
        .some((entry) => String(entry.id) === String(paramId));
      if (!exists) {
        cartApi.addItem({ id: paramId, nome: item || `Item ${paramId}`, preco: price });
      }
      cartApi.updateBadge();
      if (window.history?.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  };

  syncCartFromUrl().finally(() => {
    renderCart();
  });

  const form = document.getElementById("checkout-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const date = document.getElementById("checkout-date")?.value.trim();
    const location = document.getElementById("checkout-location")?.value.trim();
    const notes = document.getElementById("checkout-notes")?.value.trim();
    const coupon = couponParam;
    const items = cartApi ? cartApi.getItems() : [];
    const itemsText = items.length
      ? items
          .map((entry) => {
            const qty = Number(entry.qty || 1);
            return `${qty} ${entry.nome}`;
          })
          .join(", ")
      : "0 itens";

    let message = `Olá, quero fazer um orçamento, ${itemsText}`;
    if (date) message += `, data do evento: ${formatDate(date)}`;
    if (location) message += `, bairro: ${location}`;
    if (coupon) message += `, cupom: ${coupon}`;
    if (notes) message += `, OBS.: ${notes}`;

    const whatsappUrl = `https://wa.me/5569992329825?text=${encodeURIComponent(
      message
    )}`;
    trackPurchase(items);
    if (typeof window.fbq === "function") {
      window.setTimeout(() => {
        window.location.href = whatsappUrl;
      }, 180);
      return;
    }
    window.location.href = whatsappUrl;
  });

  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
});
