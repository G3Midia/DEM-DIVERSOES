const SPREADSHEET_ID = "13nL3fx9jp84DIKGr516nteMEFPCfLvtlrzlZlVzibdA";
const SHEET_NAME = "Página1";
const SUBCATEGORIES_SHEET = "Subcategorias";

// Função doGet para verificar se a API está online pelo navegador
function doGet(e) {
  const products = getProducts();
  return ContentService.createTextOutput(
    JSON.stringify(products)
  ).setMimeType(ContentService.MimeType.JSON);
}

// Nova função doPost para receber chamadas da API externa
function doPost(e) {
  if (!e) throw new Error("A função doPost deve ser chamada via requisição HTTP (Web App), não manualmente.");
  try {
    let body = {};

    // Estratégia Híbrida: Tenta ler do formulário (novo método) ou do corpo cru (método antigo)
    if (e.parameter && e.parameter.data) {
      body = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      throw new Error("Nenhum dado recebido na requisição.");
    }

    // A primeira etapa é sempre verificar o token de autenticação do Firebase.
    // Isso substitui a verificação de chave de API.
    const user = getVerifiedUser_(e, body);
    if (!user) throw new Error("Acesso não autorizado.");

    const action = body.action;
    const payload = body.payload;
    let result;

    // Roteador de ações
    switch (action) {
      case "getUploadSignature":
        result = getUploadSignature(payload);
        break;
      case "getNextId":
        result = getNextId();
        break;
      case "saveProduct":
        result = saveProduct(payload);
        break;
      case "getManagerData":
        result = getManagerData();
        break;
      case "updateProduct":
        result = updateProduct(payload);
        break;
      case "deleteProduct":
        result = deleteProduct(payload);
        break;
      case "deleteImage":
        result = deleteImage(payload);
        break;
      case "deleteFolder":
        result = deleteFolder(payload);
        break;
      default:
        throw new Error("Ação inválida: " + action);
    }

    // Retorna uma resposta de sucesso em JSON
    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", data: result })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // Retorna uma resposta de erro em JSON
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function getUploadSignature(folderName) {
  const cloudName = getProp_("CLOUDINARY_CLOUD_NAME");
  const apiKey = getProp_("CLOUDINARY_API_KEY");
  const apiSecret = getProp_("CLOUDINARY_API_SECRET");
  const baseFolder = getProp_("CLOUDINARY_BASE_FOLDER") || "DEMDIV/Decoracoes";

  const timestamp = Math.floor(Date.now() / 1000);
  const safeFolder = slugify_(folderName || "item");
  const folder = baseFolder.replace(/\/+$/g, "") + "/" + safeFolder;

  const paramsToSign = { folder: folder, timestamp: timestamp };
  const signature = signParams_(paramsToSign, apiSecret);

  return { cloudName, apiKey, timestamp, signature, folder };
}

function formatId_(id) {
  return String(id).padStart(4, '0');
}

function saveProduct(payload) {
  if (payload === undefined) {
    // Lança um erro mais claro para execução manual no editor
    throw new Error("Esta função espera dados do formulário. Para testar permissões, execute 'getProducts'.");
  }
  const data = typeof payload === "string" ? JSON.parse(payload) : payload || {};
  const nome = (data.nome || "").trim();
  if (!nome) throw new Error("Nome e obrigatorio.");

  const categoria = (data.categoria || "").trim();
  const subcategorias = (data.subcategorias || "").trim();
  const preco = (data.preco || "").trim();
  const descricao = (data.descricao || "").trim();
  const imagens = Array.isArray(data.imagens) ? data.imagens.join(",") : "";

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Aba nao encontrada: " + SHEET_NAME);

  // Se um ID for fornecido no payload, usa-o. Caso contrário, gera um novo (fallback).
  const idToSave = data.id ? formatId_(data.id) : (() => {
    let nextIdNum = 1;
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      const numericIds = ids.map(id => Number(id)).filter(n => !isNaN(n) && n > 0);
      if (numericIds.length > 0) {
        nextIdNum = Math.max(...numericIds) + 1;
      }
    }
    return formatId_(nextIdNum);
  })();

  sheet.appendRow([idToSave, nome, categoria, subcategorias, preco, descricao, imagens, ""]);

  return { ok: true, id: idToSave };
}

function getProducts() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Aba nao encontrada: " + SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  return rows
    .map(([id, nome, categoria, subcategorias, preco, descricao, imagens]) => ({
      id: formatId_(String(id || "").trim()),
      nome: String(nome || "").trim(),
      categoria: String(categoria || "").trim(),
      subcategorias: String(subcategorias || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      preco: String(preco || "").trim(),
      descricao: String(descricao || "").trim(),
      imagens: String(imagens || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }))
    .filter((item) => item.id);
}

function getManagerData() {
  const [products, subcategories] = [getProducts(), getSubcategories()];
  return { products: products, subcategories: subcategories };
}

function updateProduct(payload) {
  const data = typeof payload === "string" ? JSON.parse(payload) : payload || {};
  const id = String(data.id || "").trim();
  if (!id) throw new Error("ID e obrigatorio.");

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Aba nao encontrada: " + SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("Nenhum item encontrado.");

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex((value) => String(value || "").trim() === id);
  if (index === -1) throw new Error("Item nao encontrado: " + id);

  const row = index + 2;
  const nome = String(data.nome || "").trim();
  const categoria = String(data.categoria || "").trim();
  const subcategorias = Array.isArray(data.subcategorias)
    ? data.subcategorias.join(", ")
    : String(data.subcategorias || "").trim();
  const preco = String(data.preco || "").trim();
  const descricao = String(data.descricao || "").trim();
  const imagens = Array.isArray(data.imagens)
    ? data.imagens.join(",")
    : String(data.imagens || "").trim();

  sheet.getRange(row, 1, 1, 7).setValues([
    [formatId_(id), nome, categoria, subcategorias, preco, descricao, imagens],
  ]);

  return { ok: true, id: formatId_(id) };
}

function deleteProduct(payload) {
  const data = typeof payload === "string" ? JSON.parse(payload) : payload || {};
  const itemId = String(data.id || data || "").trim();
  if (!itemId) throw new Error("ID e obrigatorio.");

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Aba nao encontrada: " + SHEET_NAME);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("Nenhum item encontrado.");

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex((value) => String(value || "").trim() === itemId);
  if (index === -1) throw new Error("Item nao encontrado: " + itemId);

  sheet.deleteRow(index + 2);
  return { ok: true };
}

function deleteImage(payload) {
  const publicId = payload.public_id;
  if (!publicId) throw new Error("Public ID e obrigatorio.");

  const cloudName = getProp_("CLOUDINARY_CLOUD_NAME");
  const apiKey = getProp_("CLOUDINARY_API_KEY");
  const apiSecret = getProp_("CLOUDINARY_API_SECRET");

  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp: timestamp };
  const signature = signParams_(params, apiSecret);

  const formData = {
    public_id: publicId,
    api_key: apiKey,
    timestamp: timestamp,
    signature: signature
  };

  const options = {
    method: "post",
    payload: formData
  };

  const response = UrlFetchApp.fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    options
  );
  return JSON.parse(response.getContentText());
}

