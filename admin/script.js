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
  const SCROLL_ANCHOR_KEY = 'admin-scroll-anchor-id';
  const normalize = (value = '') =>
    String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const currentPage = window.location.pathname.split('/').pop().toLowerCase();
  const authStatusEl = document.getElementById('auth-status');

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
    const signupButton = document.getElementById('signup-button');
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
      signupButton.disabled = true;
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
          signupButton.disabled = false;
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

    signupButton?.addEventListener('click', () => {
      const email = emailInput.value;
      const password = passwordInput.value;
      if (!email || !password) {
        showAuthStatus('Por favor, preencha email e senha para criar a conta.', true);
        return;
      }
      auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
          showAuthStatus('Conta criada com sucesso! Você já pode entrar.', false);
        })
        .catch(error => {
          console.error("Firebase signup error:", error);
          showAuthStatus(getFirebaseErrorMessage(error), true);
        });
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
    form?.addEventListener('submit', handleSaveProduct);
  }

  // --- Lógica da página Gerenciar Itens (index.html) ---
  if (currentPage === 'index.html') {
    const productsContainer = document.getElementById('products');
    productsContainer?.addEventListener('click', handleProductAction);

    const searchInput = document.getElementById('search');
    searchInput?.addEventListener('input', (e) => {
      const term = normalize(e.target.value);
      const filtered = allProducts.filter(p => {
        const subcats = Array.isArray(p.subcategorias)
          ? p.subcategorias.join(' ')
          : String(p.subcategorias || '');
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

      // Alterna a classe para marcar/desmarcar para exclusão
      imageItem.classList.toggle('marked-for-deletion');

      // Atualiza a UI do botão (ícone e título) para refletir o estado
      const icon = imgDeleteBtn.querySelector('i');
      const isMarked = imageItem.classList.contains('marked-for-deletion');
      
      imgDeleteBtn.title = isMarked ? 'Desfazer marcação' : 'Marcar para remover';
      icon?.classList.toggle('fa-trash', !isMarked);
      icon?.classList.toggle('fa-undo', isMarked);
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
        renderProductCard(openCard.dataset.id);
      }
    });

    if (isActive) {
      card.classList.remove('is-editing');
      renderProductCard(productId);
    } else {
      const product = allProducts.find(p => String(p.id) === String(productId));
      if (product) {
        card.classList.add('is-editing');
        renderEditPanel(product);
      }
    }
  }

  function loadAdminFormData(user) {
    if (allSubcategories.length > 0) {
      populateSubcategories(allSubcategories);
      return;
    }

    user.getIdToken()
      .then(token => {
        return fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getManagerData', token: token })
        });
      })
      .then(res => res.json())
      .then(response => {
        if (response.status === 'success') {
          allSubcategories = response.data.subcategories || [];
          populateSubcategories(allSubcategories);
        }
      })
      .catch(err => console.error("Erro ao carregar categorias:", err));
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
      const user = auth.currentUser;
      if (!user) throw new Error("Usuário não autenticado.");
      const token = await user.getIdToken();

      // 1. Pega o próximo ID do backend para usar no nome da pasta
      statusEl.textContent = 'Obtendo ID do produto...';
      const idResponse = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getNextId', token })
      });
      const idResult = await idResponse.json();
      if (idResult.status !== 'success') throw new Error(idResult.message || 'Falha ao obter ID.');
      const newId = idResult.data.id;

      // 2. Faz o upload das imagens com o nome da pasta correto
      const imageFiles = form.querySelector('#imagens').files;
      let imageUrls = [];
      if (imageFiles.length > 0) {
        statusEl.textContent = 'Fazendo upload das imagens...';
        const folderName = `${newId} - ${nome}`.replace(/[^a-zA-Z0-9À-ÿ -]/g, '');
        imageUrls = await uploadImages(imageFiles, folderName);
      }

      // 3. Envia os dados para a planilha, incluindo o ID pré-definido
      statusEl.textContent = 'Enviando dados para a planilha...';
      const payload = {
        id: newId, // Envia o ID obtido para o backend
        nome: nome,
        categoria: form.querySelector('#categoria').value,
        subcategorias: Array.from(form.querySelectorAll('input[name="subcategoria"]:checked')).map(cb => cb.value).join(', '),
        preco: form.querySelector('#preco').value,
        descricao: form.querySelector('#descricao').value,
        imagens: imageUrls,
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'saveProduct', payload, token })
      });
      const result = await response.json();

      if (result.status !== 'success') throw new Error(result.message);

      statusEl.textContent = `Produto "${nome}" salvo com sucesso!`;
      statusEl.style.color = 'var(--primary)';
      form.reset();

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

      globalStatusEl.textContent = 'Carregando itens da planilha...';

      user.getIdToken()
          .then(token => {
              return fetch(API_URL, {
              method: 'POST',
              body: JSON.stringify({ action: 'getManagerData', token: token })
              });
          })
          .then(res => res.json())
          .then(response => {
              if (response.status === 'success') {
                  allProducts = response.data.products.reverse();
                  allSubcategories = response.data.subcategories || [];
                  renderAllProducts(allProducts);
                  globalStatusEl.textContent = `${response.data.products.length} itens carregados.`;
              } else {
                  globalStatusEl.textContent = 'Erro: ' + response.message;
              }
          })
          .catch(err => {
              console.error("Erro detalhado:", err);
              globalStatusEl.textContent = 'Erro de conexão ou autenticação. Verifique o console.';
          });
  }

  function renderAllProducts(products) {
      const container = document.getElementById('products');
      if (!products || products.length === 0) {
          container.innerHTML = '<p style="text-align:center; color: var(--muted);">Nenhum item encontrado na planilha.</p>';
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
        <div class="image-actions">
          <button type="button" class="btn-img-left" title="Mover para esquerda"><i class="fa-solid fa-arrow-left"></i></button>
          <button type="button" class="btn-img-delete danger" title="Remover"><i class="fa-solid fa-trash"></i></button>
          <button type="button" class="btn-img-right" title="Mover para direita"><i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </div>
    `).join('');

    const panelHtml = `
      <div class="card-edit-panel">
        <div class="field-grid">
          <div>
            <label>Nome</label>
            <input type="text" class="edit-nome" value="${product.nome}">
          </div>
          <div>
            <label>Preço</label>
            <input type="text" class="edit-preco" value="${product.preco}">
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
        </div>

        <div>
          <label>Imagens Atuais (Arraste ou use setas)</label>
          <div class="image-list">
            ${imagesHtml}
          </div>
        </div>

        <div>
          <label>Adicionar Novas Imagens</label>
          <input type="file" class="edit-new-images" multiple accept="image/*">
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
  }

  async function handleUpdateProduct(productId) {
    const card = document.querySelector(`.card-list[data-id="${productId}"]`);
    if (!card) return;

    const statusEl = card.querySelector('.card-status');
    const saveBtn = card.querySelector('.btn-save-changes');
    
    const nome = card.querySelector('.edit-nome').value.trim();
    const preco = card.querySelector('.edit-preco').value.trim();
    const categoria = card.querySelector('.edit-categoria').value;
    const descricao = card.querySelector('.edit-descricao').value.trim();
    
    // Nova lógica para pegar os chips na edição também
    const subcategorias = Array.from(card.querySelectorAll('.edit-sub-check:checked')).map(cb => cb.value).join(', ');

    const imagesToDelete = Array.from(card.querySelectorAll('.image-item.marked-for-deletion img')).map(img => img.src);
    const existingImages = Array.from(card.querySelectorAll('.image-item:not(.marked-for-deletion) img')).map(img => img.src);

    const newFilesInput = card.querySelector('.edit-new-images');
    const newFiles = newFilesInput.files;
    
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

      statusEl.textContent = 'Atualizando planilha...';
      
      const user = auth.currentUser;
      const token = await user.getIdToken();

      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateProduct', payload, token })
      });
      const result = await response.json();

      if (result.status !== 'success') throw new Error(result.message);

      const productIndex = allProducts.findIndex(p => String(p.id) === String(productId));
      if (productIndex !== -1) {
        allProducts[productIndex] = { ...allProducts[productIndex], ...payload };
      }

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

      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteProduct', payload: { id: productId }, token })
      });
      const result = await response.json();

      if (result.status !== 'success') throw new Error(result.message);

      allProducts = allProducts.filter(p => String(p.id) !== String(productId));
      card.remove();
      document.getElementById('global-status').textContent = `${allProducts.length} itens carregados.`;

    } catch (error) {
      console.error(error);
      alert('Erro ao excluir: ' + error.message);
    }
  }
});
