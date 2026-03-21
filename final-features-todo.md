# Características Críticas Finales - TODO

## Fase 1: Persistencia Completa
- [ ] 1.1 Crear schema de persistencia completa (terreno + diseño + config + flujo)
- [ ] 1.2 Implementar POST /api/projects → guardar estado completo
- [ ] 1.3 Implementar GET /api/projects/:id → recuperar TODO
- [ ] 1.4 Crear validación de integridad de datos
- [ ] 1.5 Tests: guardar → recargar → verificar exactitud

## Fase 2: Modo Presentación
- [ ] 2.1 Crear componente PresentationMode (pantalla completa)
- [ ] 2.2 Implementar BEFORE/AFTER con slider
- [ ] 2.3 Agregar animaciones de entrada (fade/zoom)
- [ ] 2.4 Mostrar: diseño, precio, beneficios
- [ ] 2.5 Botones: "Generar PDF", "Confirmar proyecto"
- [ ] 2.6 Optimizar para iPad

## Fase 3: Sincronización Frontend
- [ ] 3.1 Crear store global (Zustand)
- [ ] 3.2 Implementar autosave con debounce (2s)
- [ ] 3.3 Cargar proyecto → reconstruir canvas
- [ ] 3.4 Sincronizar estado local-backend
- [ ] 3.5 Tests: refrescar página → datos intactos

## Fase 4: Sugerencias Automáticas
- [ ] 4.1 Detectar áreas vacías en diseño
- [ ] 4.2 Calcular valor agregado de sugerencias
- [ ] 4.3 Mostrar sugerencias contextuales
- [ ] 4.4 Integrar con Profit Engine
- [ ] 4.5 Tests: sugerencias correctas

## Fase 5: Tests
- [ ] 5.1 Tests de persistencia
- [ ] 5.2 Tests de presentación
- [ ] 5.3 Tests de sincronización
- [ ] 5.4 Tests de sugerencias
- [ ] 5.5 Tests de integración E2E

## Fase 6: Entrega
- [ ] 6.1 Documentación completa
- [ ] 6.2 Checkpoint final
- [ ] 6.3 ZIP con código
- [ ] 6.4 Reportar resultados
