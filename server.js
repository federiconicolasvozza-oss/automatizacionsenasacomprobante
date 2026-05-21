const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { procesarComprobantes } = require("./processor");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Credenciales desde variables de entorno ────────────────────────────────
const AUTH_USER = process.env.AUTH_USER || "automatizacion";
const AUTH_PASS = process.env.AUTH_PASS || "irina2026";
const SESSION_SECRET = process.env.SESSION_SECRET || "senasa_secret_2026";

// ── Multer: archivos en memoria ────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}));

// ── Middleware de autenticación ────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect("/");
}

// ── Rutas ──────────────────────────────────────────────────────────────────

// Login page
app.get("/", (req, res) => {
  if (req.session.authenticated) return res.redirect("/app");
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

// Login POST
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === AUTH_USER && password === AUTH_PASS) {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
  }
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// App principal
app.get("/app", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/app.html"));
});

// Procesar archivos
app.post("/procesar", requireAuth, upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "csv", maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files?.pdf || !req.files?.csv) {
      return res.status(400).json({ error: "Falta el PDF o el CSV" });
    }

    const pdfBuffer = req.files.pdf[0].buffer;
    const csvBuffer = req.files.csv[0].buffer;

    console.log(`📄 PDF recibido: ${req.files.pdf[0].originalname} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);
    console.log(`📊 CSV recibido: ${req.files.csv[0].originalname}`);

    const zipBuffer = await procesarComprobantes(pdfBuffer, csvBuffer);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="comprobantes_${Date.now()}.zip"`);
    res.send(zipBuffer);

  } catch (error) {
    console.error("❌ Error procesando:", error);
    res.status(500).json({ error: error.message || "Error interno al procesar los archivos" });
  }
});

// ── Iniciar servidor ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
