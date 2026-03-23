# LandscapeApp — Arquitectura, Estructura y Conexiones

> Documento técnico completo del proyecto. Actualizado: Marzo 2026.

---

## 1. Visión General

**LandscapeApp** es una aplicación web full-stack para paisajistas profesionales. Permite capturar la foto de un terreno, detectar y borrar obstáculos con IA, diseñar el jardín con materiales del inventario, y cerrar la cotización en tiempo real frente al cliente.

El proyecto es un **monorepo** que contiene el frontend (React) y el backend (Node.js serverless) en un solo repositorio, desplegados ambos en **Vercel**.

---

## 2. Estructura de Directorios

```
landscape_project/
│
├── client/                          # FRONTEND (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdjustLiveStep.tsx   # ★ Componente principal del editor (canvas + chat IA)
│   │   │   ├── ImprovedLiveCanvas.tsx # Canvas interactivo (plantas, materiales, drag&drop)
│   │   │   ├── LiveCanvas.tsx       # Canvas base
│   │   │   └── ...                  # Otros componentes UI
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # Lista de proyectos del usuario
│   │   │   ├── InventoryAdmin.tsx   # Panel de gestión de inventario
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── trpc.ts              # Cliente tRPC (conexión tipada al backend)
│   │   │   ├── store.ts             # Estado global (Zustand)
│   │   │   └── imageStorage.ts      # IndexedDB para imágenes grandes
│   │   └── main.tsx                 # Punto de entrada React
│   ├── index.html
│   └── vite.config.ts
│
├── server/                          # BACKEND (Node.js + tRPC + Drizzle)
│   ├── _core/
│   │   └── trpc.ts                  # Inicialización de tRPC (router, procedure)
│   ├── db/
│   │   └── index.ts                 # Conexión a PostgreSQL vía Drizzle
│   └── routers/
│       ├── inpaint.ts               # ★ Router IA: detectObstacles, cleanTerrain, aiDesignChat, generateDesign
│       ├── inventory.ts             # CRUD de inventario (plantas y materiales)
│       ├── projects.ts              # CRUD de proyectos
│       └── index.ts                 # AppRouter: agrupa todos los routers
│
├── drizzle/
│   ├── schema.ts                    # ★ Definición de tablas (users, projects, inventory_items)
│   ├── 0000_eminent_tusk.sql        # Migración inicial
│   └── 0001_free_whirlwind.sql      # Migración de inventario
│
├── api/                             # Serverless Functions de Vercel
│   ├── trpc/[...trpc].ts            # Punto de entrada tRPC en Vercel
│   ├── health.ts                    # Health check endpoint
│   ├── migrate.ts                   # Endpoint para correr migraciones
│   └── debug.ts                     # Debug endpoint
│
├── vercel.json                      # Configuración de rutas y rewrites en Vercel
├── drizzle.config.ts                # Configuración de Drizzle ORM
├── package.json                     # Scripts del monorepo
└── ARQUITECTURA.md                  # Este archivo
```

---

## 3. Tecnologías y Stack

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| **Frontend** | React 18 + Vite + TypeScript | UI interactiva |
| **Estilos** | TailwindCSS + shadcn/ui | Diseño y componentes |
| **Estado Global** | Zustand | Store del canvas y sesión |
| **Comunicación** | tRPC (client) | Llamadas al backend con tipos |
| **Backend** | Node.js (Serverless) | Lógica de negocio y IA |
| **API Layer** | tRPC (server) | Endpoints tipados |
| **ORM** | Drizzle ORM | Acceso a base de datos |
| **Base de Datos** | PostgreSQL (TiDB/Neon) | Persistencia de datos |
| **IA — Chat** | Anthropic Claude (Opus 4.6) | Asistente de diseño, detección de obstáculos |
| **IA — Imágenes** | Cloudflare AI (Stable Diffusion) | Inpainting y generación de terrenos |
| **Despliegue** | Vercel | Frontend + Serverless Functions |
| **Almacenamiento local** | IndexedDB (browser) | Imágenes de alta resolución |

