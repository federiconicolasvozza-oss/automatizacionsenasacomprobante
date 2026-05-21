const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { parse } = require("csv-parse/sync");
const archiver = require("archiver");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

/**
 * Procesa el PDF de comprobantes + CSV de TEFs
 * Devuelve un Buffer con el ZIP de los PDFs individuales
 */
async function procesarComprobantes(pdfBuffer, csvBuffer) {
  // ── 1. Parsear CSV ─────────────────────────────────────────────────────
  const csvText = csvBuffer.toString("latin1");
const records = parse(csvText, {
    skip_empty_lines: true,
    columns: true,
    delimiter: ";",
    quote: false,
    trim: true
});

  // Mapa: nroRed → nroOperacion
  const redToOperacion = {};
  for (const row of records) {
    const nroRed = (row["Número Red"] || row["Numero Red"] || "").replace(/\D/g, "");
    const nroOp = (row["Nro de Operación"] || row["Nro de Operacion"] || "").replace(/\D/g, "");
    if (nroRed && nroOp) redToOperacion[nroRed] = nroOp;
  }

  console.log(`📊 CSV: ${Object.keys(redToOperacion).length} registros cargados`);

  // ── 2. Cargar PDF con pdf-lib (para dividir y escribir) ────────────────
  const fullPdfDoc = await PDFDocument.load(pdfBuffer);
  const font = await fullPdfDoc.embedFont(StandardFonts.Helvetica);

  // ── 3. Cargar PDF con pdfjs (para extraer texto por página) ───────────
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;

  console.log(`📄 PDF: ${pdf.numPages} páginas`);

  // ── 4. Procesar cada página ────────────────────────────────────────────
  const resultados = [];

  for (let i = 0; i < pdf.numPages; i++) {
    const pdfPage = await pdf.getPage(i + 1);
    const textContent = await pdfPage.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(" ");

    // Extraer Nro. de red
    const match = pageText.match(/Nro\.\s*de\s*red[:\s]*([0-9\.\s]+)/i);
    const nroRedExtraido = match ? match[1].replace(/\D/g, "") : null;
    const nroOperacion = nroRedExtraido && redToOperacion[nroRedExtraido]
      ? redToOperacion[nroRedExtraido]
      : "NO_ENCONTRADO";

    if (!nroRedExtraido) {
      console.warn(`⚠️ Página ${i + 1}: No se encontró Nro. de red`);
    } else if (nroOperacion === "NO_ENCONTRADO") {
      console.warn(`⚠️ Página ${i + 1}: Nro. red ${nroRedExtraido} no está en el CSV`);
    } else {
      console.log(`✅ Página ${i + 1}: Nro. red ${nroRedExtraido} → Operación ${nroOperacion}`);
    }

    // Escribir número de operación en la página
    const page = fullPdfDoc.getPages()[i];
    page.drawText(`Número de comprobante: ${nroOperacion}`, {
      x: 20,
      y: page.getHeight() - 30,
      size: 14,
      font,
      color: rgb(0, 0, 0)
    });

    // Extraer página individual
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(fullPdfDoc, [i]);
    singleDoc.addPage(copiedPage);
    const pageBytes = await singleDoc.save();

    const nombreArchivo = `Senasa Comprob ${nroOperacion}.pdf`;
    resultados.push({ nombre: nombreArchivo, bytes: pageBytes, operacion: nroOperacion });
  }

  console.log(`📦 Generando ZIP con ${resultados.length} archivos...`);

  // ── 5. Armar ZIP en memoria ────────────────────────────────────────────
  const zipBuffer = await armarZip(resultados);
  return zipBuffer;
}


/**
 * Arma un ZIP en memoria con los PDFs procesados
 */
function armarZip(archivos) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("data", chunk => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    for (const { nombre, bytes } of archivos) {
      archive.append(Buffer.from(bytes), { name: nombre });
    }

    archive.finalize();
  });
}

module.exports = { procesarComprobantes };
