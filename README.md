# Senasa Comprobantes

Procesador de comprobantes de transferencia SENASA.

## Estructura

```
senasa-comprobantes/
├── src/
│   ├── server.js       ← servidor Express
│   └── processor.js    ← lógica de procesamiento PDF+CSV
├── public/
│   ├── login.html      ← pantalla de login
│   └── app.html        ← app principal
├── Dockerfile
└── package.json
```

## Variables de entorno (Railway)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `AUTH_USER` | Usuario de acceso | `automatizacion` |
| `AUTH_PASS` | Contraseña de acceso | `irina2026` |
| `SESSION_SECRET` | Secreto para sesiones | `senasa_secret_2026` |
| `PORT` | Puerto del servidor | `3000` |

## Deploy en Railway

1. Crear repo en GitHub y subir este código
2. En Railway: **New Project → Deploy from GitHub repo**
3. Agregar las variables de entorno en **Settings → Variables**
4. Railway detecta el Dockerfile automáticamente

## Uso

1. Ingresar con usuario y contraseña
2. Subir el PDF de comprobantes de transferencia
3. Subir el CSV de TEFs (separado por punto y coma)
4. Hacer click en **Procesar**
5. Descargar el ZIP con los comprobantes individuales
