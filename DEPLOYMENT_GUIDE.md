# Guía de Despliegue para Landscape Project

Este documento detalla los pasos para desplegar el backend y el frontend del proyecto Landscape de manera separada.

## 1. Configuración del Backend

El backend ha sido modificado para utilizar PostgreSQL como base de datos y se ejecuta de forma independiente.

### Variables de Entorno

Crea un archivo `.env` en la raíz del directorio del backend (o configura estas variables directamente en tu entorno de despliegue) con las siguientes variables:

```dotenv
PORT=3000
DATABASE_URL="postgresql://user:password@host:port/database_name"
OWNER_OPEN_ID="your_owner_open_id"
```

-   `PORT`: El puerto en el que el servidor backend escuchará las conexiones. Por defecto es `3000`.
-   `DATABASE_URL`: La cadena de conexión a tu base de datos PostgreSQL. Asegúrate de que el usuario, la contraseña, el host, el puerto y el nombre de la base de datos sean correctos.
-   `OWNER_OPEN_ID`: El OpenID del usuario administrador.

### Construcción y Ejecución

Para construir el backend, navega al directorio `/home/ubuntu/landscape_project` y ejecuta:

```bash
pnpm install
pnpm run build:server
```

Esto generará los archivos de producción en el directorio `dist`. Para iniciar el servidor en producción:

```bash
pnpm run start
```

El backend expondrá su API en `/api/trpc` en el puerto configurado.

## 2. Configuración del Frontend

El frontend es una aplicación Vite que se construye de forma independiente y consume la API del backend.

### Variables de Entorno

Crea un archivo `.env` en la raíz del directorio del frontend (o configura estas variables directamente en tu entorno de despliegue) con la siguiente variable:

```dotenv
VITE_API_URL="http://your-backend-url:port/api/trpc"
```

-   `VITE_API_URL`: La URL completa del endpoint tRPC de tu backend. Por ejemplo, si tu backend se despliega en `https://api.example.com`, entonces `VITE_API_URL` debería ser `https://api.example.com/api/trpc`.

### Construcción

Para construir el frontend, navega al directorio `/home/ubuntu/landscape_project` y ejecuta:

```bash
pnpm install
pnpm run build:client
```

Esto generará los archivos estáticos de producción en el directorio `dist` dentro de la carpeta `client`. Estos archivos pueden ser servidos por cualquier servidor web estático (Nginx, Apache, Vercel, Netlify, etc.).

## 3. Consideraciones de Despliegue

-   **CORS**: Asegúrate de que tu backend esté configurado para manejar correctamente las políticas de CORS si el frontend se despliega en un dominio diferente.
-   **HTTPS**: Se recomienda encarecidamente usar HTTPS para ambos, frontend y backend, en entornos de producción.
-   **Base de Datos**: Antes de iniciar el backend, asegúrate de que la base de datos PostgreSQL esté creada y accesible con las credenciales proporcionadas en `DATABASE_URL`. Puedes ejecutar las migraciones de Drizzle ORM si es necesario (ver `package.json` para el script `db:push`).

## 4. Estructura de Directorios (Después del Build)

Después de ejecutar los comandos de build, la estructura relevante será:

```
landscape_project/
├── dist/                 # Salida del build del backend
│   └── index.js
├── client/dist/          # Salida del build del frontend
│   ├── index.html
│   ├── assets/
│   └── ...
├── server/               # Código fuente del backend
├── client/               # Código fuente del frontend
├── drizzle/              # Migraciones y esquema de la base de datos
├── package.json
├── .env.backend.example
├── .env.frontend.example
└── DEPLOYMENT_GUIDE.md
```

Este setup permite un despliegue y escalado independiente de los servicios de frontend y backend.
