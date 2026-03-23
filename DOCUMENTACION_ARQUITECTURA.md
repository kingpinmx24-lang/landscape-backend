# Landscape Project - Documentación de Arquitectura y Conexión

Este documento detalla la arquitectura de la aplicación de paisajismo, los módulos que la componen, y los pasos exactos para conectar el frontend con el backend y las APIs externas en producción.

## 1. Arquitectura General

La aplicación sigue una arquitectura cliente-servidor (Frontend + Backend) con integración de APIs de Inteligencia Artificial de terceros.

- **Frontend (Cliente):** React (Vite) + TypeScript + Tailwind CSS + shadcn/ui. Desplegado en Vercel.
- **Backend (Servidor):** Node.js + Express + tRPC. Desplegado en Render.
- **Almacenamiento Local:** IndexedDB (para fotos de alta resolución) y `localStorage` (para metadatos de proyectos).
- **APIs Externas:** Anthropic (Claude Vision) y Cloudflare AI (Workers AI).

---

## 2. Módulos Principales

### 2.1 Frontend (`/client/src/`)

- **Captura (`pages/Capture.tsx`):**
  - **Función:** Permite al usuario tomar una foto con la cámara (fallback a selector nativo) o subir un archivo.
  - **Manejo de Imagen:** Usa `lib/imageStorage.ts` para comprimir la imagen y guardarla en **IndexedDB** (`landscape_images`), evitando el límite de 5MB de `localStorage` en iOS Safari.

- **Diseño y Ajuste (`components/AdjustLiveStep.tsx` & `ImprovedLiveCanvas.tsx`):**
  - **Función:** El core interactivo. Muestra la foto de fondo y permite agregar plantas (drag & drop), detectar obstáculos y borrarlos.
  - **Comunicación:** Usa `@tanstack/react-query` y `tRPC` para comunicarse con el backend de forma tipada.

- **Gestión de Inventario (`pages/InventoryAdmin.tsx`):**
  - **Función:** Panel de administración para agregar, editar y eliminar plantas/materiales. Los datos se guardan en `localStorage` por ahora.

### 2.2 Backend (`/server/`)

- **Router Principal (`routers/inpaint.ts`):**
  - Contiene los endpoints tRPC que el frontend consume.
  
- **Módulo de Detección (`detectObstacles`):**
  - **Endpoint:** `/api/trpc/inpaint.detectObstacles`
  - **Función:** Recibe la imagen en base64, llama a la API de **Anthropic (Claude 3.5 Sonnet / Opus 4.6)** con un prompt visual para que identifique obstáculos (basura, ramas, mangueras) y devuelva sus coordenadas en formato JSON.

- **Módulo de Inpainting (`cleanTerrain`):**
  - **Endpoint:** `/api/trpc/inpaint.cleanTerrain`
  - **Función:** Recibe la imagen y una máscara (generada a partir de las coordenadas del obstáculo o del pincel manual). Llama a **Cloudflare AI (`@cf/runwayml/stable-diffusion-v1-5-inpainting`)** para rellenar la zona borrada con terreno natural y devuelve la nueva imagen.

---

## 3. Variables de Entorno (Conexión de APIs)

Para que el backend funcione en producción (Render), necesita las siguientes variables de entorno configuradas en el dashboard del servicio:

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `NODE_ENV` | Debe ser `production` | Manual |
| `ANTHROPIC_API_KEY` | Clave para Claude Vision (Detección de obstáculos) | https://console.anthropic.com/settings/keys |
| `CF_ACCOUNT_ID` | ID de la cuenta de Cloudflare | Dashboard de Cloudflare (URL o Workers AI) |
| `CF_API_TOKEN` | Token con permisos de **Workers AI** (Inpainting) | https://dash.cloudflare.com/profile/api-tokens |

---

## 4. Flujo de Conexión (Paso a Paso)

El flujo exacto de cómo viaja la información cuando un usuario usa la app:

### Paso A: Captura y Almacenamiento Local
1. Usuario entra a Vercel (`landscape-frontend.vercel.app`).
2. Sube foto en `Capture.tsx`.
3. El frontend comprime la foto y la guarda en **IndexedDB** del navegador del usuario.

### Paso B: Detección de Obstáculos (Frontend → Backend → Claude)
1. En `AdjustLiveStep.tsx`, el usuario presiona "Detectar Obstáculos".
2. Frontend recupera la foto de IndexedDB y hace un POST vía tRPC a `https://landscape-backend.onrender.com/api/trpc/inpaint.detectObstacles`.
3. El backend (Render) recibe el base64 y hace una petición HTTP a `api.anthropic.com` usando la `ANTHROPIC_API_KEY`.
4. Claude analiza la imagen, devuelve un JSON con coordenadas.
5. El backend responde al frontend. El frontend mapea las coordenadas (escala de imagen real a 800x600) y dibuja recuadros rojos.

### Paso C: Borrado de Obstáculos (Frontend → Backend → Cloudflare)
1. Usuario presiona "Limpiar terreno" o usa el pincel manual.
2. Frontend envía la foto y la máscara (zona a borrar) a `/api/trpc/inpaint.cleanTerrain`.
3. El backend (Render) hace una petición a `api.cloudflare.com/.../runwayml/stable-diffusion-v1-5-inpainting` usando `CF_ACCOUNT_ID` y `CF_API_TOKEN`.
4. Cloudflare devuelve una nueva imagen (PNG) con la zona borrada.
5. El backend devuelve la imagen en base64 al frontend.
6. El frontend actualiza el canvas y guarda la nueva imagen limpia en **IndexedDB**.

---

## 5. Comandos Útiles para Desarrollo

Si deseas correr el proyecto en tu máquina local:

```bash
# Instalar dependencias en raíz, cliente y servidor
npm install
cd client && npm install
cd ../server && npm install

# Correr el proyecto completo (Frontend + Backend concurrentemente)
npm run dev
```

El frontend correrá en `http://localhost:5173` y el backend en `http://localhost:5000`. Asegúrate de crear un archivo `.env` en la carpeta `/server` con las variables de entorno mencionadas arriba.
