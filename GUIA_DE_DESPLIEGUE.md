# Guía Completa de Despliegue: LandscapeApp

Esta guía detalla paso a paso cómo se configuró y desplegó el proyecto **LandscapeApp**, separando el **Frontend en Vercel** y el **Backend en Render**. Este documento está diseñado para que cualquier otro agente de IA o desarrollador pueda entender la arquitectura actual y continuar trabajando en el proyecto.

## 1. Arquitectura General

El proyecto utiliza una arquitectura cliente-servidor separada:

| Componente | Tecnología | Plataforma de Despliegue | URL Actual |
|------------|------------|--------------------------|------------|
| **Frontend** | React, Vite, TailwindCSS | Vercel | `https://landscape-frontend.vercel.app` |
| **Backend** | Node.js, Express, tRPC | Render | `https://landscape-backend.onrender.com` |
| **Base de Datos** | PostgreSQL (Drizzle ORM) | Render / Neon | Configurada en el backend |

## 2. Configuración del Frontend (Vercel)

El frontend es una aplicación de una sola página (SPA) construida con Vite. 

### Pasos realizados para el despliegue en Vercel:

1. **Configuración de `vercel.json`:**
   Se creó un archivo `vercel.json` en la raíz del proyecto para manejar el enrutamiento y el proxy hacia el backend. Esto es crucial para evitar problemas de CORS y permitir que el frontend se comunique con el backend sin exponer la URL real del backend en el código del cliente.

   ```json
   {
     "version": 2,
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://landscape-backend.onrender.com/api/$1" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   *Nota:* La primera regla redirige todas las llamadas `/api/*` al backend en Render. La segunda regla asegura que el enrutador del cliente (Wouter) maneje todas las demás rutas.

2. **Comandos de Construcción (Build):**
   El comando utilizado para construir el frontend es:
   ```bash
   npm run build:client
   ```
   O directamente:
   ```bash
   vite build
   ```
   El directorio de salida (Output Directory) está configurado como `dist`.

3. **Variables de Entorno:**
   Para el frontend, no es estrictamente necesario configurar `VITE_API_URL` en Vercel si se utiliza el proxy en `vercel.json`. Sin embargo, si se requiere, se debe configurar:
   ```env
   VITE_API_URL=/api/trpc
   ```

4. **Despliegue mediante Vercel CLI:**
   El despliegue se realizó utilizando el CLI de Vercel con un token de acceso:
   ```bash
   npx vercel --prod --yes --token "TU_TOKEN_AQUI"
   ```

## 3. Configuración del Backend (Render)

El backend es un servidor Node.js/Express que expone una API tRPC y maneja la conexión a la base de datos PostgreSQL.

### Pasos para el despliegue en Render:

1. **Punto de Entrada (Entry Point):**
   El código fuente del servidor está en `server/_core/index.ts`. Durante el desarrollo se usa `tsx`, pero para producción se compila con `esbuild`.

2. **Comandos de Construcción (Build):**
   El comando utilizado en Render para preparar el entorno es:
   ```bash
   pnpm install && pnpm run build:server
   ```
   Esto genera el archivo compilado en `dist/index.js`.

3. **Comando de Inicio (Start):**
   El comando para iniciar el servidor en producción es:
   ```bash
   pnpm run start
   ```
   Que ejecuta: `NODE_ENV=production node dist/index.js`

4. **Variables de Entorno Requeridas en Render:**
   En el panel de control de Render, se deben configurar las siguientes variables de entorno:
   
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://usuario:password@host:puerto/nombre_bd` (Tu cadena de conexión a PostgreSQL)
   - `JWT_SECRET=tu_secreto_seguro`
   - `PORT=10000` (Render asigna automáticamente el puerto, pero el código debe escuchar en `process.env.PORT`)

## 4. Flujo de Datos y Persistencia Local

Es importante entender cómo el frontend maneja los datos actualmente, especialmente para el flujo de captura de imágenes y diseño:

1. **Almacenamiento de Imágenes:**
   Debido a los límites de cuota de `localStorage` (típicamente 5MB), las imágenes capturadas en el paso 1 (Capture) se comprimen y se guardan en una clave separada llamada `captureImage_${projectId}`. 

2. **Sincronización del Diseño:**
   El canvas de diseño (AdjustLiveStep) utiliza el hook `useDesignSync` que guarda el estado de los objetos y materiales en `design_${projectId}`.

3. **Metadatos del Proyecto:**
   La información general del proyecto (nombre, cliente, estado) se guarda en `project_${projectId}`.

*Si un nuevo agente necesita modificar el flujo de datos, debe tener en cuenta que la imagen del terreno NO está dentro del objeto `project`, sino que se resuelve buscando en `captureImage_${projectId}`.*

## 5. Próximos Pasos Recomendados

Si vas a continuar el desarrollo con otro agente, aquí hay algunas áreas que podrías pedirle que mejore:

1. **Migrar de LocalStorage a Base de Datos:**
   Actualmente, el flujo principal de diseño se guarda en el navegador del usuario (`localStorage`). El backend y la base de datos PostgreSQL ya están configurados, pero falta conectar las funciones de guardado (`saveProject`) para que envíen los datos al servidor tRPC en lugar de solo guardarlos localmente.

2. **Mejorar la Detección de Obstáculos:**
   El algoritmo actual en `ObstacleDetector.tsx` utiliza análisis de color y *flood fill* en el cliente. Se podría conectar a una API de visión artificial en el backend para una detección más precisa.

3. **Autenticación:**
   Implementar el flujo completo de inicio de sesión de usuarios para que los proyectos se asocien a cuentas específicas en la base de datos.
