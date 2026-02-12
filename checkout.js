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
  const couponInput = document.getElementById("checkout-coupon");
  if (couponInput && couponParam) couponInput.value = couponParam;

  const formatDate = (value) => {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
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
      cartApi.updateQty(itemId, Number(itemEntry.qty || 1) + 1);
    } else if (action === "decrease") {
      const nextQty = Number(itemEntry.qty || 1) - 1;
      if (nextQty <= 0) {
        cartApi.removeItem(itemId);
      } else {
        cartApi.updateQty(itemId, nextQty);
      }
    } else if (action === "remove") {
      cartApi.removeItem(itemId);
    }

    cartApi.updateBadge();
    renderCart();
  });

  clearBtn?.addEventListener("click", () => {
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
    const coupon = document.getElementById("checkout-coupon")?.value.trim();
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

    const whatsappUrl = `https://wa.me/5569992329825?text=${encodeURIComponent(
      message
    )}`;
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
