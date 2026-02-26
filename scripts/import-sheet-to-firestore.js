const admin = require("firebase-admin");
const fetch = require("node-fetch");
const path = require("path");

const serviceAccountPath = path.resolve(__dirname, "..", "serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

const SHEET_URL = "https://script.google.com/macros/s/AKfycbxgMNP1sis1Ew1gRs9W76jHD43pDlY2sFHy0hwhzelHbbX1q2fswYOM5y7MHIeWlnip/exec";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  const raw = String(value || "").trim();
  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch (_) {
      // fallback para split abaixo
    }
  }

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

async function run() {
  const response = await fetch(SHEET_URL);
  if (!response.ok) {
    throw new Error(`Falha ao buscar catálogo: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  if (!rows.length) {
    console.log("Nenhum produto encontrado no endpoint.");
    return;
  }

  let processed = 0;
  let committed = 0;
  let skipped = 0;

  let batch = db.batch();
  let ops = 0;

  const commitBatch = async () => {
    if (!ops) return;
    await batch.commit();
    committed += ops;
    batch = db.batch();
    ops = 0;
  };

  for (const row of rows) {
    const id = String(pick(row, ["id", "Id", "ID"])).trim();
    if (!id) {
      skipped += 1;
      continue;
    }

    const doc = {
      id,
      nome: String(pick(row, ["nome", "Nome"]) || "").trim(),
      categoria: String(pick(row, ["categoria", "Categoria"]) || "").trim(),
      subcategorias: parseList(pick(row, ["subcategorias", "Subcategorias", "subcategoria", "Subcategoria"])),
      preco: String(pick(row, ["preco", "Preco", "Preço", "PRECO"]) || "").trim(),
      descricao: String(pick(row, ["descricao", "Descricao", "Descrição"]) || "").trim(),
      imagens: parseList(pick(row, ["imagens", "Imagens"])),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = db.collection("products").doc(id);
    batch.set(ref, doc, { merge: true });
    ops += 1;
    processed += 1;

    if (ops >= 400) {
      await commitBatch();
      console.log(`Parcial: ${processed} processados / ${committed} gravados`);
    }
  }

  await commitBatch();
  console.log(`Importação concluída. Processados: ${processed}, gravados: ${committed}, ignorados sem ID: ${skipped}`);
}

run().catch((error) => {
  console.error("Erro na importação:", error.message);
  process.exit(1);
});
