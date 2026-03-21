import type {
  GeometricObject,
  SpatialGrid,
  SpatialGridConfig,
  GridCell,
  BoundingBox,
  Point2D,
} from "./geometry-types";

/**
 * ============================================================================
 * SPATIAL GRID IMPLEMENTATION
 * ============================================================================
 * Efficient spatial indexing for collision detection
 */

/**
 * Implementación de Spatial Grid para indexación espacial
 * Divide el espacio en celdas para búsqueda eficiente de vecinos
 */
export class SpatialGridImpl implements SpatialGrid {
  config: SpatialGridConfig;
  cells: Map<string, GridCell>;
  objects: Map<string, GeometricObject>;
  private bounds: BoundingBox;

  constructor(config: SpatialGridConfig, bounds: BoundingBox) {
    this.config = config;
    this.bounds = bounds;
    this.cells = new Map();
    this.objects = new Map();
    this.initializeGrid();
  }

  /**
   * Inicializar grid vacío
   */
  private initializeGrid(): void {
    const cols = Math.ceil(this.bounds.maxX / this.config.cellSize);
    const rows = Math.ceil(this.bounds.maxY / this.config.cellSize);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const key = this.getCellKey(x, y);
        this.cells.set(key, {
          x,
          y,
          objects: [],
        });
      }
    }
  }

  /**
   * Obtener clave única para una celda
   */
  private getCellKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /**
   * Obtener coordenadas de celda desde posición mundial
   */
  private getCellCoordinates(position: Point2D): { x: number; y: number } {
    return {
      x: Math.floor(position.x / this.config.cellSize),
      y: Math.floor(position.y / this.config.cellSize),
    };
  }

  /**
   * Insertar objeto en el grid
   */
  insert(obj: GeometricObject): void {
    this.objects.set(obj.id, obj);

    // Obtener todas las celdas que el objeto ocupa
    const cellCoords = this.getCellsForObject(obj);

    for (const coord of cellCoords) {
      const key = this.getCellKey(coord.x, coord.y);
      const cell = this.cells.get(key);

      if (cell && !cell.objects.find((o) => o.id === obj.id)) {
        cell.objects.push(obj);
      }
    }
  }

  /**
   * Remover objeto del grid
   */
  remove(objectId: string): void {
    const obj = this.objects.get(objectId);
    if (!obj) return;

    this.objects.delete(objectId);

    // Remover de todas las celdas
    const cellCoords = this.getCellsForObject(obj);

    for (const coord of cellCoords) {
      const key = this.getCellKey(coord.x, coord.y);
      const cell = this.cells.get(key);

      if (cell) {
        cell.objects = cell.objects.filter((o) => o.id !== objectId);
      }
    }
  }

  /**
   * Actualizar posición de objeto
   */
  update(obj: GeometricObject): void {
    this.remove(obj.id);
    this.insert(obj);
  }

  /**
   * Obtener todas las celdas que ocupa un objeto
   */
  private getCellsForObject(obj: GeometricObject): Array<{ x: number; y: number }> {
    const cells: Array<{ x: number; y: number }> = [];
    const cellSize = this.config.cellSize;

    // Calcular bounding box del objeto
    const minX = Math.floor((obj.position.x - obj.radius) / cellSize);
    const maxX = Math.floor((obj.position.x + obj.radius) / cellSize);
    const minY = Math.floor((obj.position.y - obj.radius) / cellSize);
    const maxY = Math.floor((obj.position.y + obj.radius) / cellSize);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && y >= 0) {
          cells.push({ x, y });
        }
      }
    }

    return cells;
  }

  /**
   * Buscar objetos cercanos a una posición
   */
  getNearby(position: Point2D, searchRadius: number): GeometricObject[] {
    const cellCoord = this.getCellCoordinates(position);
    const cellsToSearch = Math.ceil(searchRadius / this.config.cellSize);
    const nearby: Set<string> = new Set();

    // Buscar en celdas cercanas
    for (let dy = -cellsToSearch; dy <= cellsToSearch; dy++) {
      for (let dx = -cellsToSearch; dx <= cellsToSearch; dx++) {
        const key = this.getCellKey(cellCoord.x + dx, cellCoord.y + dy);
        const cell = this.cells.get(key);

        if (cell) {
          for (const obj of cell.objects) {
            const dist = this.distance(position, obj.position);
            if (dist <= searchRadius + obj.radius) {
              nearby.add(obj.id);
            }
          }
        }
      }
    }

    return Array.from(nearby).map((id) => this.objects.get(id)!);
  }

  /**
   * Buscar objetos en un área rectangular
   */
  getInArea(minX: number, minY: number, maxX: number, maxY: number): GeometricObject[] {
    const result: Set<string> = new Set();

    const minCellX = Math.floor(minX / this.config.cellSize);
    const maxCellX = Math.floor(maxX / this.config.cellSize);
    const minCellY = Math.floor(minY / this.config.cellSize);
    const maxCellY = Math.floor(maxY / this.config.cellSize);

    for (let y = minCellY; y <= maxCellY; y++) {
      for (let x = minCellX; x <= maxCellX; x++) {
        const key = this.getCellKey(x, y);
        const cell = this.cells.get(key);

        if (cell) {
          for (const obj of cell.objects) {
            if (
              obj.position.x - obj.radius <= maxX &&
              obj.position.x + obj.radius >= minX &&
              obj.position.y - obj.radius <= maxY &&
              obj.position.y + obj.radius >= minY
            ) {
              result.add(obj.id);
            }
          }
        }
      }
    }

    return Array.from(result).map((id) => this.objects.get(id)!);
  }

  /**
   * Obtener todos los objetos
   */
  getAll(): GeometricObject[] {
    return Array.from(this.objects.values());
  }

  /**
   * Obtener objeto por ID
   */
  getById(id: string): GeometricObject | undefined {
    return this.objects.get(id);
  }

  /**
   * Limpiar grid
   */
  clear(): void {
    this.objects.clear();
    this.cells.forEach((cell) => {
      cell.objects = [];
    });
  }

  /**
   * Obtener estadísticas del grid
   */
  getStats() {
    let occupiedCells = 0;
    let totalObjectsInCells = 0;

    this.cells.forEach((cell) => {
      if (cell.objects.length > 0) {
        occupiedCells++;
        totalObjectsInCells += cell.objects.length;
      }
    });

    return {
      totalObjects: this.objects.size,
      totalCells: this.cells.size,
      occupiedCells,
      averageObjectsPerCell: occupiedCells > 0 ? totalObjectsInCells / occupiedCells : 0,
    };
  }

  /**
   * Calcular distancia entre dos puntos
   */
  private distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Factory para crear SpatialGrid
 */
export function createSpatialGrid(
  config: SpatialGridConfig,
  bounds: BoundingBox
): SpatialGrid {
  return new SpatialGridImpl(config, bounds);
}
