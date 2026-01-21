document.addEventListener("DOMContentLoaded", () => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/13nL3fx9jp84DIKGr516nteMEFPCfLvtlrzlZlVzibdA/gviz/tq?tqx=out:json";

  /* ================= ELEMENTOS ================= */
  const allList = document.querySelector("#carousel-all .splide__list");
  const decorList = document.querySelector("#carousel-decor .splide__list");
  const relatedList = document.querySelector("#carousel-related .splide__list");

  const carouselDecor = document.getElementById("carousel-decor");
  const searchInput = document.getElementById("searchInput");
  const searchBox = document.querySelector(".search-box");
  const hero = document.querySelector(".hero");

  const imagesEl = document.getElementById("product-images");

  let products = [];
  let currentProduct = null;

  let splideAll = null;
  let splideDecor = null;
  let splideRelated = null;
  let isSearchFocused = false;

  const normalize = (str = "") =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  /* ================= FETCH ================= */
  fetch(sheetUrl)
    .then((res) => res.text())
    .then((text) => {
      const data = JSON.parse(text.substring(47).slice(0, -2));
      const rows = data.table.rows.slice(1);

      rows.forEach((row) => {
        const [
          id,
          nome,
          categoria,
          subcategoria,
          preco,
          descricao,
          imagens,
        ] = row.c.map((cell) => cell?.v || "");

        if (!id) return;

        const product = {
          id,
          nome,
          categoria: normalize(categoria),
          subcategorias: subcategoria
            .split(",")
            .map((s) => normalize(s))
            .filter(Boolean),
          preco,
          descricao,
          imagens: imagens
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
            imagesEl.insertAdjacentHTML(
              "beforeend",
              `<li class="splide__slide">
                <img src="${url}" alt="${product.nome}">
              </li>`
            );
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

      /* ===== HOME ===== */
      if (allList) renderHome(products);

      /* ===== SPLIDE PRODUTO ===== */
      if (productId && imagesEl) {
        new Splide("#splide-product", {
          type: "loop",
          autoplay: true,
          interval: 3000,
          gap: "1rem",
          pagination: false,
        }).mount();
      }

      /* ===== RECOMENDADOS ===== */
      if (productId && currentProduct && relatedList) {
        renderRelated();
      }
    });

  /* ================= HOME ================= */
  function renderHome(list, searching = false) {
    if (!allList) return;

    allList.innerHTML = "";
    decorList && (decorList.innerHTML = "");

    list.forEach((p) => {
      const card = `
        <li class="splide__slide">
          <a href="produto.html?id=${p.id}" class="product-card">
            <img src="${p.imagens[0]}" alt="${p.nome}">
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
      relatedList.insertAdjacentHTML(
        "beforeend",
        `
        <li class="splide__slide">
          <a href="produto.html?id=${p.id}" class="product-card">
            <img src="${p.imagens[0]}" alt="${p.nome}">
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

  const blurSearchOnOutsidePress = (event) => {
    if (!searchInput || !searchBox) return;
    if (document.activeElement !== searchInput) return;
    if (searchBox.contains(event.target)) return;
    searchInput.blur();
  };

  document.addEventListener("pointerdown", blurSearchOnOutsidePress, {
    passive: true,
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