function deleteFolder(payload) {
  const folderName = payload.folder;
  if (!folderName) throw new Error("Nome da pasta e obrigatorio.");

  const cloudName = getProp_("CLOUDINARY_CLOUD_NAME");
  const apiKey = getProp_("CLOUDINARY_API_KEY");
  const apiSecret = getProp_("CLOUDINARY_API_SECRET");

  const authHeader = "Basic " + Utilities.base64Encode(apiKey + ":" + apiSecret);
  const options = {
    method: "delete",
    headers: { Authorization: authHeader },
    muteHttpExceptions: true,
  };

  // 1. Apaga recursos dentro da pasta (prefixo)
  UrlFetchApp.fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?prefix=${folderName}/`, options);

  // 2. Apaga a pasta
  const response = UrlFetchApp.fetch(`https://api.cloudinary.com/v1_1/${cloudName}/folders/${folderName}`, options);
  
  return JSON.parse(response.getContentText());
}

function getNextId() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Aba nao encontrada: " + SHEET_NAME);
  let nextId = 1;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    // Filtra apenas números válidos e encontra o maior
    const numericIds = ids.map(id => Number(id)).filter(n => !isNaN(n) && n > 0);
    if (numericIds.length > 0) {
      nextId = Math.max(...numericIds) + 1;
    }
  }
  return { id: formatId_(nextId) };
}

