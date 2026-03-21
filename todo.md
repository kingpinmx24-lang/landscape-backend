# Landscape Backend - Refactorización a Producción

## Fase 1: Migración de Base de Datos (MySQL → PostgreSQL)
- [x] 1.1 Actualizar drizzle.config.ts para usar PostgreSQL
- [x] 1.2 Actualizar drizzle/schema.ts con tipos de PostgreSQL
- [x] 1.3 Actualizar server/db.ts para usar pg driver
- [x] 1.4 Generar migración inicial con Drizzle Kit
- [x] 1.5 Validar conexión a PostgreSQL

## Fase 2: Definición de Esquema de Dominio
- [x] 2.1 Crear tabla projects (id, userId, name, description, terrain, status, createdAt, updatedAt)
- [x] 2.2 Crear tabla plants (id, projectId, name, quantity, position, metadata)
- [x] 2.3 Crear tabla measurements (id, projectId, data JSON, createdAt)
- [x] 2.4 Crear tabla quotations (id, projectId, totalCost, items JSON, status, createdAt)
- [x] 2.5 Definir relaciones con foreign keys y cascading deletes
- [x] 2.6 Generar migraciones con Drizzle Kit

## Fase 3: Validaciones con Zod
- [x] 3.1 Crear shared/schemas.ts con validadores Zod
- [x] 3.2 Validar estructura de terreno (terrain schema)
- [x] 3.3 Validar estructura de plantas (plant schema)
- [x] 3.4 Validar estructura de medidas (measurement schema)
- [x] 3.5 Validar estructura de cotización (quotation schema)
- [x] 3.6 Crear validador de proyecto completo

## Fase 4: Implementación de Queries en server/queries.ts
- [x] 4.1 Crear getProjectById con todas las relaciones
- [x] 4.2 Crear listProjectsByUser
- [x] 4.3 Crear createProject con transacción
- [x] 4.4 Crear updateProject con validación
- [x] 4.5 Crear deleteProject con cascading
- [x] 4.6 Crear addPlant y updatePlant
- [x] 4.7 Crear addMeasurement y getMeasurements
- [x] 4.8 Crear addQuotation y getQuotations

## Fase 5: Optimización de Base de Datos
- [x] 5.1 Crear índice en projects(userId)
- [x] 5.2 Crear índice en plants(projectId)
- [x] 5.3 Crear índice en measurements(projectId)
- [x] 5.4 Crear índice en quotations(projectId)
- [x] 5.5 Crear índice compuesto en projects(userId, status)
- [x] 5.6 Analizar query plans y optimizar

## Fase 6: Endpoints tRPC CRUD
- [x] 6.1 Crear projects.list procedure
- [x] 6.2 Crear projects.get procedure
- [x] 6.3 Crear projects.create procedure
- [x] 6.4 Crear projects.update procedure
- [x] 6.5 Crear projects.delete procedure
- [x] 6.6 Crear projects.addPlant procedure
- [x] 6.7 Crear projects.addMeasurement procedure
- [x] 6.8 Crear projects.addQuotation procedure

## Fase 7: Tests de Integración
- [x] 7.1 Crear test para guardar proyecto completo
- [x] 7.2 Crear test para recargar proyecto
- [x] 7.3 Crear test para recuperar datos intactos
- [x] 7.4 Crear test para múltiples proyectos simultáneos
- [x] 7.5 Crear test para transacciones ACID
- [x] 7.6 Crear test para validación de datos corruptos
- [x] 7.7 Ejecutar suite completa de tests (24/24 PASANDO)

## Fase 8: Manejo de Errores y Logging
- [x] 8.1 Implementar error handling en queries
- [x] 8.2 Implementar logging estructurado
- [x] 8.3 Crear error types personalizados
- [x] 8.4 Validar manejo de edge cases

## Fase 9: Validación Final
- [x] 9.1 Verificar integridad referencial
- [x] 9.2 Verificar performance de queries
- [x] 9.3 Verificar persistencia en refresh
- [x] 9.4 Crear checkpoint final
- [x] 9.5 Reportar resultados al usuario


## Fase 10: Mejoras Críticas del Editor en Vivo

- [ ] 10.1 Reparar arrastrar de imágenes PNG en canvas
- [ ] 10.2 Implementar selección de plantas del inventario
- [ ] 10.3 Crear detector automático de terreno (tierra, piedras, pasto)
- [ ] 10.4 Mostrar sugerencias automáticas de materiales
- [ ] 10.5 Implementar edición rápida con un solo toque
- [ ] 10.6 Verificar que todo funciona correctamente

## Prueba Completa del Flujo

- [x] Crear proyecto con datos
- [x] Subir foto real
- [x] Ir a editar (AdjustLiveImproved)
- [x] Abrir tienda y verificar que funciona
- [ ] Agregar plantas al canvas
- [ ] Verificar cotización actualizada

## Fase 11: Funcionalidades Críticas para Proyecto Real

### Análisis (Sin Mover Código) - RESULTADOS
- [x] 11.1 Seleccionar: EXISTE handleCanvasClick + setSelectedObjectId + bounding box
- [ ] 11.2 Borrar: NO EXISTE - Necesario agregar handleDelete()
- [x] 11.3 Detector terreno: EXISTE analyzeTerrainImage + onTerrainAnalysis
- [ ] 11.4 Panel materiales: NO EXISTE - Necesario crear MaterialSelectionPanel
- [ ] 11.5 Generador diseño: NO EXISTE - Necesario crear TerrainDesignGenerator
- [ ] 11.6 Flujo integrado: PARCIAL - Sin limpieza ni selección de materiales

### Implementación
- [ ] 11.7 Agregar limpieza de terreno (seleccionar y borrar basura/obstáculos)
- [ ] 11.8 Crear panel de materiales de terreno interactivo
- [ ] 11.9 Implementar generador de diseño del terreno con materiales
- [ ] 11.10 Integración completa sin errores
- [ ] 11.11 Pruebas exhaustivas en proyecto real
