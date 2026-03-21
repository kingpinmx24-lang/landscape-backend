# Análisis de Tipos de Base de Datos

## Estructura Real en Base de Datos

### Measurements Table
- `id`: int (PK)
- `projectId`: int (FK)
- `data`: JSON → `{ type, value, unit, description?, timestamp? }`
- `createdAt`: timestamp
- `updatedAt`: timestamp

### Quotations Table
- `id`: int (PK)
- `projectId`: int (FK)
- `totalCost`: decimal(12, 2) → número
- `items`: JSON → `[{ description, quantity, unitPrice, subtotal }]`
- `status`: enum (draft, sent, accepted, rejected, completed)
- `metadata`: JSON → `{ notes?, discount?, tax?, currency? }`
- `createdAt`: timestamp
- `updatedAt`: timestamp

## Sincronización Requerida

### queries-refactored.ts
- addMeasurementRefactored: Debe aceptar `{ data: MeasurementData }`
- addQuotationRefactored: Debe aceptar `{ items, totalCost (number), status, metadata? }`

### routers/projects-refactored.ts
- addMeasurement: Input debe coincidir con estructura real
- addQuotation: Input debe coincidir con estructura real