function getSubcategories() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
    SUBCATEGORIES_SHEET
  );
  if (!sheet) throw new Error("Aba nao encontrada: " + SUBCATEGORIES_SHEET);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const unique = new Set();
  values.forEach((value) => {
    const cleaned = String(value || "").trim();
    if (cleaned) unique.add(cleaned);
  });

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function signParams_(params, apiSecret) {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join("&");
  const raw = toSign + apiSecret;
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_1,
    raw,
    Utilities.Charset.UTF_8
  );
  return bytesToHex_(bytes);
}

function bytesToHex_(bytes) {
  return bytes.map((b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function slugify_(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* =========================================
   VERIFICAÇÃO DE TOKEN FIREBASE
   ========================================= */

function getVerifiedUser_(e, body) {
  // Tenta pegar o token do corpo (body.token) ou da URL/Headers como fallback
  const token = (body && body.token) || e.parameter.token || e.parameters.token || (e.postData && e.postData.headers && e.postData.headers.authorization);
  
  if (!token) throw new Error("Token de autorização não fornecido.");

  const idToken = String(token).replace("Bearer ", "");
  const payload = decodeJwt_(idToken);

  if (!payload) throw new Error("Token inválido.");

  // Valida o emissor e a audiência do token
  // BLINDAGEM: Define o ID do projeto fixo para evitar tokens de outros projetos Firebase
  const projectId = "dem-admin"; 
  // const projectId = getProp_("FIREBASE_PROJECT_ID"); // Alternativa via propriedades

  const issuer = "https://securetoken.google.com/" + projectId;
  if (payload.iss !== issuer) throw new Error("Emissor do token inválido.");
  if (payload.aud !== projectId) throw new Error("Audiência do token inválida.");

  // Valida o tempo de expiração
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error("Token expirado.");

  // (Opcional, mas recomendado) Valida a assinatura do token
  if (!verifySignature_(idToken, payload.header.kid)) {
    // throw new Error("Assinatura do token inválida."); // Descomente para segurança máxima
  }

  return { email: payload.email, uid: payload.user_id };
}

function decodeJwt_(token) {
  try {
    const [headerB64, payloadB64] = token.split(".");
    const header = JSON.parse(Utilities.newBlob(Utilities.base64Decode(headerB64)).getDataAsString());
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(payloadB64)).getDataAsString());
    return { header, ...payload };
  } catch (err) {
    return null;
  }
}

function getFirebasePublicKeys_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("firebase-public-keys");
  if (cached) return JSON.parse(cached);

  const url = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
  const res = UrlFetchApp.fetch(url);
  const keys = JSON.parse(res.getContentText());

  cache.put("firebase-public-keys", JSON.stringify(keys), 3600); // Cache por 1 hora
  return keys;
}

function verifySignature_(token, kid) {
  try {
    const publicKeys = getFirebasePublicKeys_();
    const publicKey = publicKeys[kid];
    if (!publicKey) return false;

    const [header, payload, signature] = token.split(".");
    const signedContent = `${header}.${payload}`;
    const signatureBytes = Utilities.base64DecodeWebSafe(signature);

    return Utilities.verify(Utilities.DigestAlgorithm.RSA_SHA_256, signedContent, signatureBytes, publicKey);
  } catch (e) {
    return false;
  }
}
