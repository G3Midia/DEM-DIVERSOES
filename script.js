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
    const IMAGE_SIZES = {
      card: { width: 640, height: 480 },
      product: { width: 960, height: 720 },
      thumb: { width: 200, height: 150 },
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
  
    const getPendingViewId = () =>
      sessionStorage.getItem("pending_viewcontent_id");
    const setPendingViewId = (id) =>
      sessionStorage.setItem("pending_viewcontent_id", String(id));
    const clearPendingViewId = () =>
      sessionStorage.removeItem("pending_viewcontent_id");
  
    const trackViewContent = (product, fromClick = false) => {
      if (!product) return;
      const value = parsePriceValue(product.preco);
      trackEvent("ViewContent", {
        content_name: product.nome,
        content_ids: [String(product.id)],
        content_type: "product",
        content_category: product.categoria,
        value: value ?? undefined,
        currency: value ? "BRL" : undefined,
      });
      if (fromClick) setPendingViewId(product.id);
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
  
    /* ================= FETCH ================= */
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
          const categoria = row.categoria || row.Categoria || "";
          const subcategoria = row.subcategoria || row.Subcategoria || "";
          const preco = row.preco || row.Preco || row.Preço || "";
          const descricao = row.descricao || row.Descricao || row.Descrição || "";
          const imagens = row.imagens || row.Imagens || "";
  
  
          const product = {
            id: String(id),
            nome: String(nome),
            categoria: normalize(categoria),
            subcategorias: String(subcategoria)
              .split(",")
              .map((s) => normalize(s))
              .filter(Boolean),
            preco: String(preco),
            descricao: String(descricao),
            imagens: String(imagens)
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
                  <img src="${imageUrl}" alt="${product.nome}" data-index="${productOriginalImages.length - 1}">
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
          }
        });
  
        // Inverte a lista para que os itens mais recentes (últimos da planilha) apareçam primeiro
        products.reverse();

        /* ===== HOME ===== */
        if (allList) renderHome(products);
  
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
          const pendingId = getPendingViewId();
          if (pendingId && String(currentProduct.id) === String(pendingId)) {
            clearPendingViewId();
          } else {
            trackViewContent(currentProduct);
          }
        }
  
        /* ===== RECOMENDADOS ===== */
        if (productId && currentProduct && relatedList) {
          renderRelated();
        }
      });
  
    initReveals();
    revealHeroOnLoad();
  
    /* ================= HOME ================= */
    function renderHome(list, searching = false) {
      if (!allList) return;
  
      allList.innerHTML = "";
      decorList && (decorList.innerHTML = "");
  
      list.forEach((p) => {
        const cardImage = formatImageUrl(p.imagens[0], "card");
        const card = `
          <li class="splide__slide">
            <a href="produto.html?id=${p.id}" class="product-card" data-product-id="${p.id}">
              <img src="${cardImage}" alt="${p.nome}">
              <div class="product-card-content">
                <h3>${p.nome}</h3>
                <span>${p.preco}</span>
              </div>
            </a>
          </li>
        `;
  
        if (!searching && p.categoria === "decoracoes" && decorList) {
          decorList.insertAdjacentHTML("beforeend", card);
        } else {
          allList.insertAdjacentHTML("beforeend", card);
        }
      });
  
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
            <a href="produto.html?id=${p.id}" class="product-card" data-product-id="${p.id}">
              <img src="${cardImage}" alt="${p.nome}">
              <div class="product-card-content">
                <h3>${p.nome}</h3>
                <span>${p.preco}</span>
              </div>
            </a>
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
        if (!isSearchFocused) setHeroHidden(false);
        return;
      }
  
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
      const productLink = event.target.closest("a.product-card");
      if (productLink) {
        const productIdFromLink = productLink.getAttribute("data-product-id");
        const product = products.find(
          (p) => String(p.id) === String(productIdFromLink)
        );
        trackViewContent(product, true);
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
  
  
