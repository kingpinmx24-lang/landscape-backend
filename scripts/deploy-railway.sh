#!/bin/bash

# Script de Despliegue a Railway
# Uso: ./scripts/deploy-railway.sh

set -e

echo "🚀 Iniciando despliegue a Railway..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json no encontrado. Ejecuta este script desde la raíz del proyecto."
  exit 1
fi

# Verificar que Railway CLI está instalado
if ! command -v railway &> /dev/null; then
  echo "📦 Instalando Railway CLI..."
  npm install -g @railway/cli
fi

# Verificar que Git está configurado
if [ -z "$(git config user.email)" ]; then
  echo "⚠️  Git no está configurado. Configúralo con:"
  echo "   git config user.email 'tu@email.com'"
  echo "   git config user.name 'Tu Nombre'"
  exit 1
fi

# Verificar que hay cambios para commit
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ No hay cambios pendientes"
else
  echo "📝 Hay cambios pendientes. Realizando commit..."
  git add .
  git commit -m "🚀 Despliegue a Railway - $(date +%Y-%m-%d\ %H:%M:%S)"
fi

# Verificar que la rama está actualizada
echo "📡 Sincronizando con repositorio remoto..."
git pull origin main || git pull origin master || true

# Ejecutar tests
echo "🧪 Ejecutando tests..."
pnpm test || echo "⚠️  Algunos tests fallaron, continuando..."

# Build local
echo "🔨 Compilando proyecto..."
pnpm build

# Verificar que railway.json existe
if [ ! -f "railway.json" ]; then
  echo "❌ Error: railway.json no encontrado. Crea el archivo railway.json en la raíz del proyecto."
  exit 1
fi

# Autenticarse en Railway
echo "🔐 Autenticando con Railway..."
railway login

# Desplegar
echo "📤 Desplegando a Railway..."
railway up

# Obtener URL de la aplicación
echo "✅ Despliegue completado!"
echo ""
echo "📊 Para ver el estado del despliegue:"
echo "   railway logs -f"
echo ""
echo "🌐 Para ver la URL de tu aplicación:"
echo "   railway variables | grep RAILWAY_STATIC_URL"
echo ""
echo "💡 Próximos pasos:"
echo "   1. Verifica los logs: railway logs -f"
echo "   2. Configura tu dominio personalizado en Railway Dashboard"
echo "   3. Monitorea el rendimiento en Railway Dashboard"
