document.addEventListener("DOMContentLoaded", () => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id");
  
    const sheetUrl =
      "https://script.google.com/macros/s/AKfycbxgMNP1sis1Ew1gRs9W76jHD43pDlY2sFHy0hwhzelHbbX1q2fswYOM5y7MHIeWlnip/exec";
  
    /* ================= ELEMENTOS ================= */
    const allList = document.querySelector("#carousel-all .splide__list");
    const decorList = document.querySelector("#carousel-decor .splide__list");
    const relatedList = document.querySelector("#carousel-related .splide__list");
  
    const carouselDecor = document.getElementById("carousel-decor");
    const searchInput = document.getElementById("searchInput");
    const searchBox = document.querySelector(".search-box");
    const hero = document.querySelector(".hero");
  
    const imagesEl = document.getElementById("product-images");
    const thumbsEl = document.getElementById("product-thumbs");
    const lightbox = document.getElementById("image-lightbox");
    const lightboxImage = document.querySelector(".lightbox-image");
    const lightboxClose = document.querySelector(".lightbox-close");
    const lightboxPrev = document.querySelector(".lightbox-prev");
    const lightboxNext = document.querySelector(".lightbox-next");
  
    let products = [];
    let currentProduct = null;
  
    let splideAll = null;
    let splideDecor = null;
    let splideRelated = null;
    let isSearchFocused = false;
    let homeRenderTimer = null;
    let homeRenderedAll = false;
  
    const revealObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
              });
            },
            { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
          )
        : null;
  
    const addRevealClass = (root = document) => {
      root
        .querySelectorAll(
          ".hero-content > *, .hero-art, .search-container, .section-title, .splide, .decor-notice, .faq-section"
        )
        .forEach((el) => {
          if (!el.classList.contains("reveal")) el.classList.add("reveal");
        });
  
      const groups = new Map();
      root.querySelectorAll(".reveal").forEach((el) => {
        const group =
          el.closest(".hero-inner, .section, .faq-section, .search-container") ||
          document.body;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(el);
      });
  
      groups.forEach((items) => {
        items.forEach((el, index) => {
          el.style.transitionDelay = `${index * 80}ms`;
        });
      });
    };
  
    const observeReveals = (root = document) => {
      if (!revealObserver) {
        root.querySelectorAll(".reveal").forEach((el) => {
          el.classList.add("is-visible");
        });
        return;
      }
      root
        .querySelectorAll(".reveal:not(.is-visible)")
        .forEach((el) => revealObserver.observe(el));
    };
  
    const initReveals = (root = document) => {
      addRevealClass(root);
      observeReveals(root);
    };
  
    const revealHeroOnLoad = () => {
      const heroTargets = document.querySelectorAll(".hero-content, .hero-art");
      if (!heroTargets.length) return;
      requestAnimationFrame(() => {
        heroTargets.forEach((el) => el.classList.add("is-visible"));
      });
    };
  
    const normalize = (str = "") =>
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
  
    const CLOUDINARY_MARKER = "/image/upload/";
    const META_BRAND = "D&M Diversões";
    const PRICE_CURRENCY = "BRL";
    const CHECKOUT_PAGE = "checkout.html";
    const HOME_INITIAL_LIMIT = 18;
    const HOME_DEFER_FULL_RENDER = true;
    const IMAGE_SIZES = {
      card: { width: 640, height: 480 },
      product: { width: 960, height: 720 },
      thumb: { width: 200, height: 150 },
    };

    const parseImageList = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
      const raw = String(value).trim();
      if (!raw) return [];
      if (raw.startsWith("[") && raw.endsWith("]")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((v) => String(v).trim()).filter(Boolean);
          }
        } catch (err) {
          // Fallback to string parsing below.
        }
      }
      const matches = [...raw.matchAll(/https?:\/\//g)];
      if (matches.length === 0) {
        return raw
          .split(/[\n;]+/)
          .map((v) => v.trim())
          .filter(Boolean);
      }
      const urls = matches.map((match, index) => {
        const start = match.index ?? 0;
        const end = index + 1 < matches.length ? (matches[index + 1].index ?? raw.length) : raw.length;
        return raw.slice(start, end).replace(/^[,\\s]+|[,\\s]+$/g, "").trim();
      });
      return urls.filter(Boolean);
    };
  
    const buildCloudinaryTransform = ({ width, height } = {}) => {
      const parts = ["f_webp", "q_auto:good", "fl_strip_profile"];
      if (width) parts.push(`w_${width}`);
      if (height) parts.push(`h_${height}`, "c_fill");
      return parts.join(",");
    };
  
    const formatImageUrl = (url, sizeKey) => {
      if (!url) return url;
      if (!url.includes("res.cloudinary.com")) return url;
      const markerIndex = url.indexOf(CLOUDINARY_MARKER);
      if (markerIndex === -1) return url;
      if (url.includes("f_webp") && url.includes("q_auto")) return url;
      const size = IMAGE_SIZES[sizeKey] || {};
      const transform = buildCloudinaryTransform(size);
      const insertIndex = markerIndex + CLOUDINARY_MARKER.length;
      return `${url.slice(0, insertIndex)}${transform}/${url.slice(
        insertIndex
      )}`;
    };
  
    const productOriginalImages = [];
    let currentLightboxIndex = 0;
  
    const openLightbox = (index) => {
      if (!lightbox || !lightboxImage) return;
      const safeIndex =
        ((index % productOriginalImages.length) + productOriginalImages.length) %
        productOriginalImages.length;
      currentLightboxIndex = safeIndex;
      lightboxImage.src = productOriginalImages[safeIndex];
      lightboxImage.alt = currentProduct?.nome || "Imagem do produto";
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };
  
    const closeLightbox = () => {
      if (!lightbox || !lightboxImage) return;
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      lightboxImage.src = "";
      document.body.style.overflow = "";
    };
  
    const showLightboxOffset = (direction) => {
      if (!productOriginalImages.length) return;
      openLightbox(currentLightboxIndex + direction);
    };
  
    const compactParams = (params) => {
      const clean = {};
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (typeof value === "string" && value.trim() === "") return;
        if (Array.isArray(value) && value.length === 0) return;
        clean[key] = value;
      });
      return clean;
    };
  
    const trackEvent = (name, params = {}) => {
      if (typeof window.fbq !== "function") return;
      window.fbq("track", name, compactParams(params));
    };
  
    const parsePriceValue = (priceText) => {
      if (!priceText) return null;
      const raw = String(priceText).match(/[\d.,]+/g);
      if (!raw) return null;
      const normalized = raw.join("").replace(/\./g, "").replace(",", ".");
      const value = Number.parseFloat(normalized);
      return Number.isFinite(value) ? value : null;
    };

    const stripHtml = (value = "") =>
      String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const setContentById = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (value === undefined || value === null || value === "") {
        el.removeAttribute("content");
        return;
      }
      el.setAttribute("content", String(value));
    };

    const setHrefById = (id, value) => {
      const el = document.getElementById(id);
      if (!el || !value) return;
      el.setAttribute("href", value);
    };

    const upsertJsonLd = (id, data) => {
      if (!data) return;
      const head = document.head || document.querySelector("head");
      if (!head) return;
      let script = document.getElementById(id);
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = id;
        head.appendChild(script);
      }
      script.textContent = JSON.stringify(data);
    };

    const upsertMetaTag = (property, content, attr = "property") => {
      if (!property || content === undefined || content === null || content === "")
        return;
      const head = document.head || document.querySelector("head");
      if (!head) return;
      const selector = `meta[${attr}="${property}"]`;
      let tag = head.querySelector(selector);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, property);
        head.appendChild(tag);
      }
      tag.setAttribute("content", String(content));
    };

    const applyOpenGraphTags = (product, options = {}) => {
      if (!product) return;
      const { url, priceValue, image } = options;
      const description = stripHtml(product.descricao);
      const category = product.categoriaOriginal || product.categoria || "";
      const groupId = product.groupId ? String(product.groupId) : String(product.id);

      upsertMetaTag("og:type", "product");
      upsertMetaTag("og:title", product.nome);
      if (description) upsertMetaTag("og:description", description);
      if (url) upsertMetaTag("og:url", url);
      if (image) upsertMetaTag("og:image", image);

      upsertMetaTag("product:brand", META_BRAND);
      upsertMetaTag("product:availability", "in stock");
      upsertMetaTag("product:condition", "new");
      if (priceValue !== null) {
        upsertMetaTag("product:price:amount", priceValue.toFixed(2));
        upsertMetaTag("product:price:currency", PRICE_CURRENCY);
      }
      upsertMetaTag("product:retailer_item_id", product.id);
      upsertMetaTag("product:item_group_id", groupId);
      if (category) upsertMetaTag("product:category", category);
    };

    const applyProductStructuredData = (product) => {
      if (!product) return;
      const category = product.categoriaOriginal || product.categoria || "";
      const categoryKey = category ? normalize(category) : "";
      const priceValue = parsePriceValue(product.preco);
      const groupId = product.groupId ? String(product.groupId) : String(product.id);
      const url = window.location.href;

      setContentById("product-sku", product.id);
      setContentById("product-id", product.id);
      setContentById("product-category", category);
      setContentById("product-brand", META_BRAND);
      setContentById("product-url", url);
      setContentById("product-group-id", groupId);
      setContentById("product-type-value", category);
      setContentById("product-custom-label-0-value", categoryKey);
      setContentById(
        "product-price-meta",
        priceValue !== null ? priceValue.toFixed(2) : ""
      );
      setHrefById("product-availability", "https://schema.org/InStock");

      const images = Array.isArray(product.imagens)
        ? product.imagens
            .map((img) => formatImageUrl(img, "product"))
            .filter(Boolean)
        : [];

      const additionalProperty = [
        {
          "@type": "PropertyValue",
          propertyID: "item_group_id",
          value: groupId,
        },
      ];
      if (category) {
        additionalProperty.push({
          "@type": "PropertyValue",
          propertyID: "product_type",
          value: category,
        });
      }
      if (categoryKey) {
        additionalProperty.push({
          "@type": "PropertyValue",
          propertyID: "custom_label_0",
          value: categoryKey,
        });
      }

      upsertJsonLd("product-jsonld", {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.nome,
        description: stripHtml(product.descricao),
        image: images.length ? images : undefined,
        sku: String(product.id),
        productID: String(product.id),
        category: category || undefined,
        brand: { "@type": "Brand", name: META_BRAND },
        additionalProperty,
        offers:
          priceValue !== null
            ? {
                "@type": "Offer",
                price: priceValue.toFixed(2),
                priceCurrency: PRICE_CURRENCY,
                itemCondition: "https://schema.org/NewCondition",
                availability: "https://schema.org/InStock",
                url: url,
              }
            : undefined,
        url: url,
      });

      applyOpenGraphTags(product, {
        url,
        priceValue,
        image: images.length ? images[0] : "",
      });
    };

    const trackViewContent = (product) => {
      if (!product) return;
      const value = parsePriceValue(product.preco);
      trackEvent("ViewContent", {
        content_name: product.nome,
        content_ids: [String(product.id)],
        content_type: "product",
        content_category: product.categoriaOriginal || product.categoria,
        value: value ?? undefined,
        currency: value ? PRICE_CURRENCY : undefined,
      });
    };
  
    const trackSearch = (term) => {
      if (!term) return;
      trackEvent("Search", { search_string: term });
    };
  
    const trackContact = (channel, product) => {
      trackEvent("Contact", {
        contact_channel: channel,
        content_name: product?.nome,
        content_ids: product ? [String(product.id)] : undefined,
      });
    };
  
    const debounce = (fn, delay) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    };

    const cancelHomeRender = () => {
      if (!homeRenderTimer) return;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(homeRenderTimer);
      } else {
        clearTimeout(homeRenderTimer);
      }
      homeRenderTimer = null;
    };

    const scheduleHomeFullRender = () => {
      if (!HOME_DEFER_FULL_RENDER || HOME_INITIAL_LIMIT <= 0 || homeRenderedAll)
        return;
      cancelHomeRender();
      const run = () => {
        homeRenderTimer = null;
        const hasSearch = searchInput && searchInput.value.trim().length > 0;
        if (hasSearch) return;
        homeRenderedAll = true;
        renderHome(products);
      };

      if (typeof window.requestIdleCallback === "function") {
        homeRenderTimer = window.requestIdleCallback(run, { timeout: 2000 });
      } else {
        homeRenderTimer = window.setTimeout(run, 1200);
      }
    };

    const isHomeLimited = () =>
      HOME_INITIAL_LIMIT > 0 && (!HOME_DEFER_FULL_RENDER || !homeRenderedAll);
  
    /* ================= FETCH ================= */
    window.Cart?.updateBadge?.();

    fetch(sheetUrl)
      .then((res) => res.json())
      .then((data) => {
        // Suporta retorno como array direto ou objeto com propriedade 'data'
        const rows = Array.isArray(data) ? data : (data.data || []);
  
        rows.forEach((row) => {
          // Mapeia propriedades do JSON (suporta minúsculo ou maiúsculo)
          const id = row.id || row.Id || row.ID;
          if (!id) return;

          const nome = row.nome || row.Nome || "";
          const categoriaRaw = row.categoria || row.Categoria || "";
          const rawSubcategorias =
            row.subcategorias ||
            row.Subcategorias ||
            row.subcategoria ||
            row.Subcategoria ||
            "";
          const groupIdRaw =
            row.item_group_id ||
            row.itemGroupId ||
            row.item_group ||
            row.groupId ||
            row.grupo ||
            row.Grupo ||
            "";
          const preco = row.preco || row.Preco || row.Preço || "";
          const descricao = row.descricao || row.Descricao || row.Descrição || "";
          const imagens = row.imagens || row.Imagens || "";
          const imagensList = parseImageList(imagens);
  
  
          const product = {
            id: String(id),
            nome: String(nome),
            categoria: normalize(categoriaRaw),
            categoriaOriginal: String(categoriaRaw).trim(),
            subcategorias: Array.isArray(rawSubcategorias)
              ? rawSubcategorias.map((s) => normalize(String(s))).filter(Boolean)
              : String(rawSubcategorias)
                  .split(",")
                  .map((s) => normalize(s))
                  .filter(Boolean),
            groupId: String(groupIdRaw || "").trim(),
            preco: String(preco),
            descricao: String(descricao),
            imagens: imagensList.length
              ? imagensList
              : String(imagens)
                  .split(",")
                  .map((i) => i.trim())
                  .filter(Boolean),
          };
  
          products.push(product);
  
          /* ===== PRODUTO ATUAL ===== */
          if (productId && id == productId) {
            currentProduct = product;
  
            document.title = `${product.nome} • D&M Diversões`;
  
            document.getElementById("product-name").textContent = product.nome;
            document.getElementById("product-price").textContent = product.preco;
            document.getElementById("product-description").innerHTML =
              product.descricao.replace(/\n/g, "<br>");
  
            product.imagens.forEach((url) => {
              const imageUrl = formatImageUrl(url, "product");
              const thumbUrl = formatImageUrl(url, "thumb");
              productOriginalImages.push(url);
              imagesEl.insertAdjacentHTML(
                "beforeend",
                `<li class="splide__slide">
                  <img src="${imageUrl}" alt="${product.nome}" data-index="${productOriginalImages.length - 1}" itemprop="image">
                </li>`
              );
              if (thumbsEl) {
                thumbsEl.insertAdjacentHTML(
                  "beforeend",
                  `<li class="splide__slide">
                    <img src="${thumbUrl}" alt="${product.nome}" data-index="${productOriginalImages.length - 1}">
                  </li>`
                );
              }
            });
  
            const mensagemWhatsapp =
              `Olá, tenho interesse em alugar o produto "${product.nome}"! ` +
              `Poderia me dizer se está disponível e me passar mais informações?`;
  
            document.getElementById("product-whatsapp").href =
              `https://wa.me/5569992329825?text=${encodeURIComponent(
                mensagemWhatsapp
              )}`;

            const checkoutLink = document.getElementById("product-checkout");
            if (checkoutLink) {
              const checkoutParams = new URLSearchParams();
              checkoutParams.set("products", `${product.id}:1`);
              checkoutLink.href = `${CHECKOUT_PAGE}?${checkoutParams.toString()}`;
            }

            const addToCartBtn = document.getElementById("product-add-cart");
            if (addToCartBtn && window.Cart) {
              addToCartBtn.addEventListener("click", () => {
                window.Cart.addItem({
                  id: product.id,
                  nome: product.nome,
                  preco: product.preco,
                });
                window.Cart.updateBadge();
                addToCartBtn.classList.add("is-added");
                addToCartBtn.textContent = "Adicionado!";
                window.setTimeout(() => {
                  addToCartBtn.classList.remove("is-added");
                  addToCartBtn.textContent = "Adicionar ao carrinho";
                }, 1200);
              });
            }
          }
        });
  
        // Inverte a lista para que os itens mais recentes (últimos da planilha) apareçam primeiro
        products.reverse();

        /* ===== HOME ===== */
        if (allList) {
          renderHome(products);
          scheduleHomeFullRender();
        }
  
        /* ===== SPLIDE PRODUTO ===== */
        if (productId && imagesEl) {
          const productSplide = new Splide("#splide-product", {
            type: "loop",
            autoplay: true,
            interval: 3000,
            gap: "1rem",
            pagination: true,
            arrows: true,
          });
  
          const thumbsSplide =
            productId && thumbsEl
              ? new Splide("#splide-thumbs", {
                  fixedWidth: 96,
                  fixedHeight: 72,
                  gap: "0.5rem",
                  pagination: false,
                  isNavigation: true,
                  focus: "center",
                  cover: true,
                  arrows: false,
                  breakpoints: {
                    600: { fixedWidth: 76, fixedHeight: 56 },
                  },
                })
              : null;
  
          if (thumbsSplide) {
            productSplide.sync(thumbsSplide);
            thumbsSplide.mount();
          }
  
          productSplide.mount();

          const viewImageBtn = document.getElementById("view-image-btn");
          viewImageBtn?.addEventListener("click", () => {
            const currentIndex = productSplide.index;
            openLightbox(currentIndex);
          });
        }
  
        if (productId && currentProduct) {
          applyProductStructuredData(currentProduct);
          trackViewContent(currentProduct);
        }
  
        /* ===== RECOMENDADOS ===== */
        if (productId && currentProduct && relatedList) {
          renderRelated();
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar produtos do Google Sheets:", err);
      });
  
    initReveals();
    revealHeroOnLoad();
  
    /* ================= HOME ================= */
    function renderHome(list, searching = false) {
      if (!allList) return;

      allList.innerHTML = "";
      decorList && (decorList.innerHTML = "");

      const limitActive = !searching && isHomeLimited();
      const allLimit = limitActive ? HOME_INITIAL_LIMIT : Infinity;
      const decorLimit = limitActive && decorList ? HOME_INITIAL_LIMIT : Infinity;
      let allCount = 0;
      let decorCount = 0;

      for (const p of list) {
        const isDecor = !searching && p.categoria === "decoracoes" && decorList;
        if (isDecor && decorCount >= decorLimit) {
          if (!decorList || allCount >= allLimit) break;
          continue;
        }
        if (!isDecor && allCount >= allLimit) {
          if (!decorList || decorCount >= decorLimit) break;
          continue;
        }

        const cardImage = formatImageUrl(p.imagens[0], "card");
        const card = `
          <li class="splide__slide">
            <div class="product-card" data-product-id="${p.id}">
              <a href="produto.html?id=${p.id}" class="product-card-link">
                <img src="${cardImage}" alt="${p.nome}">
              </a>
              <div class="product-card-content">
                <a href="produto.html?id=${p.id}" class="product-card-text">
                  <h3>${p.nome}</h3>
                  <span>${p.preco}</span>
                </a>
                <button
                  type="button"
                  class="product-card-cart"
                  data-cart-add
                  data-id="${p.id}"
                  data-name="${p.nome}"
                  data-price="${p.preco}"
                  aria-label="Adicionar ao carrinho"
                >
                  <span class="product-card-cart-plus">+</span>
                  <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </li>
        `;

        if (isDecor) {
          decorCount += 1;
          decorList.insertAdjacentHTML("beforeend", card);
        } else {
          allCount += 1;
          allList.insertAdjacentHTML("beforeend", card);
        }

        if (limitActive && allCount >= allLimit && (!decorList || decorCount >= decorLimit)) {
          break;
        }
      }

      if (carouselDecor) {
        carouselDecor.style.display = searching ? "none" : "block";
      }
  
      initReveals(allList);
      decorList && initReveals(decorList);
  
      initHomeSplides();
    }
  
    function initHomeSplides() {
      splideAll && splideAll.destroy(true);
      splideDecor && splideDecor.destroy(true);
  
      splideAll = new Splide("#carousel-all", {
        type: "loop",
        perPage: 3,
        gap: "1rem",
        pagination: false,
        perMove: 1,
        Speed: 1000,
        easing: "linear",
        lazyLoad: "nearby",
        rewind: true,
        breakpoints: {
          900: { perPage: 2 },
      600: {
        perPage: 1,
        padding: { left: "1.5rem", right: "1.5rem" },
        gap: "0.8rem",
    }
        },
      }).mount();
  
  
      if (carouselDecor && carouselDecor.style.display !== "none") {
        splideDecor = new Splide("#carousel-decor", {
        type: "loop",
        perPage: 3,
        gap: "1rem",
        pagination: false,
        perMove: 1,
        Speed: 1000,
        easing: "linear",
        lazyLoad: "nearby",
        rewind: true,
        breakpoints: {
          900: { perPage: 2 },
      600: {
        perPage: 1,
        padding: { left: "1.5rem", right: "1.5rem" },
        gap: "0.8rem",
    
    }
        },
        }).mount();
      }
    }
  
    /* ================= RECOMENDADOS ================= */
    function renderRelated() {
      relatedList.innerHTML = "";
  
      const relatedSource =
        currentProduct.categoria === "decoracoes"
          ? products.filter(
              (p) =>
                p.categoria === "decoracoes" &&
                p.id !== currentProduct.id
            )
          : products.filter((p) => p.id !== currentProduct.id);
  
      const currentSubcats = new Set(currentProduct.subcategorias);
      const scoreRelated = (p) => {
        let score = 0;
        if (p.categoria === currentProduct.categoria) score += 3;
        p.subcategorias.forEach((sub) => {
          if (currentSubcats.has(sub)) score += 1;
        });
        return score;
      };
  
      const related = relatedSource
        .map((p) => ({ p, score: scoreRelated(p) }))
        .sort((a, b) => b.score - a.score)
        .map(({ p }) => p);
  
      related.forEach((p) => {
        const cardImage = formatImageUrl(p.imagens[0], "card");
        relatedList.insertAdjacentHTML(
          "beforeend",
          `
          <li class="splide__slide">
            <div class="product-card" data-product-id="${p.id}">
              <a href="produto.html?id=${p.id}" class="product-card-link">
                <img src="${cardImage}" alt="${p.nome}">
              </a>
              <div class="product-card-content">
                <a href="produto.html?id=${p.id}" class="product-card-text">
                  <h3>${p.nome}</h3>
                  <span>${p.preco}</span>
                </a>
                <button
                  type="button"
                  class="product-card-cart"
                  data-cart-add
                  data-id="${p.id}"
                  data-name="${p.nome}"
                  data-price="${p.preco}"
                  aria-label="Adicionar ao carrinho"
                >
                  <span class="product-card-cart-plus">+</span>
                  <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </li>
          `
        );
      });
  
      splideRelated && splideRelated.destroy(true);
  
      splideRelated = new Splide("#carousel-related", {
        type: "loop",
        perPage: 3,
        gap: "1rem",
        pagination: false,
        perMove: 1,
        Speed: 1000,
        easing: "linear",
        lazyLoad: "nearby",
        rewind: true,
        breakpoints: {
          900: { perPage: 2 },
      600: {
        perPage: 1,
        padding: { left: "1.5rem", right: "1.5rem" },
        gap: "0.8rem",
    }
        },
      }).mount();
  
      initReveals(relatedList);
    }
  
    /* ================= PESQUISA ================= */
    const setHeroHidden = (hidden) => {
      if (!hero) return;
      hero.style.display = hidden ? "none" : "";
    };
  
    searchInput?.addEventListener("focus", () => {
      isSearchFocused = true;
      setHeroHidden(true);
    });
  
    searchInput?.addEventListener("blur", () => {
      isSearchFocused = false;
      const term = normalize(searchInput.value);
      if (!term) setHeroHidden(false);
    });
  
    searchInput?.addEventListener("input", () => {
      const term = normalize(searchInput.value);

      if (!term) {
        renderHome(products);
        scheduleHomeFullRender();
        if (!isSearchFocused) setHeroHidden(false);
        return;
      }

      cancelHomeRender();
      const filtered = products.filter((p) => {
        const text = normalize(
          p.nome +
            " " +
            p.descricao +
            " " +
            p.categoria +
            " " +
            p.subcategorias.join(" ")
        );
  
        return text.includes(term);
      });
  
      renderHome(filtered, true);
      setHeroHidden(true);
    });
  
    const sendSearch = debounce(() => {
      const term = normalize(searchInput?.value || "");
      if (term.length >= 2) trackSearch(term);
    }, 700);
  
    searchInput?.addEventListener("input", sendSearch);
  
    const blurSearchOnOutsidePress = (event) => {
      if (!searchInput || !searchBox) return;
      if (document.activeElement !== searchInput) return;
      if (searchBox.contains(event.target)) return;
      searchInput.blur();
    };
  
    document.addEventListener("pointerdown", blurSearchOnOutsidePress, {
      passive: true,
    });
  
    document.addEventListener("click", (event) => {
      const cartButton = event.target.closest("[data-cart-add]");
      if (cartButton && window.Cart) {
        event.preventDefault();
        event.stopPropagation();
        const { id, name, price } = cartButton.dataset;
        window.Cart.addItem({
          id,
          nome: name,
          preco: price,
        });
        window.Cart.updateBadge();
        cartButton.classList.add("is-added");
        window.setTimeout(() => {
          cartButton.classList.remove("is-added");
        }, 900);
        return;
      }

      const contactLink = event.target.closest("a[href]");
      if (!contactLink) return;
      const href = contactLink.getAttribute("href") || "";
      const channel =
        href.includes("wa.me")
          ? "whatsapp"
          : href.includes("instagram.com")
          ? "instagram"
          : href.includes("facebook.com")
          ? "facebook"
          : href.startsWith("mailto:")
          ? "email"
          : href.startsWith("tel:")
          ? "phone"
          : null;
  
      if (channel) {
        trackContact(channel, currentProduct);
      }
    });
  
    if (imagesEl) {
      imagesEl.addEventListener("click", (event) => {
        const img = event.target.closest("img[data-index]");
        if (!img) return;
        const index = Number.parseInt(img.dataset.index, 10);
        if (!Number.isNaN(index)) openLightbox(index);
      });
    }
  
    if (thumbsEl) {
      thumbsEl.addEventListener("click", (event) => {
        const img = event.target.closest("img[data-index]");
        if (!img) return;
        const index = Number.parseInt(img.dataset.index, 10);
        if (!Number.isNaN(index)) openLightbox(index);
      });
    }
  
    if (lightbox) {
      lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox) closeLightbox();
      });
    }
  
    lightboxClose?.addEventListener("click", closeLightbox);
    lightboxPrev?.addEventListener("click", () => showLightboxOffset(-1));
    lightboxNext?.addEventListener("click", () => showLightboxOffset(1));
  
    document.addEventListener("keydown", (event) => {
      if (!lightbox || !lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showLightboxOffset(-1);
      if (event.key === "ArrowRight") showLightboxOffset(1);
    });
  
    /* ================= NAV ================= */
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
  
    /* ================= FAQ ================= */
    const faqButtons = document.querySelectorAll(".faq-question");
    faqButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const answerId = btn.getAttribute("aria-controls");
        const answer = answerId ? document.getElementById(answerId) : null;
        const isOpen = btn.getAttribute("aria-expanded") === "true";
  
        btn.setAttribute("aria-expanded", String(!isOpen));
        const icon = btn.querySelector(".faq-icon");
        if (icon) icon.textContent = isOpen ? "+" : "-";
        if (answer) answer.hidden = isOpen;
      });
    });
  });
  
  
