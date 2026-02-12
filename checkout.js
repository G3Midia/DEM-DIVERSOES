document.addEventListener("DOMContentLoaded", () => {
  const cartApi = window.Cart;
  cartApi?.updateBadge?.();

  const params = new URLSearchParams(window.location.search);
  const item = params.get("item") || "";
  const id = params.get("id") || "";
  const price = params.get("preco") || "";

  if (cartApi && (item || id)) {
    const paramId = id || item;
    const exists = cartApi
      .getItems()
      .some((entry) => String(entry.id) === String(paramId));
    if (!exists) {
      cartApi.addItem({ id: paramId, nome: item || "Item", preco: price });
      cartApi.updateBadge();
    }
    if (window.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  const cartEl = document.getElementById("checkout-cart");
  const itemsEl = document.getElementById("checkout-items");
  const emptyEl = document.getElementById("checkout-empty");
  const clearBtn = document.getElementById("checkout-clear");

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

  renderCart();

  const form = document.getElementById("checkout-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const date = document.getElementById("checkout-date")?.value.trim();
    const location = document.getElementById("checkout-location")?.value.trim();
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
