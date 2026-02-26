document.addEventListener('DOMContentLoaded', () => {
  const runtimeConfig = window.__ADMIN_CONFIG__ || {};
  const firebaseConfig = runtimeConfig.firebase;
  const API_URL = runtimeConfig.apiUrl;

  const configErrors = [];
  if (!firebaseConfig || !firebaseConfig.apiKey) configErrors.push('firebase.apiKey');
  if (!firebaseConfig || !firebaseConfig.authDomain) configErrors.push('firebase.authDomain');
  if (!firebaseConfig || !firebaseConfig.projectId) configErrors.push('firebase.projectId');
  if (!firebaseConfig || !firebaseConfig.storageBucket) configErrors.push('firebase.storageBucket');
  if (!firebaseConfig || !firebaseConfig.messagingSenderId) configErrors.push('firebase.messagingSenderId');
  if (!firebaseConfig || !firebaseConfig.appId) configErrors.push('firebase.appId');
  if (!API_URL) configErrors.push('apiUrl');

  if (configErrors.length) {
    const message = `Configuração ausente: ${configErrors.join(', ')}. Atualize admin/config.js.`;
    console.error(message);
    const statusEl = document.getElementById('auth-status')
      || document.getElementById('global-status')
      || document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color = '#d93025';
    }
    return;
  }

  // Inicializa o Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();

  let allProducts = [];
  let allSubcategories = [];
  const editImagePickers = new Map();
  const productsCollection = db.collection('products');
  const SCROLL_ANCHOR_KEY = 'admin-scroll-anchor-id';
  const normalize = (value = '') =>
    String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  const imageEditor = createImageEditor();
  const DEFAULT_PRICE_LABEL = 'Valor sob consulta';

  const currentPage = window.location.pathname.split('/').pop().toLowerCase();
  const authStatusEl = document.getElementById('auth-status');
  const navToggle = document.querySelector('.admin-nav-toggle');
  const navMenu = document.querySelector('.admin-nav-menu');

  if (navToggle && navMenu) {
    const closeNavMenu = () => {
      navMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };

    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navMenu.querySelectorAll('a, button').forEach((actionEl) => {
      actionEl.addEventListener('click', () => {
        closeNavMenu();
      });
    });
  }

  // Protege as páginas de admin e redireciona conforme o status do usuário
  auth.onAuthStateChanged(user => {
    const isAuthPage = currentPage === 'login.html';
    if (user) {
      // Usuário está logado, redireciona se estiver na página de login
      if (isAuthPage) {
        window.location.href = 'index.html';
      } else {
        // Se não está na página de login, mostra o conteúdo da página protegida
        document.body.style.display = 'block';
        
        if (currentPage === 'index.html') {
            loadManagerData(user);
        }
        if (currentPage === 'novoitem.html') {
            loadAdminFormData(user);
        }
      }
    } else {
      // Usuário não está logado, redireciona para o login se não estiver lá
      if (!isAuthPage) {
        window.location.href = 'login.html';
      }
      // A página de login já é visível via CSS, então não é preciso fazer nada aqui.
    }
  });

  // --- Lógica da página de Login (login.html) ---
  if (currentPage === 'login.html') {
    const loginButton = document.getElementById('login-button');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordButton = document.getElementById('toggle-password');
    const passwordIcon = togglePasswordButton?.querySelector('i');

    const getFirebaseErrorMessage = (error) => {
      if (!error) return 'Ocorreu um erro desconhecido.';

      // O erro de API Key inválida vem como uma string JSON na mensagem
      if (error.message && error.message.includes("API key not valid")) {
          return 'Erro de configuração: A chave de API do Firebase é inválida. Verifique o arquivo `admin/config.js`.';
      }

      // Mapeamento de códigos de erro comuns do Firebase Auth
      switch (error.code) {
          case 'auth/invalid-email': return 'O formato do email fornecido é inválido.';
          case 'auth/user-not-found': return 'Nenhuma conta foi encontrada com este email.';
          case 'auth/wrong-password': return 'A senha está incorreta. Tente novamente.';
          case 'auth/email-already-in-use': return 'Este email já está sendo usado por outra conta.';
          case 'auth/weak-password': return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
          case 'auth/operation-not-allowed': return 'Operação não permitida. Verifique as configurações de autenticação no Firebase.';
          default:
              // Para outros erros, retorna a mensagem padrão do Firebase se existir
              return error.message || 'Ocorreu um erro durante a autenticação.';
      }
    };

    const showAuthStatus = (message, isError = false) => {
      if (authStatusEl) {
        authStatusEl.textContent = message;
        authStatusEl.style.color = isError ? '#d93025' : '#188038';
      }
    };

    const handleLogin = () => {
      const email = emailInput.value;
      const password = passwordInput.value;
      if (!email || !password) {
        showAuthStatus('Por favor, preencha email e senha.', true);
        return;
      }
      // Desabilita os botões para evitar cliques múltiplos
      loginButton.disabled = true;
      showAuthStatus('Autenticando...', false);

      auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
          // O redirecionamento é feito pelo onAuthStateChanged
        })
        .catch(error => {
          console.error("Firebase login error:", error);
          showAuthStatus(getFirebaseErrorMessage(error), true);
        })
        .finally(() => {
          // Reabilita os botões em caso de falha no login
          loginButton.disabled = false;
        });
    };

    loginButton?.addEventListener('click', handleLogin);

    passwordInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleLogin();
      }
    });

    togglePasswordButton?.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordIcon?.classList.toggle('fa-eye-slash', isPassword);
      passwordIcon?.classList.toggle('fa-eye', !isPassword);
    });

  }

  // --- Lógica de Logout (para novoitem.html e index.html) ---
  const logoutButton = document.getElementById('logout-button');
  logoutButton?.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().catch(error => {
      console.error('Erro ao fazer logout:', error);
    });
  });

  // --- Lógica da página Adicionar Item (novoitem.html) ---
  if (currentPage === 'novoitem.html') {
    const form = document.getElementById('product-form');
    if (form) {
      setupImagePicker(form);
      setupNewItemDescriptionTemplatePicker(form);
      form.addEventListener('submit', handleSaveProduct);
    }
  }

  // --- Lógica da página Gerenciar Itens (index.html) ---
  if (currentPage === 'index.html') {
    const productsContainer = document.getElementById('products');
    productsContainer?.addEventListener('click', handleProductAction);
    productsContainer?.addEventListener('change', handleProductFieldChange);

    const searchInput = document.getElementById('search');
    searchInput?.addEventListener('input', (e) => {
      const term = normalize(e.target.value);
      const filtered = allProducts.filter(p => {
        const subcatsRaw = p.subcategorias ?? p.subcategoria ?? '';
        const subcats = Array.isArray(subcatsRaw)
          ? subcatsRaw.join(' ')
          : String(subcatsRaw);
        const text = normalize(
          `${p.nome} ${p.id} ${p.categoria} ${subcats}`
        );
        return text.includes(term);
      });
      renderAllProducts(filtered);
      document.getElementById('global-status').textContent = `${filtered.length} de ${allProducts.length} itens exibidos.`;
    });
  }

  function setScrollAnchor(productId) {
    if (!productId) return;
    try {
      sessionStorage.setItem(SCROLL_ANCHOR_KEY, String(productId));
    } catch (e) {
      // ignora falhas de storage
    }
  }

  function scrollToProduct(productId, behavior = 'auto') {
    if (!productId) return;
    const card = document.querySelector(`.card-list[data-id="${productId}"]`);
    if (!card) return;
    card.scrollIntoView({ block: 'start', behavior });
  }

  function restoreScrollAnchor() {
    let productId = null;
    try {
      productId = sessionStorage.getItem(SCROLL_ANCHOR_KEY);
    } catch (e) {
      productId = null;
    }
    if (!productId) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToProduct(productId, 'auto');
      });
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setImageMarkedForDeletion(imageItem, shouldMark) {
    if (!imageItem) return;
    imageItem.classList.toggle('marked-for-deletion', Boolean(shouldMark));

    const deleteButton = imageItem.querySelector('.btn-img-delete');
    if (!deleteButton) return;

    const icon = deleteButton.querySelector('i');
    const isMarked = imageItem.classList.contains('marked-for-deletion');

    deleteButton.title = isMarked ? 'Desfazer marcação' : 'Marcar para remover';
    icon?.classList.toggle('fa-trash', !isMarked);
    icon?.classList.toggle('fa-undo', isMarked);
  }

  function createImageEditor() {
    const FRAME_CONFIG = {
      backgroundUrl: 'https://res.cloudinary.com/djvploeu9/image/upload/v1767963355/HERO_btz991.jpg',
      logoUrl: 'https://res.cloudinary.com/djvploeu9/image/upload/v1767963368/Vetor_br0uhh.png',
      outputWidth: 1024,
      outputHeight: 768
    };
    const defaults = {
      cropWidth: null,
      cropHeight: null,
      offsetX: 0,
      offsetY: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      backgroundEnabled: false,
      logoEnabled: false,
      logoSize: 15
    };

    const modal = document.createElement('div');
    modal.className = 'image-editor-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="image-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="image-editor-title">
        <div class="image-editor-header">
          <h3 id="image-editor-title">Editar imagem</h3>
          <button type="button" class="image-editor-close" data-action="cancel" aria-label="Fechar editor">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="image-editor-body">
          <div class="image-editor-canvas-wrap">
            <canvas class="image-editor-canvas" width="640" height="480"></canvas>
          </div>
          <div class="image-editor-controls">
            <label class="image-editor-toggle">
              <input type="checkbox" data-control="backgroundEnabled">
              <span>Fundo (1024x768)</span>
            </label>
            <label class="image-editor-toggle">
              <input type="checkbox" data-control="logoEnabled">
              <span>Logo (2 cantos)</span>
            </label>
            <label>
              Tamanho horizontal: <output data-output="cropWidth">-</output>
              <input type="range" data-control="cropWidth" min="1" max="100" step="1" value="100">
            </label>
            <label>
              Tamanho vertical: <output data-output="cropHeight">-</output>
              <input type="range" data-control="cropHeight" min="1" max="100" step="1" value="100">
            </label>
            <label>
              Posição horizontal: <output data-output="offsetX">0</output>
              <input type="range" data-control="offsetX" min="-100" max="100" step="1" value="0">
            </label>
            <label>
              Posição vertical: <output data-output="offsetY">0</output>
              <input type="range" data-control="offsetY" min="-100" max="100" step="1" value="0">
            </label>
            <label data-logo-only hidden>
              Tamanho da logo: <output data-output="logoSize">15%</output>
              <input type="range" data-control="logoSize" min="6" max="36" step="1" value="15">
            </label>
            <label>
              Brilho: <output data-output="brightness">0</output>
              <input type="range" data-control="brightness" min="-100" max="100" step="1" value="0">
            </label>
            <label>
              Contraste: <output data-output="contrast">0</output>
              <input type="range" data-control="contrast" min="-100" max="100" step="1" value="0">
            </label>
            <label>
              Saturação: <output data-output="saturation">0</output>
              <input type="range" data-control="saturation" min="-100" max="100" step="1" value="0">
            </label>
            <label>
              Nitidez: <output data-output="sharpness">0%</output>
              <input type="range" data-control="sharpness" min="0" max="100" step="1" value="0">
            </label>
          </div>
        </div>
        <div class="image-editor-footer">
          <button type="button" class="btn btn-ghost" data-action="reset">Resetar</button>
          <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
          <button type="button" class="btn btn-primary" data-action="apply">Aplicar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const canvas = modal.querySelector('.image-editor-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const applyButton = modal.querySelector('[data-action="apply"]');
    const controlsPanel = modal.querySelector('.image-editor-controls');
    const logoOnlyControls = Array.from(modal.querySelectorAll('[data-logo-only]'));
    const controls = {
      backgroundEnabled: modal.querySelector('[data-control="backgroundEnabled"]'),
      logoEnabled: modal.querySelector('[data-control="logoEnabled"]'),
      cropWidth: modal.querySelector('[data-control="cropWidth"]'),
      cropHeight: modal.querySelector('[data-control="cropHeight"]'),
      offsetX: modal.querySelector('[data-control="offsetX"]'),
      offsetY: modal.querySelector('[data-control="offsetY"]'),
      logoSize: modal.querySelector('[data-control="logoSize"]'),
      brightness: modal.querySelector('[data-control="brightness"]'),
      contrast: modal.querySelector('[data-control="contrast"]'),
      saturation: modal.querySelector('[data-control="saturation"]'),
      sharpness: modal.querySelector('[data-control="sharpness"]')
    };
    const outputs = {
      cropWidth: modal.querySelector('[data-output="cropWidth"]'),
      cropHeight: modal.querySelector('[data-output="cropHeight"]'),
      offsetX: modal.querySelector('[data-output="offsetX"]'),
      offsetY: modal.querySelector('[data-output="offsetY"]'),
      logoSize: modal.querySelector('[data-output="logoSize"]'),
      brightness: modal.querySelector('[data-output="brightness"]'),
      contrast: modal.querySelector('[data-output="contrast"]'),
      saturation: modal.querySelector('[data-output="saturation"]'),
      sharpness: modal.querySelector('[data-output="sharpness"]')
    };

    let sourceImage = null;
    let sourceObjectUrl = null;
    let sourceFileName = 'imagem';
    let resolvePending = null;
    let settings = { ...defaults };
    let applying = false;
    const frameAssets = {
      background: null,
      logo: null,
      backgroundPromise: null,
      logoPromise: null
    };

    const revokeSourceUrl = () => {
      if (!sourceObjectUrl) return;
      URL.revokeObjectURL(sourceObjectUrl);
      sourceObjectUrl = null;
    };

    const close = (result = null) => {
      const activeElement = document.activeElement;
      if (activeElement && modal.contains(activeElement) && typeof activeElement.blur === 'function') {
        activeElement.blur();
      }

      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-modal-open');
      if (controlsPanel) controlsPanel.scrollTop = 0;
      applying = false;
      applyButton.disabled = false;
      const resolver = resolvePending;
      resolvePending = null;
      if (resolver) resolver(result);
      revokeSourceUrl();
      sourceImage = null;
    };

    const loadExternalImage = (url) => new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar imagem externa: ${url}`));
      img.src = url;
    });

    const ensureBackgroundLoaded = async () => {
      if (frameAssets.background) return frameAssets.background;
      if (frameAssets.backgroundPromise) return frameAssets.backgroundPromise;

      frameAssets.backgroundPromise = loadExternalImage(FRAME_CONFIG.backgroundUrl)
        .then((background) => {
          frameAssets.background = background;
          frameAssets.backgroundPromise = null;
          return background;
        })
        .catch((error) => {
          frameAssets.backgroundPromise = null;
          throw error;
        });

      return frameAssets.backgroundPromise;
    };

    const ensureLogoLoaded = async () => {
      if (frameAssets.logo) return frameAssets.logo;
      if (frameAssets.logoPromise) return frameAssets.logoPromise;

      frameAssets.logoPromise = loadExternalImage(FRAME_CONFIG.logoUrl)
        .then((logo) => {
          frameAssets.logo = logo;
          frameAssets.logoPromise = null;
          return logo;
        })
        .catch((error) => {
          frameAssets.logoPromise = null;
          throw error;
        });

      return frameAssets.logoPromise;
    };

    const getSourceSize = () => {
      if (!sourceImage) return null;
      return {
        width: sourceImage.naturalWidth || sourceImage.width,
        height: sourceImage.naturalHeight || sourceImage.height
      };
    };

    const resetSettingsForCurrentImage = () => {
      const sourceSize = getSourceSize();
      settings = {
        ...defaults,
        cropWidth: sourceSize ? sourceSize.width : null,
        cropHeight: sourceSize ? sourceSize.height : null
      };
    };

    const getCropRect = () => {
      const sourceSize = getSourceSize();
      if (!sourceSize) return null;

      if (isCompositeMode()) {
        return {
          sx: 0,
          sy: 0,
          sw: clamp(Number(settings.cropWidth || FRAME_CONFIG.outputWidth), 1, FRAME_CONFIG.outputWidth),
          sh: clamp(Number(settings.cropHeight || FRAME_CONFIG.outputHeight), 1, FRAME_CONFIG.outputHeight),
          sourceWidth: FRAME_CONFIG.outputWidth,
          sourceHeight: FRAME_CONFIG.outputHeight
        };
      }

      const cropWidth = clamp(
        Number(settings.cropWidth || sourceSize.width),
        1,
        sourceSize.width
      );
      const cropHeight = clamp(
        Number(settings.cropHeight || sourceSize.height),
        1,
        sourceSize.height
      );

      const maxStartX = sourceSize.width - cropWidth;
      const maxStartY = sourceSize.height - cropHeight;
      const offsetFactorX = (settings.offsetX + 100) / 200;
      const offsetFactorY = (settings.offsetY + 100) / 200;

      return {
        sx: Math.round(maxStartX * offsetFactorX),
        sy: Math.round(maxStartY * offsetFactorY),
        sw: Math.round(cropWidth),
        sh: Math.round(cropHeight),
        sourceWidth: sourceSize.width,
        sourceHeight: sourceSize.height
      };
    };

    const getRenderSize = (width, height, maxDimension = 1920) => {
      if (width <= maxDimension && height <= maxDimension) {
        return { width, height };
      }
      if (width > height) {
        return {
          width: maxDimension,
          height: Math.round((height * maxDimension) / width)
        };
      }
      return {
        width: Math.round((width * maxDimension) / height),
        height: maxDimension
      };
    };

    const isCompositeMode = () => Boolean(settings.backgroundEnabled || settings.logoEnabled);

    const updateControlVisibility = () => {
      logoOnlyControls.forEach((el) => {
        el.hidden = !settings.logoEnabled;
      });
    };

    const updateOutputs = () => {
      const cropRect = getCropRect();
      const maxOutputWidth = isCompositeMode()
        ? FRAME_CONFIG.outputWidth
        : (cropRect ? cropRect.sourceWidth : 0);
      const maxOutputHeight = isCompositeMode()
        ? FRAME_CONFIG.outputHeight
        : (cropRect ? cropRect.sourceHeight : 0);
      if (cropRect) {
        outputs.cropWidth.textContent = `${cropRect.sw}px / ${maxOutputWidth}px`;
        outputs.cropHeight.textContent = `${cropRect.sh}px / ${maxOutputHeight}px`;
      } else {
        outputs.cropWidth.textContent = '-';
        outputs.cropHeight.textContent = '-';
      }
      outputs.offsetX.textContent = String(settings.offsetX);
      outputs.offsetY.textContent = String(settings.offsetY);
      outputs.logoSize.textContent = `${settings.logoSize}%`;
      outputs.brightness.textContent = String(settings.brightness);
      outputs.contrast.textContent = String(settings.contrast);
      outputs.saturation.textContent = String(settings.saturation);
      outputs.sharpness.textContent = `${settings.sharpness}%`;
    };

    const syncControlsFromSettings = () => {
      const sourceSize = getSourceSize();
      const composite = isCompositeMode();
      const maxCropWidth = composite
        ? FRAME_CONFIG.outputWidth
        : (sourceSize ? sourceSize.width : 100);
      const maxCropHeight = composite
        ? FRAME_CONFIG.outputHeight
        : (sourceSize ? sourceSize.height : 100);

      controls.cropWidth.min = '1';
      controls.cropWidth.max = String(maxCropWidth);
      controls.cropHeight.min = '1';
      controls.cropHeight.max = String(maxCropHeight);

      settings.cropWidth = clamp(Number(settings.cropWidth || maxCropWidth), 1, maxCropWidth);
      settings.cropHeight = clamp(Number(settings.cropHeight || maxCropHeight), 1, maxCropHeight);
      settings.logoSize = clamp(Number(settings.logoSize || 15), 6, 36);

      controls.backgroundEnabled.checked = Boolean(settings.backgroundEnabled);
      controls.logoEnabled.checked = Boolean(settings.logoEnabled);
      controls.cropWidth.value = String(settings.cropWidth);
      controls.cropHeight.value = String(settings.cropHeight);
      controls.offsetX.value = String(settings.offsetX);
      controls.offsetY.value = String(settings.offsetY);
      controls.logoSize.value = String(settings.logoSize);
      controls.brightness.value = String(settings.brightness);
      controls.contrast.value = String(settings.contrast);
      controls.saturation.value = String(settings.saturation);
      controls.sharpness.value = String(settings.sharpness);
      updateControlVisibility();
      updateOutputs();
    };

    const syncSettingsFromControls = () => {
      const sourceSize = getSourceSize();
      settings.backgroundEnabled = Boolean(controls.backgroundEnabled.checked);
      settings.logoEnabled = Boolean(controls.logoEnabled.checked);
      const composite = isCompositeMode();
      const maxCropWidth = composite
        ? FRAME_CONFIG.outputWidth
        : (sourceSize ? sourceSize.width : 100);
      const maxCropHeight = composite
        ? FRAME_CONFIG.outputHeight
        : (sourceSize ? sourceSize.height : 100);

      settings.cropWidth = clamp(Number(controls.cropWidth.value), 1, maxCropWidth);
      settings.cropHeight = clamp(Number(controls.cropHeight.value), 1, maxCropHeight);
      settings.offsetX = clamp(Number(controls.offsetX.value), -100, 100);
      settings.offsetY = clamp(Number(controls.offsetY.value), -100, 100);
      settings.logoSize = clamp(Number(controls.logoSize.value), 6, 36);
      settings.brightness = clamp(Number(controls.brightness.value), -100, 100);
      settings.contrast = clamp(Number(controls.contrast.value), -100, 100);
      settings.saturation = clamp(Number(controls.saturation.value), -100, 100);
      settings.sharpness = clamp(Number(controls.sharpness.value), 0, 100);
      updateControlVisibility();
      updateOutputs();
    };

    const drawCroppedImage = (targetCtx, img, destX, destY, destWidth, destHeight) => {
      const cropRect = getCropRect();
      if (!cropRect) return;

      targetCtx.drawImage(
        img,
        cropRect.sx,
        cropRect.sy,
        cropRect.sw,
        cropRect.sh,
        destX,
        destY,
        destWidth,
        destHeight
      );
    };

    const applySharpen = (targetCtx, width, height) => {
      if (settings.sharpness <= 0) return;

      const strength = settings.sharpness / 100;
      const imageData = targetCtx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const source = new Uint8ClampedArray(data);
      const rowStride = width * 4;

      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = (y * width + x) * 4;
          for (let channel = 0; channel < 3; channel += 1) {
            const center = source[index + channel] * 5;
            const up = source[index - rowStride + channel];
            const down = source[index + rowStride + channel];
            const left = source[index - 4 + channel];
            const right = source[index + 4 + channel];
            const sharpened = center - up - down - left - right;
            const blended = source[index + channel] + (sharpened - source[index + channel]) * strength;
            data[index + channel] = clamp(Math.round(blended), 0, 255);
          }
        }
      }

      targetCtx.putImageData(imageData, 0, 0);
    };

    const drawProcessedPhotoLayer = (targetCtx, destX, destY, destWidth, destHeight) => {
      const layerWidth = Math.max(1, Math.round(destWidth));
      const layerHeight = Math.max(1, Math.round(destHeight));
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = layerWidth;
      layerCanvas.height = layerHeight;
      const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true });

      layerCtx.clearRect(0, 0, layerWidth, layerHeight);
      layerCtx.imageSmoothingEnabled = true;
      layerCtx.imageSmoothingQuality = 'high';
      layerCtx.filter = `brightness(${100 + settings.brightness}%) contrast(${100 + settings.contrast}%) saturate(${100 + settings.saturation}%)`;

      if (isCompositeMode()) {
        const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
        const sourceHeight = sourceImage.naturalHeight || sourceImage.height;
        const coverScale = Math.max(layerWidth / sourceWidth, layerHeight / sourceHeight);
        const scale = Math.max(0.01, coverScale);
        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;
        const overflowX = Math.max(0, drawWidth - layerWidth);
        const overflowY = Math.max(0, drawHeight - layerHeight);
        const offsetFactorX = (settings.offsetX + 100) / 200;
        const offsetFactorY = (settings.offsetY + 100) / 200;
        const drawX = -(overflowX * offsetFactorX);
        const drawY = -(overflowY * offsetFactorY);

        layerCtx.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight);
      } else {
        drawCroppedImage(layerCtx, sourceImage, 0, 0, layerWidth, layerHeight);
      }

      layerCtx.filter = 'none';
      applySharpen(layerCtx, layerWidth, layerHeight);

      targetCtx.drawImage(layerCanvas, destX, destY, destWidth, destHeight);
    };

    const drawImageCover = (targetCtx, img, width, height) => {
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      const coverScale = Math.max(width / sourceWidth, height / sourceHeight);
      const drawWidth = sourceWidth * coverScale;
      const drawHeight = sourceHeight * coverScale;
      const drawX = (width - drawWidth) / 2;
      const drawY = (height - drawHeight) / 2;
      targetCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    };

    const getCompositePhotoArea = (width, height) => {
      const normalizedWidth = clamp(
        Number(settings.cropWidth || FRAME_CONFIG.outputWidth),
        1,
        FRAME_CONFIG.outputWidth
      ) / FRAME_CONFIG.outputWidth;
      const normalizedHeight = clamp(
        Number(settings.cropHeight || FRAME_CONFIG.outputHeight),
        1,
        FRAME_CONFIG.outputHeight
      ) / FRAME_CONFIG.outputHeight;
      const areaWidth = Math.max(1, Math.round(width * normalizedWidth));
      const areaHeight = Math.max(1, Math.round(height * normalizedHeight));
      return {
        x: Math.round((width - areaWidth) / 2),
        y: Math.round((height - areaHeight) / 2),
        width: areaWidth,
        height: areaHeight
      };
    };

    const drawFrameLogos = (targetCtx, width, height) => {
      const logo = frameAssets.logo;
      if (!logo) return;

      const logoAspect = (logo.naturalHeight || logo.height) / (logo.naturalWidth || logo.width || 1);
      const margin = Math.max(8, Math.round(width * 0.02));
      let logoWidth = Math.round((width * settings.logoSize) / 100);
      let logoHeight = Math.round(logoWidth * logoAspect);
      const maxLogoWidth = Math.max(1, width - (margin * 2));
      const maxLogoHeight = Math.max(1, Math.floor((height - (margin * 2)) / 2));

      if (logoWidth > maxLogoWidth) {
        logoWidth = maxLogoWidth;
        logoHeight = Math.round(logoWidth * logoAspect);
      }
      if (logoHeight > maxLogoHeight) {
        logoHeight = maxLogoHeight;
        logoWidth = Math.round(logoHeight / logoAspect);
      }

      targetCtx.drawImage(logo, margin, margin, logoWidth, logoHeight);
      targetCtx.drawImage(
        logo,
        width - margin - logoWidth,
        height - margin - logoHeight,
        logoWidth,
        logoHeight
      );
    };

    const renderCanvas = (targetCanvas, targetCtx, width, height) => {
      if (!sourceImage) return;

      targetCanvas.width = width;
      targetCanvas.height = height;
      targetCtx.clearRect(0, 0, width, height);
      targetCtx.imageSmoothingEnabled = true;
      targetCtx.imageSmoothingQuality = 'high';

      if (isCompositeMode()) {
        if (settings.backgroundEnabled && frameAssets.background) {
          drawImageCover(targetCtx, frameAssets.background, width, height);
        } else if (settings.backgroundEnabled) {
          targetCtx.fillStyle = '#0f172a';
          targetCtx.fillRect(0, 0, width, height);
        }

        const framePhotoArea = getCompositePhotoArea(width, height);
        drawProcessedPhotoLayer(
          targetCtx,
          framePhotoArea.x,
          framePhotoArea.y,
          framePhotoArea.width,
          framePhotoArea.height
        );
        if (settings.logoEnabled) {
          drawFrameLogos(targetCtx, width, height);
        }
      } else {
        drawProcessedPhotoLayer(targetCtx, 0, 0, width, height);
      }
    };

    const renderPreview = () => {
      if (!sourceImage) return;

      if (isCompositeMode()) {
        const previewBounds = getRenderSize(
          FRAME_CONFIG.outputWidth,
          FRAME_CONFIG.outputHeight,
          760
        );
        renderCanvas(canvas, ctx, previewBounds.width, previewBounds.height);
        return;
      }

      const cropRect = getCropRect();
      if (!cropRect) return;
      const previewBounds = getRenderSize(cropRect.sw, cropRect.sh, 760);
      renderCanvas(canvas, ctx, previewBounds.width, previewBounds.height);
    };

    const loadImageFromFile = (file) => new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        resolve({ img, objectUrl });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Não foi possível abrir esta imagem.'));
      };
      img.src = objectUrl;
    });

    const canvasToBlob = (targetCanvas, mimeType, quality = 0.92) => new Promise((resolve, reject) => {
      targetCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Falha ao gerar imagem editada.'));
          return;
        }
        resolve(blob);
      }, mimeType, quality);
    });

    const compressCanvasToWebP150k = async (targetCanvas) => {
      const maxBytes = 150 * 1024;
      let quality = 0.92;
      let blob = await canvasToBlob(targetCanvas, 'image/webp', quality);
      while (blob.size > maxBytes && quality > 0.05) {
        quality -= 0.06;
        blob = await canvasToBlob(targetCanvas, 'image/webp', quality);
      }
      while (blob.size > maxBytes && quality > 0.01) {
        quality -= 0.01;
        blob = await canvasToBlob(targetCanvas, 'image/webp', quality);
      }
      if (blob.size > maxBytes) {
        throw new Error('Não foi possível reduzir a imagem para 150KB em WebP.');
      }
      return blob;
    };

    const buildEditedFile = async (targetCanvas) => {
      const blob = await compressCanvasToWebP150k(targetCanvas);
      return {
        blob,
        mimeType: 'image/webp',
        extension: 'webp'
      };
    };

    controls.cropWidth?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.cropHeight?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.offsetX?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.offsetY?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.logoSize?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.brightness?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.contrast?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.saturation?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.sharpness?.addEventListener('input', () => {
      syncSettingsFromControls();
      renderPreview();
    });
    controls.backgroundEnabled?.addEventListener('change', async () => {
      syncSettingsFromControls();
      if (settings.backgroundEnabled) {
        try {
          await ensureBackgroundLoaded();
        } catch (error) {
          console.error('Erro ao carregar moldura/logo:', error);
          alert('Não foi possível carregar a imagem de fundo.');
          settings.backgroundEnabled = false;
          syncControlsFromSettings();
        }
      }
      renderPreview();
    });
    controls.logoEnabled?.addEventListener('change', async () => {
      syncSettingsFromControls();
      if (settings.logoEnabled) {
        try {
          await ensureLogoLoaded();
        } catch (error) {
          console.error('Erro ao carregar logo:', error);
          alert('Não foi possível carregar a logo.');
          settings.logoEnabled = false;
          syncControlsFromSettings();
        }
      }
      renderPreview();
    });

    modal.addEventListener('click', async (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === 'cancel') {
          close(null);
          return;
        }
        if (action === 'reset') {
          resetSettingsForCurrentImage();
          syncControlsFromSettings();
          renderPreview();
          return;
        }
        if (action === 'apply') {
          if (!sourceImage || applying) return;
          applying = true;
          applyButton.disabled = true;

          try {
            const cropRect = getCropRect();
            if (!cropRect) {
              throw new Error('Não foi possível calcular o recorte da imagem.');
            }

            if (settings.backgroundEnabled) {
              await ensureBackgroundLoaded();
            }
            if (settings.logoEnabled) {
              await ensureLogoLoaded();
            }

            const outputBounds = isCompositeMode()
              ? {
                width: FRAME_CONFIG.outputWidth,
                height: FRAME_CONFIG.outputHeight
              }
              : getRenderSize(cropRect.sw, cropRect.sh, 1920);

            const outputCanvas = document.createElement('canvas');
            const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
            renderCanvas(outputCanvas, outputCtx, outputBounds.width, outputBounds.height);

            const editedResult = await buildEditedFile(outputCanvas);
            const cleanName = sourceFileName.replace(/\.[^/.]+$/, '') || 'imagem';
            const editedFile = new File(
              [editedResult.blob],
              `${cleanName}-editada.${editedResult.extension}`,
              { type: editedResult.mimeType, lastModified: Date.now() }
            );

            close(editedFile);
          } catch (error) {
            console.error('Erro ao aplicar edição:', error);
            alert(`Erro ao aplicar edição: ${error.message}`);
            applying = false;
            applyButton.disabled = false;
          }
        }
        return;
      }

      if (event.target === modal) {
        close(null);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        close(null);
      }
    });

    return {
      async open(file, options = {}) {
        if (!file || !String(file.type || '').startsWith('image/')) return null;
        if (resolvePending) {
          resolvePending(null);
          resolvePending = null;
        }

        revokeSourceUrl();
        const loaded = await loadImageFromFile(file);
        sourceImage = loaded.img;
        sourceObjectUrl = loaded.objectUrl;
        sourceFileName = options.fileName || file.name || 'imagem';
        resetSettingsForCurrentImage();
        syncControlsFromSettings();
        renderPreview();
        if (controlsPanel) controlsPanel.scrollTop = 0;

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('is-modal-open');
        applyButton.disabled = false;
        applying = false;

        if (controlsPanel) {
          controlsPanel.scrollTop = 0;
          controlsPanel.scrollTo({ top: 0, behavior: 'auto' });
        }
        requestAnimationFrame(() => {
          if (controlsPanel) controlsPanel.scrollTop = 0;
          requestAnimationFrame(() => {
            if (controlsPanel) controlsPanel.scrollTop = 0;
          });
        });
        controls.cropWidth?.focus({ preventScroll: true });

        return new Promise((resolve) => {
          resolvePending = resolve;
        });
      }
    };
  }

  async function urlToImageFile(url, fallbackBaseName = 'imagem') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao carregar imagem (${response.status}).`);
    }
    const blob = await response.blob();

    let baseName = fallbackBaseName;
    try {
      const parsedUrl = new URL(url);
      const fileSegment = parsedUrl.pathname.split('/').pop() || '';
      const withoutExt = fileSegment.replace(/\.[^/.]+$/, '');
      if (withoutExt) baseName = withoutExt;
    } catch (error) {
      // usa fallback
    }

    const safeBase = String(baseName).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || fallbackBaseName;
    const extension = blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/jpeg'
        ? 'jpg'
        : 'webp';

    return new File(
      [blob],
      `${safeBase}.${extension}`,
      { type: blob.type || 'image/webp', lastModified: Date.now() }
    );
  }

  async function handleExistingImageEdit(editButton) {
    const imageItem = editButton.closest('.image-item');
    const img = imageItem?.querySelector('img');
    if (!imageItem || !img?.src) return;

    const card = editButton.closest('.card-list');
    const productId = card?.dataset.id;
    const picker = editImagePickers.get(String(productId || ''));
    const statusEl = card?.querySelector('.card-status');
    const previousStatus = statusEl?.textContent || '';

    if (!picker) return;

    editButton.disabled = true;
    if (statusEl) statusEl.textContent = 'Abrindo editor de imagem...';

    try {
      const baseName = `produto-${productId || 'item'}-imagem`;
      const sourceFile = await urlToImageFile(img.src, baseName);
      const editedFile = await imageEditor.open(sourceFile);
      if (!editedFile) {
        if (statusEl) statusEl.textContent = previousStatus;
        return;
      }

      picker.addFiles([editedFile]);
      setImageMarkedForDeletion(imageItem, true);
      if (statusEl) statusEl.textContent = 'Imagem editada adicionada como nova imagem.';
    } catch (error) {
      console.error('Erro ao editar imagem existente:', error);
      if (statusEl) statusEl.textContent = `Erro ao editar imagem: ${error.message}`;
    } finally {
      editButton.disabled = false;
    }
  }

  function handleProductAction(event) {
    const editButton = event.target.closest('.btn-edit');
    if (editButton) {
      event.preventDefault();
      const card = editButton.closest('.card-list');
      setScrollAnchor(card?.dataset.id);
      toggleEditMode(card.dataset.id);
    }

    const cancelButton = event.target.closest('.btn-cancel-edit');
    if (cancelButton) {
      event.preventDefault();
      setScrollAnchor(cancelButton.dataset.id);
      toggleEditMode(cancelButton.dataset.id);
      scrollToProduct(cancelButton.dataset.id, 'auto');
    }

    const saveButton = event.target.closest('.btn-save-changes');
    if (saveButton) {
      event.preventDefault();
      setScrollAnchor(saveButton.dataset.id);
      handleUpdateProduct(saveButton.dataset.id);
    }

    const deleteButton = event.target.closest('.btn-delete-product');
    if (deleteButton) {
      event.preventDefault();
      handleDeleteProduct(deleteButton.dataset.id);
    }

    const imgEditBtn = event.target.closest('.btn-img-edit');
    if (imgEditBtn) {
      event.preventDefault();
      handleExistingImageEdit(imgEditBtn);
      return;
    }

    const imgDeleteBtn = event.target.closest('.btn-img-delete');
    if (imgDeleteBtn) {
      event.preventDefault();
      const imageItem = imgDeleteBtn.closest('.image-item');
      const img = imageItem.querySelector('img');

      // Se a imagem não tiver 'src', é um preview de um arquivo novo. Apenas remove o elemento.
      if (!img || !img.src) {
        imageItem.remove();
        return;
      }

      const isMarked = imageItem.classList.contains('marked-for-deletion');
      setImageMarkedForDeletion(imageItem, !isMarked);
    }

    const imgLeftBtn = event.target.closest('.btn-img-left');
    if (imgLeftBtn) {
      const imageItem = imgLeftBtn.closest('.image-item');
      if (imageItem.previousElementSibling) {
        imageItem.parentElement.insertBefore(imageItem, imageItem.previousElementSibling);
      }
    }

    const imgRightBtn = event.target.closest('.btn-img-right');
    if (imgRightBtn) {
      const imageItem = imgRightBtn.closest('.image-item');
      if (imageItem.nextElementSibling) {
        imageItem.parentElement.insertBefore(imageItem.nextElementSibling, imageItem);
      }
    }
  }

  function toggleEditMode(productId) {
    const card = document.querySelector(`.card-list[data-id="${productId}"]`);
    if (!card) return;

    const isActive = card.classList.contains('is-editing');

    document.querySelectorAll('.card-list.is-editing').forEach(openCard => {
      if (openCard !== card) {
        openCard.classList.remove('is-editing');
        destroyEditImagePicker(openCard.dataset.id);
        renderProductCard(openCard.dataset.id);
      }
    });

    if (isActive) {
      card.classList.remove('is-editing');
      destroyEditImagePicker(productId);
      renderProductCard(productId);
    } else {
      const product = allProducts.find(p => String(p.id) === String(productId));
      if (product) {
        card.classList.add('is-editing');
        renderEditPanel(product);
      }
    }
  }

  function parseSubcategoriesValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizePriceValue(value) {
    const text = String(value || '').trim();
    return text || DEFAULT_PRICE_LABEL;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getDescriptionTemplates(products, excludedProductId = '') {
    const excluded = String(excludedProductId || '').trim();
    const unique = new Set();
    (products || []).forEach((product) => {
      if (excluded && String(product?.id || '') === excluded) return;
      const description = String(product?.descricao || '').trim();
      if (!description) return;
      unique.add(description);
    });
    return Array.from(unique);
  }

  function buildDescriptionTemplateOptionsHtml(products, excludedProductId = '') {
    const templates = getDescriptionTemplates(products, excludedProductId);
    if (!templates.length) {
      return '<option value="">Nenhuma descrição disponível</option>';
    }

    const baseOption = '<option value="">Selecione uma descrição existente</option>';
    const options = templates.map((description) => {
      const encoded = encodeURIComponent(description);
      const compact = description.replace(/\s+/g, ' ').trim();
      const label = compact.length > 100 ? `${compact.slice(0, 97)}...` : compact;
      return `<option value="${encoded}">${escapeHtml(label)}</option>`;
    });

    return [baseOption, ...options].join('');
  }

  function applyDescriptionTemplate(targetTextarea, encodedTemplate) {
    if (!targetTextarea || !encodedTemplate) return;
    let template = '';
    try {
      template = decodeURIComponent(encodedTemplate);
    } catch (error) {
      template = '';
    }
    template = String(template || '').trim();
    if (!template) return;

    const currentValue = String(targetTextarea.value || '').trim();
    targetTextarea.value = currentValue ? `${currentValue}\n\n${template}` : template;
    targetTextarea.focus();
  }

  function refreshNewItemDescriptionTemplates() {
    if (currentPage !== 'novoitem.html') return;
    const select = document.getElementById('descricao-template-select');
    if (!select) return;
    select.innerHTML = buildDescriptionTemplateOptionsHtml(allProducts);
  }

  function setupNewItemDescriptionTemplatePicker(form) {
    const textarea = form.querySelector('#descricao');
    const select = form.querySelector('#descricao-template-select');
    if (!textarea || !select) return;

    const applySelectedTemplate = () => {
      const encodedTemplate = String(select.value || '').trim();
      if (!encodedTemplate) return;
      applyDescriptionTemplate(textarea, encodedTemplate);
      select.value = '';
    };

    select.addEventListener('change', applySelectedTemplate);
  }

  function handleProductFieldChange(event) {
    const select = event.target.closest('.edit-desc-template-select');
    if (!select) return;
    const card = select.closest('.card-list');
    const textarea = card?.querySelector('.edit-descricao');
    if (!textarea) return;

    const encodedTemplate = String(select.value || '').trim();
    if (!encodedTemplate) return;
    applyDescriptionTemplate(textarea, encodedTemplate);
    select.value = '';
  }

  function collectSubcategories(products) {
    const unique = new Set();
    (products || []).forEach((product) => {
      parseSubcategoriesValue(product?.subcategorias).forEach((sub) => unique.add(sub));
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function toAdminProduct(raw = {}, fallbackId = '') {
    const id = String(raw.id ?? fallbackId ?? '').trim();
    return {
      id,
      nome: String(raw.nome || '').trim(),
      categoria: String(raw.categoria || '').trim(),
      subcategorias: parseSubcategoriesValue(raw.subcategorias),
      preco: String(raw.preco || '').trim(),
      descricao: String(raw.descricao || '').trim(),
      imagens: Array.isArray(raw.imagens)
        ? raw.imagens.map((img) => String(img).trim()).filter(Boolean)
        : String(raw.imagens || '')
            .split(',')
            .map((img) => img.trim())
            .filter(Boolean),
    };
  }

  function toFirestoreProductDoc(product) {
    return {
      id: String(product.id || '').trim(),
      nome: String(product.nome || '').trim(),
      categoria: String(product.categoria || '').trim(),
      subcategorias: parseSubcategoriesValue(product.subcategorias),
      preco: String(product.preco || '').trim(),
      descricao: String(product.descricao || '').trim(),
      imagens: Array.isArray(product.imagens)
        ? product.imagens.map((img) => String(img).trim()).filter(Boolean)
        : [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  function sortProductsByIdDesc(products) {
    const parseNumericId = (value) => {
      const text = String(value || '').trim();
      if (!text) return Number.NEGATIVE_INFINITY;
      const parsed = Number.parseInt(text, 10);
      return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
    };

    return [...(products || [])].sort((left, right) => {
      const leftNum = parseNumericId(left?.id);
      const rightNum = parseNumericId(right?.id);
      if (leftNum !== rightNum) return rightNum - leftNum;
      return String(right?.id || '').localeCompare(String(left?.id || ''), 'pt-BR');
    });
  }

  async function getNextProductId() {
    const snapshot = await productsCollection.get();
    let maxId = 0;
    snapshot.forEach((doc) => {
      const docId = String(doc.data()?.id || doc.id || '').trim();
      const parsed = Number.parseInt(docId, 10);
      if (Number.isFinite(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    });
    return String(maxId + 1);
  }

  function loadAdminFormData(user) {
    if (allSubcategories.length > 0) {
      populateSubcategories(allSubcategories);
      refreshNewItemDescriptionTemplates();
      return;
    }

    productsCollection
      .get()
      .then((snapshot) => {
        const products = snapshot.docs.map((doc) =>
          toAdminProduct(doc.data(), doc.id)
        );
        allProducts = sortProductsByIdDesc(products);
        allSubcategories = collectSubcategories(products);
        populateSubcategories(allSubcategories);
        refreshNewItemDescriptionTemplates();
      })
      .catch((err) => console.error('Erro ao carregar categorias:', err));
  }

  function createImagePicker({
    imageInput,
    dropzone,
    previewList,
    hintEl,
    emptyHint,
    singleHint,
    multiHint,
    pasteTarget = null,
    requiredWhenEmpty = false,
    editor = null
  }) {
    if (!imageInput || !dropzone || !previewList || !hintEl) return null;

    let selectedFiles = [];
    let dragDepth = 0;
    const previewUrls = [];

    const clearPreviewUrls = () => {
      while (previewUrls.length > 0) {
        const url = previewUrls.pop();
        URL.revokeObjectURL(url);
      }
    };

    const isImage = (file) => file && String(file.type || '').startsWith('image/');
    const isSameFile = (left, right) => (
      left.name === right.name
      && left.size === right.size
      && left.lastModified === right.lastModified
    );

    const updateHint = () => {
      if (selectedFiles.length === 0) {
        hintEl.textContent = emptyHint;
      } else if (selectedFiles.length === 1) {
        hintEl.textContent = singleHint;
      } else {
        hintEl.textContent = multiHint.replace('{count}', String(selectedFiles.length));
      }
    };

    const syncInputFiles = () => {
      const dataTransfer = new DataTransfer();
      selectedFiles.forEach(file => dataTransfer.items.add(file));
      imageInput.files = dataTransfer.files;
      if (requiredWhenEmpty) {
        imageInput.required = selectedFiles.length === 0;
      }
    };

    const renderPreview = () => {
      clearPreviewUrls();
      if (selectedFiles.length === 0) {
        previewList.innerHTML = '';
        return;
      }

      previewList.innerHTML = selectedFiles.map((file, index) => {
        const url = URL.createObjectURL(file);
        previewUrls.push(url);
        const safeName = file.name.replace(/"/g, '&quot;');

        return `
          <div class="preview-image-item">
            <img src="${url}" alt="${safeName}">
            <button type="button" class="preview-image-edit" data-index="${index}" aria-label="Editar imagem ${safeName}">
              <i class="fa-solid fa-pen" aria-hidden="true"></i>
            </button>
            <button type="button" class="preview-image-remove" data-index="${index}" aria-label="Remover imagem ${safeName}">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        `;
      }).join('');
    };

    const addFiles = (files) => {
      const imageFiles = Array.from(files || []).filter(isImage);
      if (imageFiles.length === 0) return;

      imageFiles.forEach(file => {
        const alreadyAdded = selectedFiles.some(existing => isSameFile(existing, file));
        if (!alreadyAdded) selectedFiles.push(file);
      });

      syncInputFiles();
      renderPreview();
      updateHint();
    };

    const getClipboardImages = (event) => {
      const items = Array.from(event.clipboardData?.items || []);
      return items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean);
    };

    const openFileDialog = () => {
      imageInput.value = '';
      imageInput.click();
    };

    const handleDropzoneClick = () => {
      openFileDialog();
    };

    const handleDropzoneKeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFileDialog();
      }
    };

    const handleInputChange = () => {
      addFiles(imageInput.files);
    };

    const handleDragEnter = (event) => {
      event.preventDefault();
      dragDepth += 1;
      dropzone.classList.add('is-dragover');
    };

    const handleDragOver = (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragover');
    };

    const handleDragLeave = (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) dropzone.classList.remove('is-dragover');
    };

    const handleDrop = (event) => {
      event.preventDefault();
      dragDepth = 0;
      dropzone.classList.remove('is-dragover');
      addFiles(event.dataTransfer?.files);
    };

    const handlePaste = (event) => {
      const clipboardImages = getClipboardImages(event);
      if (clipboardImages.length === 0) return;
      event.preventDefault();
      addFiles(clipboardImages);
    };

    const handlePreviewClick = async (event) => {
      const editButton = event.target.closest('.preview-image-edit');
      if (editButton) {
        event.preventDefault();
        const index = Number(editButton.dataset.index);
        if (
          Number.isNaN(index)
          || index < 0
          || index >= selectedFiles.length
          || !editor
        ) return;

        editButton.disabled = true;
        try {
          const currentFile = selectedFiles[index];
          const editedFile = await editor.open(currentFile);
          if (editedFile) {
            selectedFiles[index] = editedFile;
            syncInputFiles();
            renderPreview();
            updateHint();
          }
        } catch (error) {
          console.error('Erro ao editar imagem:', error);
          alert(`Erro ao editar imagem: ${error.message}`);
        } finally {
          editButton.disabled = false;
        }
        return;
      }

      const removeButton = event.target.closest('.preview-image-remove');
      if (!removeButton) return;

      const index = Number(removeButton.dataset.index);
      if (Number.isNaN(index) || index < 0 || index >= selectedFiles.length) return;

      selectedFiles.splice(index, 1);
      syncInputFiles();
      renderPreview();
      updateHint();
    };

    dropzone.addEventListener('click', handleDropzoneClick);
    dropzone.addEventListener('keydown', handleDropzoneKeydown);
    imageInput.addEventListener('change', handleInputChange);
    dropzone.addEventListener('dragenter', handleDragEnter);
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);
    previewList.addEventListener('click', handlePreviewClick);
    if (pasteTarget) {
      pasteTarget.addEventListener('paste', handlePaste);
    }

    updateHint();

    return {
      getFiles: () => selectedFiles.slice(),
      addFiles: (files) => {
        addFiles(files);
      },
      clear: () => {
        selectedFiles = [];
        syncInputFiles();
        renderPreview();
        updateHint();
      },
      destroy: () => {
        dropzone.removeEventListener('click', handleDropzoneClick);
        dropzone.removeEventListener('keydown', handleDropzoneKeydown);
        imageInput.removeEventListener('change', handleInputChange);
        dropzone.removeEventListener('dragenter', handleDragEnter);
        dropzone.removeEventListener('dragover', handleDragOver);
        dropzone.removeEventListener('dragleave', handleDragLeave);
        dropzone.removeEventListener('drop', handleDrop);
        previewList.removeEventListener('click', handlePreviewClick);
        if (pasteTarget) {
          pasteTarget.removeEventListener('paste', handlePaste);
        }
        clearPreviewUrls();
      }
    };
  }

  function setupImagePicker(form) {
    const picker = createImagePicker({
      imageInput: form.querySelector('#imagens'),
      dropzone: form.querySelector('#image-dropzone'),
      previewList: form.querySelector('#image-preview-list'),
      hintEl: form.querySelector('#image-picker-hint'),
      emptyHint: 'Nenhuma imagem selecionada.',
      singleHint: '1 imagem pronta para upload.',
      multiHint: '{count} imagens prontas para upload.',
      pasteTarget: document,
      requiredWhenEmpty: true,
      editor: imageEditor
    });

    if (!picker) return;

    form.addEventListener('reset', () => {
      setTimeout(() => {
        picker.clear();
      }, 0);
    });
  }

  function setupEditImagePicker(productId) {
    const productKey = String(productId);
    destroyEditImagePicker(productKey);

    const card = document.querySelector(`.card-list[data-id="${productKey}"]`);
    if (!card) return;

    const picker = createImagePicker({
      imageInput: card.querySelector('.edit-new-images'),
      dropzone: card.querySelector('.edit-image-dropzone'),
      previewList: card.querySelector('.edit-image-preview'),
      hintEl: card.querySelector('.edit-image-picker-hint'),
      emptyHint: 'Nenhuma nova imagem selecionada.',
      singleHint: '1 nova imagem pronta para upload.',
      multiHint: '{count} novas imagens prontas para upload.',
      pasteTarget: document,
      editor: imageEditor
    });

    if (picker) {
      editImagePickers.set(productKey, picker);
    }
  }

  function destroyEditImagePicker(productId) {
    const productKey = String(productId);
    const picker = editImagePickers.get(productKey);
    if (!picker) return;

    picker.destroy();
    editImagePickers.delete(productKey);
  }

  function populateSubcategories(subcategories, selected = []) {
    const container = document.getElementById('subcategorias-container');
    if (!container) return;
    
    container.innerHTML = subcategories.map(sub => {
      const isChecked = selected.includes(sub) ? 'checked' : '';
      return `
        <label class="chip-item">
          <input type="checkbox" name="subcategoria" value="${sub}" ${isChecked}>
          <span>${sub}</span>
        </label>
      `;
    }).join('');
  }

  async function handleSaveProduct(event) {
    event.preventDefault();
    const form = event.target;
    const statusEl = document.getElementById('status');
    const submitButton = form.querySelector('button[type="submit"]');
    const nome = form.querySelector('#nome').value.trim();
    const preco = normalizePriceValue(form.querySelector('#preco').value.trim());

    if (!nome) {
      statusEl.textContent = 'O nome do item é obrigatório.';
      statusEl.style.color = '#ef4444';
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    statusEl.textContent = 'Iniciando...';
    statusEl.style.color = 'var(--muted)';

    try {
      // 1. Obtém o próximo ID no Firestore para manter URLs estáveis.
      statusEl.textContent = 'Obtendo ID do produto...';
      const newId = await getNextProductId();

      // 2. Faz o upload das imagens com o nome da pasta correto
      const imageFiles = form.querySelector('#imagens').files;
      let imageUrls = [];
      if (imageFiles.length > 0) {
        statusEl.textContent = 'Fazendo upload das imagens...';
        const folderName = `${newId} - ${nome}`.replace(/[^a-zA-Z0-9À-ÿ -]/g, '');
        imageUrls = await uploadImages(imageFiles, folderName);
      }

      // 3. Salva os dados no Firestore, incluindo o ID pré-definido.
      statusEl.textContent = 'Salvando dados no Firestore...';
      const payload = {
        id: newId, // Envia o ID obtido para o backend
        nome: nome,
        categoria: form.querySelector('#categoria').value,
        subcategorias: Array.from(form.querySelectorAll('input[name="subcategoria"]:checked')).map(cb => cb.value),
        preco: preco,
        descricao: form.querySelector('#descricao').value,
        imagens: imageUrls,
      };

      await productsCollection.doc(String(newId)).set(toFirestoreProductDoc(payload), { merge: true });

      statusEl.textContent = `Produto "${nome}" salvo com sucesso!`;
      statusEl.style.color = 'var(--primary)';
      form.reset();
      const priceField = form.querySelector('#preco');
      if (priceField) priceField.value = DEFAULT_PRICE_LABEL;
      allProducts = sortProductsByIdDesc([toAdminProduct(payload, payload.id), ...allProducts]);
      refreshNewItemDescriptionTemplates();

    } catch (error) {
      statusEl.textContent = `Erro: ${error.message}`;
      statusEl.style.color = '#ef4444';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Salvar';
    }
  }

  // Função para comprimir e converter imagem para WebP (Max 150KB)
  async function compressImage(file) {
    // Ignora se não for imagem
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Redimensiona se for maior que Full HD (1920px) para otimizar tamanho
        const MAX_DIMENSION = 1920;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Função recursiva para reduzir qualidade até atingir < 150KB
        const attemptCompression = (quality) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Erro ao gerar blob da imagem.'));
              return;
            }

            // 150KB = 153600 bytes. Limite inferior de qualidade 0.2
            if (blob.size <= 153600 || quality <= 0.2) {
              const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
              const newFile = new File([blob], newName, {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(newFile);
            } else {
              // Reduz qualidade em 10% e tenta de novo
              attemptCompression(quality - 0.1);
            }
          }, 'image/webp', quality);
        };

        // Inicia com qualidade 0.9
        attemptCompression(0.9);
      };

      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  async function uploadImages(files, folderName) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado para upload.");
    const token = await user.getIdToken();

    const sigResponse = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getUploadSignature', payload: folderName, token })
    });
    const sigResult = await sigResponse.json();

    if (sigResult.status !== 'success') throw new Error(sigResult.message);

    const { cloudName, apiKey, timestamp, signature, folder } = sigResult.data;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const uploadPromises = Array.from(files).map(async (file) => {
      let fileToUpload = file;
      try {
        // Tenta comprimir antes de enviar
        fileToUpload = await compressImage(file);
      } catch (err) {
        console.warn("Falha na compressão, enviando original:", err);
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);
      return fetch(uploadUrl, { method: 'POST', body: formData }).then(res => res.json());
    });

    const uploadResults = await Promise.all(uploadPromises);
    const urls = uploadResults.map(result => {
      if (result.error) throw new Error(`Erro no upload: ${result.error.message}`);
      return result.secure_url;
    });

    return urls;
  }

  // Função auxiliar para extrair o Public ID do Cloudinary
  function getCloudinaryPublicId(url) {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const uploadIndex = path.indexOf('/upload/');
      if (uploadIndex === -1) return null;

      let publicId = path.substring(uploadIndex + 8); // Remove prefixo até /upload/
      publicId = publicId.replace(/^v\d+\//, ''); // Remove versão (ex: v123/)
      
      const lastDot = publicId.lastIndexOf('.');
      if (lastDot !== -1) publicId = publicId.substring(0, lastDot); // Remove extensão

      return decodeURIComponent(publicId);
    } catch (e) {
      return null;
    }
  }

  async function deleteImage(url) {
    const publicId = getCloudinaryPublicId(url);
    console.log("Tentando excluir imagem:", url, "Public ID:", publicId);

    if (!publicId) {
        console.warn("URL não é do Cloudinary ou inválida. Removendo apenas do DOM.");
        return true; 
    }
    
    try {
        const user = auth.currentUser;
        if (!user) {
            alert("Sessão expirada. Recarregue a página.");
            return false;
        }
        const token = await user.getIdToken();
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteImage', payload: { public_id: publicId }, token })
        });
        
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const res = await response.json();
        console.log("Resposta do servidor (deleteImage):", res);

        if (res.status !== 'success') {
            console.error("Erro do backend:", res.message);
            alert(`Erro ao apagar no servidor: ${res.message}`);
            return false;
        }
        return res.status === 'success';
    } catch (error) {
        console.error("Erro ao deletar imagem (Rede/Fetch):", error);
        alert(`Erro de conexão: ${error.message}`);
        return false;
    }
  }
  
  function loadManagerData(user) {
      const productsContainer = document.getElementById('products');
      const globalStatusEl = document.getElementById('global-status');
      
      if (!productsContainer) return;

      globalStatusEl.textContent = 'Carregando itens do Firestore...';

      productsCollection
          .get()
          .then((snapshot) => {
              const products = snapshot.docs.map((doc) => toAdminProduct(doc.data(), doc.id));
              allProducts = sortProductsByIdDesc(products);
              allSubcategories = collectSubcategories(allProducts);
              renderAllProducts(allProducts);
              globalStatusEl.textContent = `${allProducts.length} itens carregados.`;
          })
          .catch((err) => {
              console.error('Erro detalhado:', err);
              globalStatusEl.textContent = 'Erro ao carregar do Firestore. Verifique o console.';
          });
  }

  function renderAllProducts(products) {
      const container = document.getElementById('products');
      editImagePickers.forEach((picker) => picker.destroy());
      editImagePickers.clear();

      if (!products || products.length === 0) {
          container.innerHTML = '<p style="text-align:center; color: var(--muted);">Nenhum item encontrado no Firestore.</p>';
          return;
      }
      
      container.innerHTML = products.map(p => {
          const img = p.imagens && p.imagens[0] ? p.imagens[0] : '';
          return `
            <div class="card card-list" data-id="${p.id}">
              <div class="card-list-container">
                <div class="card-image">
                  ${img ? `<img src="${img}" alt="${p.nome}">` : '<div class="no-image">Sem img</div>'}
                </div>
                <div class="card-info">
                  <h3 class="card-title">${p.nome}</h3>
                  <p class="card-id">ID: ${p.id} | ${p.categoria}</p>
                  <p class="card-description">${p.descricao}</p>
                  <strong class="card-price">${p.preco}</strong>
                </div>
              </div>
              <button class="btn btn-edit">
                <i class="fa-solid fa-pencil"></i> Editar
              </button>
            </div>
          `;
      }).join('');

      restoreScrollAnchor();
  }

  function renderProductCard(productId) {
    destroyEditImagePicker(productId);

    const product = allProducts.find(p => String(p.id) === String(productId));
    if (!product) return;

    const card = document.querySelector(`.card-list[data-id="${productId}"]`);
    if (!card) return;

    const editPanel = card.querySelector('.card-edit-panel');
    if (editPanel) editPanel.remove();

    const img = product.imagens && product.imagens[0] ? product.imagens[0] : '';
    
    card.innerHTML = `
      <div class="card-list-container">
        <div class="card-image">
          ${img ? `<img src="${img}" alt="${product.nome}">` : '<div class="no-image">Sem img</div>'}
        </div>
        <div class="card-info">
          <h3 class="card-title">${product.nome}</h3>
          <p class="card-id">ID: ${product.id} | ${product.categoria}</p>
          <p class="card-description">${product.descricao}</p>
          <strong class="card-price">${product.preco}</strong>
        </div>
      </div>
      <button class="btn btn-edit">
        <i class="fa-solid fa-pencil"></i> Editar
      </button>
    `;
  }

  function renderEditPanel(product) {
    const card = document.querySelector(`.card-list[data-id="${product.id}"]`);
    if (!card) return;

    const subs = Array.isArray(product.subcategorias) ? product.subcategorias : String(product.subcategorias || '').split(',').map(s => s.trim());

    const subChips = allSubcategories.map(sub => {
      const isChecked = subs.includes(sub) ? 'checked' : '';
      return `<label class="chip-item">
                <input type="checkbox" class="edit-sub-check" value="${sub}" ${isChecked}>
                <span>${sub}</span>
              </label>`;
    }).join('');

    const imagesHtml = (product.imagens || []).map((img, idx) => `
      <div class="image-item">
        <img src="${img}" alt="Imagem ${idx + 1}">
        <div class="image-corner-actions">
          <button type="button" class="btn-img-edit" title="Editar imagem"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="btn-img-delete danger" title="Remover"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="image-actions">
          <button type="button" class="btn-img-left" title="Mover para esquerda"><i class="fa-solid fa-arrow-left"></i></button>
          <button type="button" class="btn-img-right" title="Mover para direita"><i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </div>
    `).join('');
    const descriptionTemplateOptions = buildDescriptionTemplateOptionsHtml(allProducts, product.id);

    const panelHtml = `
      <div class="card-edit-panel">
        <div class="field-grid">
          <div>
            <label>Nome</label>
            <input type="text" class="edit-nome" value="${product.nome}">
          </div>
          <div>
            <label>Preço</label>
            <input type="text" class="edit-preco" value="${escapeHtml(normalizePriceValue(product.preco))}">
          </div>
        </div>

        <div class="field-grid">
          <div>
            <label>Categoria</label>
            <select class="edit-categoria">
              <option value="Brinquedos" ${product.categoria === 'Brinquedos' ? 'selected' : ''}>Brinquedos</option>
              <option value="Jogos de Mesa" ${product.categoria === 'Jogos de Mesa' ? 'selected' : ''}>Jogos de Mesa</option>
              <option value="Geleira" ${product.categoria === 'Geleira' ? 'selected' : ''}>Geleira</option>
              <option value="Decorações" ${product.categoria === 'Decorações' ? 'selected' : ''}>Decorações</option>
            </select>
          </div>
          <div>
            <label>Subcategorias</label>
            <div class="chip-container">${subChips}</div>
          </div>
        </div>

        <div>
          <label>Descrição</label>
          <textarea class="edit-descricao">${product.descricao}</textarea>
          <div class="field-grid description-template-row" style="margin-top: 8px;">
            <div class="description-template-main">
              <label class="description-template-label">Reaproveitar descrição (opcional)</label>
              <select class="edit-desc-template-select">
                ${descriptionTemplateOptions}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label>Imagens Atuais (lápis para editar, setas para ordenar)</label>
          <div class="image-list">
            ${imagesHtml}
          </div>
        </div>

        <div>
          <label>Adicionar Novas Imagens</label>
          <div class="image-dropzone edit-image-dropzone" tabindex="0" role="button" aria-label="Adicionar novas imagens ao item">
            <i class="fa-regular fa-images" aria-hidden="true"></i>
            <p>Arraste, clique para selecionar ou cole com Ctrl+V/Cmd+V.</p>
            <span class="image-dropzone-hint edit-image-picker-hint">Nenhuma nova imagem selecionada.</span>
            <input type="file" class="edit-new-images" multiple accept="image/*">
          </div>
          <div class="image-picker-preview edit-image-preview" aria-live="polite"></div>
        </div>

        <div class="card-footer">
          <div class="card-status"></div>
          <div>
            <button class="btn btn-ghost btn-cancel-edit" data-id="${product.id}">Cancelar</button>
            <button class="btn btn-primary btn-save-changes" data-id="${product.id}">Salvar Alterações</button>
          </div>
          <button class="btn danger btn-delete-product" data-id="${product.id}" style="margin-right: auto;">Excluir Item</button>
        </div>
      </div>
    `;

    card.insertAdjacentHTML('beforeend', panelHtml);
    setupEditImagePicker(product.id);
  }

  async function handleUpdateProduct(productId) {
    const card = document.querySelector(`.card-list[data-id="${productId}"]`);
    if (!card) return;

    const statusEl = card.querySelector('.card-status');
    const saveBtn = card.querySelector('.btn-save-changes');
    
    const nome = card.querySelector('.edit-nome').value.trim();
    const preco = normalizePriceValue(card.querySelector('.edit-preco').value.trim());
    const categoria = card.querySelector('.edit-categoria').value;
    const descricao = card.querySelector('.edit-descricao').value.trim();
    
    // Nova lógica para pegar os chips na edição também
    const subcategorias = Array.from(card.querySelectorAll('.edit-sub-check:checked')).map(cb => cb.value);

    const imagesToDelete = Array.from(card.querySelectorAll('.image-item.marked-for-deletion img')).map(img => img.src);
    const existingImages = Array.from(card.querySelectorAll('.image-item:not(.marked-for-deletion) img')).map(img => img.src);

    if (!nome) {
      statusEl.textContent = 'O nome do item é obrigatório.';
      return;
    }
    const newFilesInput = card.querySelector('.edit-new-images');
    const editPicker = editImagePickers.get(String(productId));
    const newFiles = editPicker ? editPicker.getFiles() : Array.from(newFilesInput?.files || []);
    
    // Determina o nome da pasta automaticamente
    let folderName = `${productId}-${nome.trim().replace(/\s+/g, '-')}`.replace(/[^a-zA-Z0-9À-ÿ-]/g, '');
    // Tenta detectar a pasta existente a partir da primeira imagem, se houver
    if (existingImages.length > 0) {
        const publicId = getCloudinaryPublicId(existingImages[0]);
        if (publicId) {
            const parts = publicId.split('/');
            if (parts.length > 1) folderName = parts[0];
        }
    }

    statusEl.textContent = 'Salvando...';
    saveBtn.disabled = true;

    try {
      console.log("Iniciando atualização do produto...");
      // Primeiro, apaga as imagens marcadas para exclusão no Cloudinary
      if (imagesToDelete.length > 0) {
        statusEl.textContent = `Excluindo ${imagesToDelete.length} imagem(ns)...`;
        await Promise.all(imagesToDelete.map(url => deleteImage(url)));
      }

      let newImageUrls = [];
      if (newFiles.length > 0) {
        statusEl.textContent = 'Enviando novas imagens...';
        newImageUrls = await uploadImages(newFiles, folderName);
      }

      const finalImages = [...existingImages, ...newImageUrls];

      const payload = {
        id: productId,
        nome,
        categoria,
        subcategorias,
        preco,
        descricao,
        imagens: finalImages
      };

      statusEl.textContent = 'Atualizando Firestore...';
      await productsCollection.doc(String(productId)).set(toFirestoreProductDoc(payload), { merge: true });

      const productIndex = allProducts.findIndex(p => String(p.id) === String(productId));
      if (productIndex !== -1) {
        allProducts[productIndex] = toAdminProduct({ ...allProducts[productIndex], ...payload }, productId);
      }
      refreshNewItemDescriptionTemplates();

      toggleEditMode(productId);
      scrollToProduct(productId, 'auto');
      
    } catch (error) {
      console.error(error);
      statusEl.textContent = 'Erro: ' + error.message;
      statusEl.style.color = '#ef4444';
      saveBtn.disabled = false;
    }
  }

  async function handleDeleteProduct(productId) {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    const card = document.querySelector(`.card-list[data-id="${productId}"]`);
    const statusEl = card.querySelector('.card-status');
    if (statusEl) statusEl.textContent = 'Excluindo...';

    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();

      // Tenta apagar a pasta do Cloudinary se houver imagens
      const product = allProducts.find(p => String(p.id) === String(productId));
      if (product && product.imagens && product.imagens.length > 0) {
          const publicId = getCloudinaryPublicId(product.imagens[0]);
          if (publicId && publicId.includes('/')) {
              const folderName = publicId.split('/').slice(0, -1).join('/');
              await fetch(API_URL, {
                  method: 'POST',
                  body: JSON.stringify({ action: 'deleteFolder', payload: { folder: folderName }, token })
              }).catch(err => console.error("Erro ao apagar pasta:", err));
          }
      }

      await productsCollection.doc(String(productId)).delete();

      allProducts = allProducts.filter(p => String(p.id) !== String(productId));
      allSubcategories = collectSubcategories(allProducts);
      destroyEditImagePicker(productId);
      card.remove();
      document.getElementById('global-status').textContent = `${allProducts.length} itens carregados.`;

    } catch (error) {
      console.error(error);
      alert('Erro ao excluir: ' + error.message);
    }
  }
});
