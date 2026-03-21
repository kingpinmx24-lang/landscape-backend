# Módulo de Captura Profesional - WebAR + Detección de Terreno

## Fase 1: Arquitectura y Planificación
- [x] 1.1 Instalar dependencias: Three.js, WebXR, TensorFlow.js
- [x] 1.2 Crear estructura de carpetas para captura
- [x] 1.3 Definir tipos TypeScript para captura y mediciones
- [x] 1.4 Crear hooks React para WebAR y cámara
- [x] 1.5 Planificar fallback para dispositivos sin LiDAR

## Fase 2: WebAR con Three.js y WebXR
- [x] 2.1 Crear componente CaptureView con Three.js
- [x] 2.2 Inicializar sesión WebXR (AR)
- [x] 2.3 Implementar fallback: cámara estándar
- [x] 2.4 Detectar soporte de LiDAR en iPhone
- [x] 2.5 Crear raycasting para seleccionar puntos
- [ ] 2.6 Validar en Safari iOS (requiere dispositivo real)

## Fase 3: Sistema de Medición
- [x] 3.1 Crear hook useMeasurement para manejar puntos
- [x] 3.2 Implementar selección de 2 puntos en AR
- [x] 3.3 Calcular distancia euclidiana en metros
- [x] 3.4 Mostrar medición en tiempo real
- [x] 3.5 Guardar historial de mediciones
- [ ] 3.6 Validar precisión con LiDAR (requiere dispositivo real)

## Fase 4: Detección de Terreno con ML
- [x] 4.1 Integrar TensorFlow.js Coco-SSD o modelo personalizado
- [x] 4.2 Crear modelo de segmentación (tierra/pasto/cemento)
- [x] 4.3 Procesar frames de cámara en tiempo real
- [x] 4.4 Generar mapa de segmentación
- [x] 4.5 Optimizar para rendimiento en iOS
- [x] 4.6 Crear fallback: selección manual de zonas

## Fase 5: Overlay Visual y Anotaciones
- [x] 5.1 Crear sistema de capas visuales
- [x] 5.2 Dibujar puntos de medición
- [x] 5.3 Dibujar líneas de distancia
- [x] 5.4 Colorear zonas de terreno (tierra/pasto/cemento)
- [x] 5.5 Mostrar etiquetas y valores
- [x] 5.6 Implementar controles de opacidad

## Fase 6: Exportación de Datos
- [x] 6.1 Crear estructura de datos para zonas (polígonos)
- [x] 6.2 Generar GeoJSON con coordenadas reales
- [x] 6.3 Exportar a JSON con escala real
- [x] 6.4 Guardar en base de datos (proyecto)
- [x] 6.5 Crear endpoint tRPC para guardar captura
- [x] 6.6 Implementar descarga de datos

## Fase 7: Tests y Validación
- [x] 7.1 Crear tests unitarios para mediciones
- [x] 7.2 Crear tests para segmentación
- [ ] 7.3 Validar en iPhone 12 Pro (requiere dispositivo real)
- [ ] 7.4 Validar en iPhone 13 Pro (requiere dispositivo real)
- [ ] 7.5 Validar en iPhone 14 Pro (requiere dispositivo real)
- [ ] 7.6 Validar en iPhone 15 Pro (requiere dispositivo real)
- [ ] 7.7 Validar en iPad (requiere dispositivo real)
- [ ] 7.8 Validar en Safari iOS (requiere dispositivo real)

## Fase 8: Optimización y Entrega
- [x] 8.1 Optimizar rendimiento de WebAR
- [x] 8.2 Reducir tamaño de bundle
- [x] 8.3 Implementar caching de modelos ML
- [x] 8.4 Crear documentación de uso (CAPTURE_SETUP.md)
- [ ] 8.5 Reportar resultados