---

## 4. Flujo de Datos Completo

### 4.1. Comunicación Frontend ↔ Backend

Toda la comunicación usa **tRPC**, que garantiza seguridad de tipos de extremo a extremo:

```
[React Component]
      |
      | trpc.inpaint.generateDesign.useMutation()
      ↓
[tRPC Client — client/src/lib/trpc.ts]
      |
      | HTTP POST → /api/trpc/inpaint.generateDesign
      ↓
[Vercel Serverless — api/trpc/[...trpc].ts]
      |
      | Enruta al router correcto
      ↓
[server/routers/inpaint.ts — generateDesign procedure]
      |
      | Llama a Cloudflare AI API
      ↓
[Cloudflare AI — Stable Diffusion]
      |
      | Devuelve imagen PNG en buffer
      ↓
[Backend → Base64 → tRPC Response]
      |
      ↓
[React Component — actualiza canvas]
```

### 4.2. Flujo del Asistente de Diseño (Chat IA)

```
Usuario escribe: "Pon pasto zoysia en todo el terreno"
      |
      ↓
AdjustLiveStep.tsx → trpc.inpaint.aiDesignChat.mutate({
  message, captureImage, inventory, canvasObjects, appliedMaterials
})
      |
      ↓
server/routers/inpaint.ts → aiDesignChat procedure
  → Construye systemPrompt con inventario y estado del canvas
  → Llama a Anthropic Claude API (claude-opus-4-6)
  → Claude devuelve texto + bloque <actions>[...]</actions>
      |
      ↓
Backend parsea las acciones JSON y las devuelve al cliente
      |
      ↓
AdjustLiveStep.tsx ejecuta cada acción:
  - "add_plant"       → agrega planta al canvas
  - "apply_material"  → aplica material visual (color/textura)
  - "remove_objects"  → elimina elementos del canvas
  - "generate_terrain"→ llama a trpc.inpaint.generateDesign
      |
      ↓ (si generate_terrain)
server/routers/inpaint.ts → generateDesign procedure
  → Si hay foto: cfInpaintCall() con img2img (strength=0.80)
  → Si no hay foto: cfGeneratePlantImage() con txt2img
  → Devuelve imagen Base64
      |
      ↓
Canvas actualiza el fondo con la imagen generada
```

### 4.3. Flujo de Detección y Borrado de Obstáculos

```
Usuario presiona "Detectar obstáculos"
      |
      ↓
trpc.inpaint.detectObstacles.mutate({ imageBase64 })
      |
      ↓
Claude Vision analiza la imagen
  → Devuelve JSON: [{ label, x, y, width, height, confidence }]
      |
      ↓
Canvas dibuja recuadros rojos sobre los obstáculos

Usuario presiona "Limpiar terreno"
      |
      ↓
trpc.inpaint.cleanTerrain.mutate({ imageBase64, obstacles })
      |
      ↓
Para cada obstáculo:
  1. Recorta la región (crop + padding 60%)
  2. Genera máscara blanca sobre el obstáculo
  3. Dilata la máscara 12px
  4. Redimensiona a 512×512
  5. Llama a cfInpaintCall() (Cloudflare Stable Diffusion)
     - strength=0.55 (conserva textura circundante)
     - guidance=4.0 (se mantiene fiel a la imagen original)
  6. Pega el resultado de vuelta en la imagen completa
      |
      ↓
Devuelve imagen limpia en Base64 → actualiza canvas
```

---

## 5. Base de Datos — Esquema

### Tabla `users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | serial PK | ID interno |
| openId | varchar(64) | ID de Manus OAuth |
| name | text | Nombre del usuario |
| email | varchar(320) | Email |
| role | enum(user/admin) | Rol |

