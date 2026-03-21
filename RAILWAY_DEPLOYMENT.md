# Guía Completa de Despliegue en Railway

## Descripción General

Esta guía proporciona instrucciones paso a paso para desplegar la aplicación **LandscapeApp** en Railway, una plataforma de hosting moderna que simplifica el despliegue de aplicaciones full-stack.

**Ventajas de Railway:**
- Despliegue automático desde GitHub
- Base de datos PostgreSQL incluida
- Variables de entorno seguras
- Escalado automático
- Dominio personalizado
- SSL/TLS automático

---

## Requisitos Previos

Antes de comenzar, asegúrate de tener:

1. **Cuenta en Railway** - Crea una en [railway.app](https://railway.app)
2. **Repositorio en GitHub** - Sube el proyecto a GitHub
3. **Node.js 18+** - Instalado localmente para pruebas
4. **Git** - Para control de versiones

---

## Paso 1: Preparar el Proyecto para Railway

### 1.1 Crear archivo `railway.json`

Crea un archivo `railway.json` en la raíz del proyecto:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks",
    "buildCommand": "pnpm install && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 5
  }
}
```

### 1.2 Crear archivo `.railway/config.json`

Crea la carpeta `.railway` y dentro el archivo `config.json`:

```json
{
  "environments": {
    "production": {
      "name": "Production",
      "region": "us-west",
      "replicas": 1
    }
  }
}
```

### 1.3 Actualizar `package.json`

Asegúrate de que tu `package.json` tenga los siguientes scripts:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
    "build": "vite build && tsc --noEmit",
    "start": "NODE_ENV=production node dist/server/index.js",
    "test": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### 1.4 Crear archivo `.env.production`

Este archivo define las variables de entorno para producción. **NO lo subas a GitHub** - Railway lo creará automáticamente:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/landscape_db
JWT_SECRET=your-secret-key-here-min-32-chars-long
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
VITE_APP_TITLE=LandscapeApp
VITE_APP_LOGO=https://your-cdn-url/logo.png
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

### 1.5 Crear archivo `.railwayignore`

Excluye archivos innecesarios del despliegue:

```
node_modules
.git
dist
.env.local
.env.development.local
.env.test.local
.DS_Store
*.log
.manus-logs
.webdev
```

---

## Paso 2: Configurar Base de Datos en Railway

### 2.1 Crear Proyecto en Railway

1. Ve a [railway.app/dashboard](https://railway.app/dashboard)
2. Haz clic en **"New Project"**
3. Selecciona **"Deploy from GitHub"**
4. Conecta tu cuenta de GitHub
5. Selecciona el repositorio `landscape_backend`

### 2.2 Agregar PostgreSQL

1. En el dashboard del proyecto, haz clic en **"Add Service"**
2. Selecciona **"PostgreSQL"**
3. Railway creará automáticamente una base de datos
4. Copia la `DATABASE_URL` que aparece en las variables de entorno

### 2.3 Ejecutar Migraciones

Después de que Railway cree la base de datos:

1. En el dashboard, ve a la pestaña **"Deployments"**
2. Haz clic en el último despliegue
3. En la sección **"Logs"**, verifica que las migraciones se ejecutaron correctamente

Si necesitas ejecutar migraciones manualmente:

```bash
# Localmente
DATABASE_URL="postgresql://..." pnpm db:migrate
```

---

## Paso 3: Configurar Variables de Entorno en Railway

### 3.1 Acceder a Variables de Entorno

1. En el dashboard del proyecto, selecciona tu aplicación
2. Ve a la pestaña **"Variables"**
3. Haz clic en **"Add Variable"**

### 3.2 Variables Requeridas

Agrega las siguientes variables:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Ambiente de ejecución | `production` |
| `DATABASE_URL` | URL de conexión PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Clave para firmar tokens JWT | `your-secret-key-min-32-chars` |
| `VITE_APP_ID` | ID de aplicación Manus | `your-app-id` |
| `OAUTH_SERVER_URL` | URL del servidor OAuth | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | URL del portal de autenticación | `https://auth.manus.im` |
| `OWNER_OPEN_ID` | ID del propietario | `your-owner-id` |
| `OWNER_NAME` | Nombre del propietario | `Tu Nombre` |
| `BUILT_IN_FORGE_API_URL` | URL de la API Forge | `https://forge.manus.im` |
| `BUILT_IN_FORGE_API_KEY` | Clave API Forge (servidor) | `your-forge-key` |
| `VITE_FRONTEND_FORGE_API_KEY` | Clave API Forge (frontend) | `your-frontend-key` |
| `VITE_FRONTEND_FORGE_API_URL` | URL API Forge (frontend) | `https://forge.manus.im` |
| `VITE_APP_TITLE` | Título de la aplicación | `LandscapeApp` |
| `VITE_APP_LOGO` | URL del logo | `https://cdn.example.com/logo.png` |
| `VITE_ANALYTICS_ENDPOINT` | Endpoint de analíticas | `https://analytics.manus.im` |
| `VITE_ANALYTICS_WEBSITE_ID` | ID del sitio web | `your-website-id` |

### 3.3 Generar JWT_SECRET Seguro

```bash
# En tu terminal local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Paso 4: Conectar Repositorio de GitHub

### 4.1 Configurar Despliegue Automático

1. En Railway, ve a **"Deployments"** → **"Settings"**
2. En **"GitHub"**, conecta tu repositorio
3. Selecciona la rama principal (generalmente `main` o `master`)
4. Habilita **"Auto Deploy"** para desplegar automáticamente con cada push

### 4.2 Proteger Ramas

En GitHub, protege la rama principal:

1. Ve a **Settings** → **Branches**
2. Agrega una regla de protección para `main`
3. Requiere revisiones antes de merge
4. Requiere que todas las pruebas pasen

---

## Paso 5: Configurar Dominio Personalizado

### 5.1 Usar Dominio de Railway

Railway proporciona un dominio gratuito: `https://landscape-backend-production.up.railway.app`

