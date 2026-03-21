# Módulo de Captura Profesional - Guía de Configuración

## Compatibilidad de Dispositivos

### iPhone con LiDAR (Recomendado)
- ✅ iPhone 12 Pro / Pro Max
- ✅ iPhone 13 Pro / Pro Max
- ✅ iPhone 14 Pro / Pro Max
- ✅ iPhone 15 Pro / Pro Max

### iPad con LiDAR
- ✅ iPad Pro 11" (3ª generación y posteriores)
- ✅ iPad Pro 12.9" (4ª generación y posteriores)

### Fallback (Sin LiDAR)
- ✅ Todos los iPhone con iOS 14+
- ✅ Todos los iPad con iPadOS 14+
- ✅ Navegadores con soporte a MediaDevices API

## Requisitos de Navegador

### Safari iOS (Recomendado)
- iOS 14.5+ para acceso a cámara
- iOS 15+ para WebXR (opcional, fallback automático)
- Permisos de cámara requeridos

### Configuración en Safari iOS

1. **Habilitar Cámara**
   - Ir a Configuración > Safari > Cámara
   - Seleccionar "Permitir"

2. **Habilitar Micrófono (Opcional)**
   - Ir a Configuración > Safari > Micrófono
   - Seleccionar "Permitir"

3. **Habilitar Almacenamiento Local**
   - Ir a Configuración > Safari > Privacidad y seguridad
   - Asegurar que "Almacenamiento local" está habilitado

## Características Implementadas

### 1. Captura de Imágenes
- Acceso a cámara trasera (ambiente)
- Captura de foto en alta resolución
- Fallback automático si WebXR no está disponible

### 2. Medición de Distancia
- Seleccionar 2 puntos en la imagen
- Cálculo automático de distancia en metros
- Indicador de confianza (basado en LiDAR)
- Historial de mediciones

### 3. Detección de Terreno
- Clasificación automática de píxeles:
  - **Pasto**: Verde (RGB: 34, 139, 34)
  - **Tierra**: Marrón (RGB: 139, 69, 19)
  - **Cemento**: Gris (RGB: 169, 169, 169)
- Segmentación en tiempo real
- Extracción de zonas

### 4. Dibujo de Zonas
- Seleccionar múltiples puntos
- Crear polígonos personalizados
- Calcular área y perímetro

### 5. Exportación de Datos
- Formato JSON con mediciones
- Formato GeoJSON con coordenadas reales
- Descarga directa al dispositivo

## Flujo de Uso

### Paso 1: Acceder a Captura
```
Proyecto → Botón "Capturar" → Página de Captura
```

### Paso 2: Iniciar Cámara
```
Presionar "Iniciar" → Permitir acceso a cámara
```

### Paso 3: Seleccionar Modo
- **Medición**: Seleccionar 2 puntos para medir distancia
- **Terreno**: Detectar automáticamente tipos de terreno
- **Zonas**: Dibujar polígonos personalizados

### Paso 4: Capturar Datos
```
Presionar "Capturar" → Datos se guardan automáticamente
```

## Rendimiento Optimizado

### Optimizaciones para iOS
- Compresión de imágenes automática
- Procesamiento de frames en background
- Caché de modelos ML
- Reducción de resolución en dispositivos antiguos

### Tamaño de Bundle
- Three.js: ~500KB
- TensorFlow.js: ~300KB
- Código de captura: ~150KB
- Total: ~950KB (gzipped)

## Detección de Capacidades

El sistema detecta automáticamente:
- ✅ Disponibilidad de WebXR
- ✅ Soporte de LiDAR
- ✅ Soporte de WebGL
- ✅ Modelo de dispositivo
- ✅ Versión de iOS
- ✅ Navegador (Safari, Chrome, etc.)

## Troubleshooting

### "Cámara no disponible"
- Verificar permisos en Configuración > Privacidad > Cámara
- Reiniciar Safari
- Verificar que no hay otra app usando la cámara

### "Mediciones imprecisas"
- Asegurar buena iluminación
- Usar iPhone Pro con LiDAR para mejor precisión
- Calibrar con objetos de tamaño conocido

### "Terreno no detectado correctamente"
- Mejorar iluminación
- Acercarse más al terreno
- Usar modo manual para dibujar zonas

### "Aplicación lenta"
- Reducir resolución en Configuración
- Cerrar otras aplicaciones
- Actualizar iOS

## Desarrollo Local

### Instalar Dependencias
```bash
pnpm add three @react-three/fiber @tensorflow/tfjs
```

### Ejecutar en Desarrollo
```bash
pnpm dev
```

### Acceder desde iPhone
```
1. Obtener IP local: ifconfig | grep "inet "
2. Navegar a: http://[IP]:3000 en Safari iOS
3. Permitir acceso a cámara
```

### Testing en Safari
- Usar Safari Developer Tools en Mac
- Conectar iPhone y habilitar Web Inspector
- Inspeccionar logs y performance

## Limitaciones Conocidas

1. **Sin LiDAR**: Precisión limitada a ~0.8m
2. **Iluminación baja**: Detección de terreno menos precisa
3. **Movimiento rápido**: Blur en imágenes
4. **iOS 14**: Sin soporte WebXR (fallback automático)

## Próximas Mejoras

- [ ] Integración con Maps para georeferenciación
- [ ] Modelo ML entrenado para mejor detección
- [ ] Soporte para múltiples capturas simultáneas
- [ ] Sincronización en tiempo real con servidor
- [ ] Exportación a formatos CAD (DWG, DXF)

## Soporte

Para problemas o sugerencias, contactar al equipo de desarrollo.