### Tabla `projects`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | serial PK | ID del proyecto |
| userId | integer FK | Referencia a users |
| name | varchar(255) | Nombre del proyecto |
| terrain | jsonb | Estado completo del canvas (plantas, posiciones, imagen) |
| status | enum | draft / active / completed / archived |

### Tabla `inventory_items`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | serial PK | ID del ítem |
| name | varchar(255) | Nombre (ej. "Pasto Zoysia") |
| scientificName | varchar(255) | Nombre científico (opcional) |
| type | enum | palm / tree / shrub / flower / grass / groundcover / succulent / vine |
| price | decimal(10,2) | Precio por unidad o m² |
| stock | integer | Unidades disponibles |
| imageUrl | text | URL o Base64 de la imagen |
| description | text | Descripción del material |
| lightRequirement | enum | full / partial / shade |
| waterRequirement | enum | low / medium / high |

---

## 6. Variables de Entorno Requeridas

Configuradas en Vercel (Settings → Environment Variables):

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL (ej. `postgresql://user:pass@host/db`) |
| `ANTHROPIC_API_KEY` | API Key de Anthropic para Claude |
| `CF_API_TOKEN` | Token de Cloudflare AI (Workers AI) |
| `CF_ACCOUNT_ID` | ID de cuenta de Cloudflare |
| `OWNER_OPEN_ID` | OpenID del administrador principal |

---

## 7. Endpoints tRPC Disponibles

### Router `inpaint`
| Procedimiento | Tipo | Descripción |
|--------------|------|-------------|
| `detectObstacles` | mutation | Claude Vision detecta obstáculos en la imagen |
| `cleanTerrain` | mutation | Cloudflare AI borra obstáculos con inpainting |
| `aiDesignChat` | mutation | Claude genera acciones de diseño desde texto natural |
| `generateDesign` | mutation | Cloudflare AI genera imagen fotorrealista del diseño |
| `generatePlantImage` | mutation | Genera imagen de una planta con IA o Unsplash fallback |

### Router `inventory`
| Procedimiento | Tipo | Descripción |
|--------------|------|-------------|
| `list` | query | Lista todos los ítems del inventario |
| `add` | mutation | Agrega un nuevo ítem |
| `update` | mutation | Actualiza un ítem existente |
| `delete` | mutation | Elimina un ítem |
| `uploadImage` | mutation | Sube imagen de un ítem (Base64 → guardado en DB) |

### Router `projects`
| Procedimiento | Tipo | Descripción |
|--------------|------|-------------|
| `list` | query | Lista proyectos del usuario |
| `get` | query | Obtiene un proyecto por ID |
| `create` | mutation | Crea un nuevo proyecto |
| `update` | mutation | Actualiza un proyecto |
| `delete` | mutation | Elimina un proyecto |

---

## 8. Inventario Actual en Producción

| ID | Nombre | Tipo | Precio |
|----|--------|------|--------|
| 3 | PALMA COLA DE ZORRO | palm | $1,800.00 |
| 4 | Arecas | palm | $700.00 |
| 7 | **Pasto Zoysia** | grass | **$85.00/m²** (editable) |
| 8 | Piedras de Río | groundcover | $120.00/m² |

---

## 9. Despliegue en Vercel

El archivo `vercel.json` configura las rutas para que tanto el frontend (React SPA) como el backend (serverless functions) convivan en el mismo dominio:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- **Frontend:** Servido como SPA estática desde `/index.html`
- **Backend:** Serverless functions en `/api/trpc/[...trpc].ts`
- **URL producción:** `https://landscape-frontend.vercel.app`

---

## 10. Cómo Correr en Local

```bash
# 1. Instalar dependencias
cd landscape_project
npm install

# 2. Crear archivo .env con las variables requeridas
cp .env.backend.example .env
# Editar .env con tus claves reales

# 3. Correr migraciones de DB
npm run db:push

# 4. Iniciar desarrollo (frontend + backend)
npm run dev
```

El frontend corre en `http://localhost:5173` y el backend en `http://localhost:3000`.