### 5.2 Usar Dominio Personalizado

Si tienes un dominio propio:

1. En Railway, ve a **"Settings"** → **"Domains"**
2. Haz clic en **"Add Domain"**
3. Ingresa tu dominio (ej: `landscape.tudominio.com`)
4. Railway te mostrará los registros DNS a configurar
5. En tu proveedor de DNS, agrega los registros CNAME
6. Espera a que se propague (5-30 minutos)

---

## Paso 6: Monitoreo y Logs

### 6.1 Ver Logs en Tiempo Real

1. En el dashboard de Railway, selecciona tu aplicación
2. Ve a la pestaña **"Logs"**
3. Verás los logs en tiempo real del servidor

### 6.2 Configurar Alertas

1. Ve a **"Settings"** → **"Alerts"**
2. Configura alertas para:
   - Despliegue fallido
   - Alto uso de CPU
   - Alto uso de memoria
   - Base de datos desconectada

### 6.3 Monitorear Métricas

En la pestaña **"Metrics"**, puedes ver:
- Uso de CPU
- Uso de memoria
- Solicitudes HTTP
- Latencia
- Errores

---

## Paso 7: Despliegue Manual (Opcional)

Si prefieres desplegar manualmente sin GitHub:

### 7.1 Instalar Railway CLI

```bash
npm install -g @railway/cli
```

### 7.2 Autenticarse

```bash
railway login
```

### 7.3 Crear Proyecto

```bash
railway init
```

### 7.4 Desplegar

```bash
railway up
```

---

## Paso 8: Backup y Recuperación

### 8.1 Backup de Base de Datos

Railway realiza backups automáticos diarios. Para descargar un backup:

1. En Railway, ve a **PostgreSQL** → **"Backups"**
2. Selecciona el backup que deseas
3. Haz clic en **"Download"**

### 8.2 Restaurar desde Backup

```bash
# Localmente
psql -U postgres -d landscape_db < backup.sql
```

### 8.3 Exportar Datos

```bash
# Exportar tabla específica
pg_dump -U postgres -d landscape_db -t projects > projects_backup.sql

# Exportar toda la base de datos
pg_dump -U postgres -d landscape_db > full_backup.sql
```

---

## Paso 9: Optimizaciones para Producción

### 9.1 Habilitar Compresión Gzip

En `server/_core/index.ts`, agrega:

```typescript
import compression from 'compression';

app.use(compression());
```

### 9.2 Configurar Cache

```typescript
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api')) {
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutos
  }
  next();
});
```

### 9.3 Limitar Tasa de Solicitudes

```bash
pnpm add express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 solicitudes por ventana
});

app.use('/api/', limiter);
```

### 9.4 Habilitar HTTPS

Railway configura automáticamente HTTPS. Asegúrate de redirigir HTTP a HTTPS:

```typescript
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

---

## Paso 10: Troubleshooting Común

### Problema: "Build Failed"

**Solución:**
```bash
# Verifica que todos los scripts existan
pnpm build
pnpm start

# Verifica que no hay errores TypeScript
pnpm tsc --noEmit
```

### Problema: "Database Connection Error"

**Solución:**
```bash
# Verifica la DATABASE_URL
echo $DATABASE_URL

# Prueba la conexión localmente
psql $DATABASE_URL -c "SELECT 1"
```

### Problema: "Out of Memory"

**Solución:**
1. En Railway, aumenta la memoria asignada
2. Optimiza consultas de base de datos
3. Implementa paginación en listados

### Problema: "Port Already in Use"

**Solución:**
```typescript
// En server/_core/index.ts, usa la variable de entorno PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Checklist de Despliegue

Antes de desplegar a producción, verifica:

- [ ] Archivo `railway.json` creado
- [ ] Variables de entorno configuradas en Railway
- [ ] Base de datos PostgreSQL creada
- [ ] Migraciones ejecutadas
- [ ] Tests pasando localmente (`pnpm test`)
- [ ] Build sin errores (`pnpm build`)
- [ ] Aplicación funciona localmente (`pnpm dev`)
- [ ] Repositorio en GitHub
- [ ] Despliegue automático habilitado
- [ ] Dominio configurado
- [ ] SSL/TLS habilitado
- [ ] Logs monitoreados
- [ ] Backups configurados

---

## Comandos Útiles

```bash
# Desplegar cambios
git push origin main

# Ver logs en tiempo real
railway logs -f

# Ejecutar comando en producción
railway run pnpm db:migrate

# Conectar a base de datos de producción
railway connect postgres

# Ver variables de entorno
railway variables

# Desplegar manualmente
railway up
```

---

## Recursos Adicionales

- [Documentación oficial de Railway](https://docs.railway.app)
- [Railway CLI Reference](https://docs.railway.app/reference/cli-api)
- [PostgreSQL en Railway](https://docs.railway.app/databases/postgresql)
- [Despliegue desde GitHub](https://docs.railway.app/deploy/github)
- [Dominios personalizados](https://docs.railway.app/infrastructure/domains)

---

## Soporte

Si encuentras problemas:

1. Revisa los logs en Railway Dashboard
2. Consulta la [documentación oficial](https://docs.railway.app)
3. Contacta al soporte de Railway en [railway.app/support](https://railway.app/support)

---

**Última actualización:** Marzo 2026  
**Versión:** 1.0
