document.addEventListener('DOMContentLoaded', () => {
  // ATENÇÃO: Substitua com as configurações do seu projeto Firebase
  const firebaseConfig = {
    apiKey: "REDACTED",
    authDomain: "dem-admin.firebaseapp.com",
    projectId: "dem-admin",
    storageBucket: "dem-admin.appspot.com",
    messagingSenderId: "784224507087",
    appId: "1:784224507087:web:e9e25fa711080ca2c753ba"
  };

  // Inicializa o Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();
  
  // URL do seu Google Apps Script (Backend do Sheets)
  const API_URL = "https://script.google.com/macros/s/AKfycbxgMNP1sis1Ew1gRs9W76jHD43pDlY2sFHy0hwhzelHbbX1q2fswYOM5y7MHIeWlnip/exec";

  let allProducts = [];
  let allSubcategories = [];

  const currentPage = window.location.pathname.split('/').pop();
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
        if (currentPage === 'Admin.html') {
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
          return 'Erro de configuração: A chave de API do Firebase é inválida. Verifique o arquivo `admin/script.js`.';
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

  // --- Lógica de Logout (para Admin.html e index.html) ---
  const logoutButton = document.getElementById('logout-button');
  logoutButton?.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().catch(error => {
      console.error('Erro ao fazer logout:', error);
    });
  });

  // --- Lógica da página Adicionar Item (Admin.html) ---
  if (currentPage === 'Admin.html') {
    const form = document.getElementById('product-form');
    form?.addEventListener('submit', handleSaveProduct);
  }

  // --- Lógica da página Gerenciar Itens (index.html) ---
  if (currentPage === 'index.html') {
    const productsContainer = document.getElementById('products');
    productsContainer?.addEventListener('click', handleProductAction);

    const searchInput = document.getElementById('search');
    searchInput?.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allProducts.filter(p => 
        p.nome.toLowerCase().includes(term) ||
        String(p.id).toLowerCase().includes(term) ||
        p.categoria.toLowerCase().includes(term)
      );
      renderAllProducts(filtered);
      document.getElementById('global-status').textContent = `${filtered.length} de ${allProducts.length} itens exibidos.`;
    });
  }

  function handleProductAction(event) {
    const editButton = event.target.closest('.btn-edit');
    if (editButton) {
      event.preventDefault();
      const card = editButton.closest('.card-list');
      toggleEditMode(card.dataset.id);
    }

    const cancelButton = event.target.closest('.btn-cancel-edit');
    if (cancelButton) {
      event.preventDefault();
      toggleEditMode(cancelButton.dataset.id);
    }

    const saveButton = event.target.closest('.btn-save-changes');
    if (saveButton) {
      event.preventDefault();
      handleUpdateProduct(saveButton.dataset.id);
    }

    const deleteButton = event.target.closest('.btn-delete-product');
    if (deleteButton) {
      event.preventDefault();
      handleDeleteProduct(deleteButton.dataset.id);
    }

    const imgDeleteBtn = event.target.closest('.btn-img-delete');
    if (imgDeleteBtn) {
      imgDeleteBtn.closest('.image-item').remove();
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

    user.getIdToken().then(token => {
      fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getManagerData', token: token })
      })
      .then(res => res.json())
      .then(response => {
        if (response.status === 'success') {
          allSubcategories = response.data.subcategories || [];
          populateSubcategories(allSubcategories);
        }
      });
    });
  }

  function populateSubcategories(subcategories, selected = []) {
    const select = document.getElementById('subcategorias');
    if (!select) return;
    select.innerHTML = subcategories.map(sub => {
      const isSelected = selected.includes(sub);
      return `<option value="${sub}" ${isSelected ? 'selected' : ''}>${sub}</option>`;
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
      const imageFiles = form.querySelector('#imagens').files;
      let imageUrls = [];
      if (imageFiles.length > 0) {
        statusEl.textContent = 'Fazendo upload das imagens...';
        const folderName = form.querySelector('#pasta-cloudinary').value.trim() || nome;
        imageUrls = await uploadImages(imageFiles, folderName);
      }

      statusEl.textContent = 'Enviando dados para a planilha...';
      const payload = {
        nome: nome,
        categoria: form.querySelector('#categoria').value,
        subcategorias: Array.from(form.querySelector('#subcategorias').selectedOptions).map(opt => opt.value),
        preco: form.querySelector('#preco').value,
        descricao: form.querySelector('#descricao').value,
        imagens: imageUrls,
      };

      const user = auth.currentUser;
      if (!user) throw new Error("Usuário não autenticado.");
      const token = await user.getIdToken();

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

    const uploadPromises = Array.from(files).map(file => {
      const formData = new FormData();
      formData.append('file', file);
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
  
  function loadManagerData(user) {
      const productsContainer = document.getElementById('products');
      const globalStatusEl = document.getElementById('global-status');
      
      if (!productsContainer) return;

      globalStatusEl.textContent = 'Carregando itens da planilha...';

      user.getIdToken().then(token => {
          fetch(API_URL, {
              method: 'POST',
              body: JSON.stringify({ action: 'getManagerData', token: token })
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
              console.error(err);
              globalStatusEl.textContent = 'Erro de conexão com o Google Sheets.';
          });
      });
  }

  function renderProducts(products) {
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
  }
});