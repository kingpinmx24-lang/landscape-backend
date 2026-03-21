# 🚀 Guía Rápida: Despliegue en Railway (5 minutos)

## Opción 1: Despliegue Automático (Recomendado)

### Paso 1: Preparar el Proyecto

```bash
# Asegúrate de estar en la raíz del proyecto
cd landscape_backend

# Verifica que todo compila
pnpm build

# Verifica que los tests pasan
pnpm test
```

### Paso 2: Subir a GitHub

```bash
# Inicializar repositorio si no existe
git init
git add .
git commit -m "Initial commit: LandscapeApp ready for Railway"

# Crear repositorio en GitHub y subir
git remote add origin https://github.com/tu-usuario/landscape_backend.git
git branch -M main
git push -u origin main
```

### Paso 3: Conectar Railway a GitHub

1. Ve a [railway.app](https://railway.app)
2. Inicia sesión (o crea cuenta)
3. Haz clic en **"New Project"**
4. Selecciona **"Deploy from GitHub"**
5. Conecta tu cuenta de GitHub
6. Selecciona el repositorio `landscape_backend`
7. Railway detectará automáticamente que es un proyecto Node.js

### Paso 4: Configurar Base de Datos

1. En el dashboard de Railway, haz clic en **"Add Service"**
2. Selecciona **"PostgreSQL"**
3. Railway creará automáticamente la base de datos
4. La `DATABASE_URL` se agregará automáticamente a las variables de entorno

### Paso 5: Agregar Variables de Entorno

En Railway Dashboard → Tu Proyecto → Variables, agrega:

```
NODE_ENV=production
JWT_SECRET=<genera-uno-con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
VITE_APP_ID=<tu-app-id>
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
OWNER_OPEN_ID=<tu-owner-id>
OWNER_NAME=Tu Nombre
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=<tu-forge-key>
VITE_FRONTEND_FORGE_API_KEY=<tu-frontend-key>
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
VITE_APP_TITLE=LandscapeApp
VITE_APP_LOGO=https://tu-cdn/logo.png
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=<tu-website-id>
```

### Paso 6: ¡Listo!

Railway desplegará automáticamente tu aplicación. Verás:
- ✅ Build en progreso
- ✅ Migraciones de base de datos ejecutándose
- ✅ Aplicación en vivo en `https://landscape-backend-production.up.railway.app`

---

## Opción 2: Despliegue Manual con Railway CLI

### Paso 1: Instalar Railway CLI

```bash
npm install -g @railway/cli
```

### Paso 2: Autenticarse

```bash
railway login
```

### Paso 3: Crear Proyecto

```bash
cd landscape_backend
railway init
```

### Paso 4: Agregar Base de Datos

```bash
railway add
# Selecciona PostgreSQL
```

### Paso 5: Desplegar

```bash
railway up
```

---

## Verificar que Todo Funciona

### Ver Logs en Tiempo Real

```bash
railway logs -f
```

Busca estos mensajes de éxito:
```
✅ Server running on port 3000
✅ Database connected
✅ OAuth initialized
```

### Probar la Aplicación

```bash
# Obtener la URL de tu aplicación
railway variables | grep RAILWAY_PUBLIC_DOMAIN

# O simplemente abre en el navegador:
# https://landscape-backend-production.up.railway.app
```

### Conectar a la Base de Datos

```bash
railway connect postgres
```

---

## Configurar Dominio Personalizado

### Usar Dominio de Railway (Gratis)

Ya está configurado: `https://landscape-backend-production.up.railway.app`

### Usar Tu Propio Dominio

1. En Railway Dashboard → Settings → Domains
2. Haz clic en "Add Domain"
3. Ingresa tu dominio (ej: `landscape.tudominio.com`)
4. Railway te mostrará los registros DNS
5. En tu proveedor de DNS, agrega los registros CNAME
6. Espera 5-30 minutos para que se propague

---

## Monitoreo Básico

### Ver Métricas

```bash
railway metrics
```

### Ver Variables de Entorno

```bash
railway variables
```

### Ejecutar Comando en Producción

```bash
# Ejecutar migraciones
railway run pnpm db:migrate

# Ejecutar tests
railway run pnpm test
```

---

## Troubleshooting Rápido

### "Build Failed"

```bash
# Verifica localmente
pnpm build
pnpm start

# Si funciona localmente, revisa los logs en Railway
railway logs -f
```

### "Database Connection Error"

```bash
# Verifica que DATABASE_URL está configurada
railway variables | grep DATABASE_URL

# Conecta a la base de datos
railway connect postgres
```

### "Application Crashed"

```bash
# Ver logs de error
railway logs -f

# Reiniciar aplicación
railway redeploy
```

---

## Próximos Pasos

1. **Configurar Dominio Personalizado** - Si tienes un dominio propio
2. **Configurar Backups** - Railway lo hace automáticamente, pero verifica en Settings
3. **Configurar Alertas** - Settings → Alerts
4. **Monitorear Rendimiento** - Metrics tab en Railway Dashboard
5. **Implementar CI/CD** - GitHub Actions para tests automáticos

---

## Comandos Útiles

```bash
# Ver estado del proyecto
railway status

# Ver logs en tiempo real
railway logs -f

# Redeploy (fuerza un nuevo despliegue)
railway redeploy

# Conectar a base de datos
railway connect postgres

# Ejecutar comando
railway run <comando>

# Ver variables
railway variables

# Agregar variable
railway variables set KEY=value

# Eliminar variable
railway variables unset KEY

# Ver métricas
railway metrics

# Logout
railway logout
```

---

## Recursos

- [Documentación Railway](https://docs.railway.app)
- [Railway CLI Docs](https://docs.railway.app/reference/cli-api)
- [PostgreSQL en Railway](https://docs.railway.app/databases/postgresql)
- [Dominios en Railway](https://docs.railway.app/infrastructure/domains)

---

## ¿Necesitas Ayuda?

- Revisa los logs: `railway logs -f`
- Consulta la documentación oficial: [docs.railway.app](https://docs.railway.app)
- Contacta al soporte: [railway.app/support](https://railway.app/support)

---

**¡Tu aplicación estará en vivo en menos de 5 minutos! 🎉**
