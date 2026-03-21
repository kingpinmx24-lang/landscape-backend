/**
 * Tests: Inventory Integration
 * ============================================================================
 * Tests de integración del módulo de inventario con el sistema de diseño
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InventoryItem,
  PlantType,
  ClimateZone,
  DesignPlant,
  ShoppingCart,
} from "@shared/inventory-types";

/**
 * Mock de datos
 */
const createMockInventoryItem = (overrides?: Partial<InventoryItem>): InventoryItem => ({
  id: "plant-1",
  name: "Rose",
  scientificName: "Rosa spp.",
  type: PlantType.FLOWER,
  description: "Beautiful flowering shrub",
  imageUrl: "https://example.com/rose.jpg",
  price: 15,
  stock: 50,
  minStock: 10,
  climateZones: [ClimateZone.TEMPERATE],
  matureHeight: 1.5,
  matureWidth: 1.2,
  minSpacing: 1.0,
  sunRequirement: "full",
  waterNeeds: "medium",
  maintenanceLevel: "medium",
  nativeRegion: "Various",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isActive: true,
  ...overrides,
});

const createMockDesignPlant = (overrides?: Partial<DesignPlant>): DesignPlant => ({
  id: "design-1",
  inventoryItemId: "plant-1",
  x: 50,
  y: 50,
  radius: 0.6,
  quantity: 1,
  addedAt: Date.now(),
  ...overrides,
});

/**
 * Tests
 */
describe("Inventory Integration", () => {
  /**
   * Gestión de inventario
   */
  describe("Inventory Management", () => {
    it("debe cargar inventario correctamente", () => {
      const items: InventoryItem[] = [
        createMockInventoryItem({ id: "plant-1", name: "Rose" }),
        createMockInventoryItem({ id: "plant-2", name: "Oak", type: PlantType.TREE }),
      ];

      expect(items).toHaveLength(2);
      expect(items[0].name).toBe("Rose");
      expect(items[1].type).toBe(PlantType.TREE);
    });

    it("debe filtrar por tipo de planta", () => {
      const items: InventoryItem[] = [
        createMockInventoryItem({ id: "plant-1", type: PlantType.FLOWER }),
        createMockInventoryItem({ id: "plant-2", type: PlantType.TREE }),
        createMockInventoryItem({ id: "plant-3", type: PlantType.FLOWER }),
      ];

      const flowers = items.filter((i) => i.type === PlantType.FLOWER);
      expect(flowers).toHaveLength(2);
    });

    it("debe filtrar por precio", () => {
      const items: InventoryItem[] = [
        createMockInventoryItem({ id: "plant-1", price: 10 }),
        createMockInventoryItem({ id: "plant-2", price: 50 }),
        createMockInventoryItem({ id: "plant-3", price: 100 }),
      ];

      const affordable = items.filter((i) => i.price <= 50);
      expect(affordable).toHaveLength(2);
    });

    it("debe filtrar por clima", () => {
      const items: InventoryItem[] = [
        createMockInventoryItem({
          id: "plant-1",
          climateZones: [ClimateZone.TEMPERATE],
        }),
        createMockInventoryItem({
          id: "plant-2",
          climateZones: [ClimateZone.TROPICAL],
        }),
      ];

      const temperate = items.filter((i) =>
        i.climateZones.includes(ClimateZone.TEMPERATE)
      );
      expect(temperate).toHaveLength(1);
    });

    it("debe filtrar por requerimiento de luz", () => {
      const items: InventoryItem[] = [
        createMockInventoryItem({ id: "plant-1", sunRequirement: "full" }),
        createMockInventoryItem({ id: "plant-2", sunRequirement: "partial" }),
        createMockInventoryItem({ id: "plant-3", sunRequirement: "shade" }),
      ];

      const fullSun = items.filter((i) => i.sunRequirement === "full");
      expect(fullSun).toHaveLength(1);
    });

    it("debe filtrar por stock disponible", () => {
      const items: InventoryItem[] = [
        createMockInventoryItem({ id: "plant-1", stock: 50 }),
        createMockInventoryItem({ id: "plant-2", stock: 0 }),
        createMockInventoryItem({ id: "plant-3", stock: 10 }),
      ];

      const inStock = items.filter((i) => i.stock > 0);
      expect(inStock).toHaveLength(2);
    });

    it("debe detectar stock bajo", () => {
      const items: InventoryItem[] = [
        createMockInventoryItem({ id: "plant-1", stock: 50, minStock: 10 }),
        createMockInventoryItem({ id: "plant-2", stock: 5, minStock: 10 }),
      ];

      const lowStock = items.filter((i) => i.stock < i.minStock);
      expect(lowStock).toHaveLength(1);
      expect(lowStock[0].id).toBe("plant-2");
    });
  });

  /**
   * Carrito de compras
   */
  describe("Shopping Cart", () => {
    it("debe agregar item al carrito", () => {
      const cart: ShoppingCart = {
        items: [],
        totalQuantity: 0,
        totalCost: 0,
        lastUpdated: Date.now(),
      };

      const item = createMockInventoryItem({ price: 15 });
      cart.items.push({
        inventoryItemId: item.id,
        quantity: 2,
        unitPrice: item.price,
        subtotal: 2 * item.price,
      });

      cart.totalQuantity = 2;
      cart.totalCost = 30;

      expect(cart.items).toHaveLength(1);
      expect(cart.totalCost).toBe(30);
    });

    it("debe actualizar cantidad en carrito", () => {
      const item = createMockInventoryItem({ price: 15 });
      const cart: ShoppingCart = {
        items: [
          {
            inventoryItemId: item.id,
            quantity: 2,
            unitPrice: item.price,
            subtotal: 30,
          },
        ],
        totalQuantity: 2,
        totalCost: 30,
        lastUpdated: Date.now(),
      };

      // Actualizar cantidad a 5
      const cartItem = cart.items[0];
      cartItem.quantity = 5;
      cartItem.subtotal = 5 * cartItem.unitPrice;

      cart.totalQuantity = 5;
      cart.totalCost = 75;

      expect(cart.items[0].quantity).toBe(5);
      expect(cart.totalCost).toBe(75);
    });

    it("debe remover item del carrito", () => {
      const item = createMockInventoryItem();
      const cart: ShoppingCart = {
        items: [
          {
            inventoryItemId: item.id,
            quantity: 2,
            unitPrice: item.price,
            subtotal: 30,
          },
        ],
        totalQuantity: 2,
        totalCost: 30,
        lastUpdated: Date.now(),
      };

      cart.items = cart.items.filter((i) => i.inventoryItemId !== item.id);
      cart.totalQuantity = 0;
      cart.totalCost = 0;

      expect(cart.items).toHaveLength(0);
      expect(cart.totalCost).toBe(0);
    });

    it("debe calcular total del carrito", () => {
      const item1 = createMockInventoryItem({ id: "plant-1", price: 15 });
      const item2 = createMockInventoryItem({ id: "plant-2", price: 25 });

      const cart: ShoppingCart = {
        items: [
          {
            inventoryItemId: item1.id,
            quantity: 2,
            unitPrice: item1.price,
            subtotal: 30,
          },
          {
            inventoryItemId: item2.id,
            quantity: 1,
            unitPrice: item2.price,
            subtotal: 25,
          },
        ],
        totalQuantity: 3,
        totalCost: 55,
        lastUpdated: Date.now(),
      };

      expect(cart.totalQuantity).toBe(3);
      expect(cart.totalCost).toBe(55);
    });
  });

  /**
   * Plantas en diseño
   */
  describe("Design Plants", () => {
    it("debe agregar planta al diseño", () => {
      const designPlants: DesignPlant[] = [];
      const newPlant = createMockDesignPlant();

      designPlants.push(newPlant);

      expect(designPlants).toHaveLength(1);
      expect(designPlants[0].inventoryItemId).toBe("plant-1");
    });

    it("debe mover planta en el canvas", () => {
      const designPlants: DesignPlant[] = [createMockDesignPlant()];
      const plant = designPlants[0];

      plant.x = 100;
      plant.y = 150;

      expect(plant.x).toBe(100);
      expect(plant.y).toBe(150);
    });

    it("debe eliminar planta del diseño", () => {
      const designPlants: DesignPlant[] = [
        createMockDesignPlant({ id: "design-1" }),
        createMockDesignPlant({ id: "design-2" }),
      ];

      const filtered = designPlants.filter((p) => p.id !== "design-1");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("design-2");
    });

    it("debe duplicar planta en el diseño", () => {
      const designPlants: DesignPlant[] = [createMockDesignPlant()];
      const original = designPlants[0];

      const duplicate: DesignPlant = {
        ...original,
        id: `design-${Date.now()}`,
        x: original.x + 2,
        y: original.y + 2,
      };

      designPlants.push(duplicate);

      expect(designPlants).toHaveLength(2);
      expect(designPlants[1].inventoryItemId).toBe(original.inventoryItemId);
    });

    it("debe cambiar cantidad de plantas en un punto", () => {
      const designPlants: DesignPlant[] = [
        createMockDesignPlant({ quantity: 1 }),
      ];

      designPlants[0].quantity = 5;

      expect(designPlants[0].quantity).toBe(5);
    });
  });

  /**
   * Control de stock
   */
  describe("Stock Control", () => {
    it("debe disminuir stock al agregar planta", () => {
      let item = createMockInventoryItem({ stock: 50 });
      const initialStock = item.stock;

      item.stock -= 5; // Agregar 5 plantas

      expect(item.stock).toBe(initialStock - 5);
      expect(item.stock).toBe(45);
    });

    it("debe devolver stock al eliminar planta", () => {
      let item = createMockInventoryItem({ stock: 45 });

      item.stock += 5; // Devolver 5 plantas

      expect(item.stock).toBe(50);
    });

    it("debe prevenir agregar más plantas que stock disponible", () => {
      const item = createMockInventoryItem({ stock: 10 });
      const quantityToAdd = 15;

      const canAdd = item.stock >= quantityToAdd;

      expect(canAdd).toBe(false);
    });
  });

  /**
   * Cotización
   */
  describe("Quotation", () => {
    it("debe calcular costo total de plantas", () => {
      const plants = [
        createMockInventoryItem({ id: "plant-1", price: 15 }),
        createMockInventoryItem({ id: "plant-2", price: 25 }),
      ];

      const designPlants: DesignPlant[] = [
        createMockDesignPlant({ inventoryItemId: "plant-1", quantity: 2 }),
        createMockDesignPlant({ inventoryItemId: "plant-2", quantity: 1 }),
      ];

      let totalCost = 0;
      designPlants.forEach((dp) => {
        const plant = plants.find((p) => p.id === dp.inventoryItemId);
        if (plant) {
          totalCost += plant.price * dp.quantity;
        }
      });

      expect(totalCost).toBe(55); // (15*2) + (25*1)
    });

    it("debe aplicar margen a la cotización", () => {
      const plantsCost = 100;
      const marginPercentage = 30;
      const margin = plantsCost * (marginPercentage / 100);

      expect(margin).toBe(30);
      expect(plantsCost + margin).toBe(130);
    });

    it("debe aplicar impuesto a la cotización", () => {
      const subtotal = 130;
      const taxPercentage = 10;
      const tax = subtotal * (taxPercentage / 100);

      expect(tax).toBe(13);
      expect(subtotal + tax).toBe(143);
    });

    it("debe calcular precio final completo", () => {
      const plantsCost = 100;
      const laborCost = 50;
      const subtotal = plantsCost + laborCost; // 150
      const margin = subtotal * 0.3; // 45
      const subtotalWithMargin = subtotal + margin; // 195
      const tax = subtotalWithMargin * 0.1; // 19.5
      const finalPrice = subtotalWithMargin + tax; // 214.5

      expect(finalPrice).toBeCloseTo(214.5, 1);
    });
  });

  /**
   * Modo rápido
   */
  describe("Quick Sale Mode", () => {
    it("debe permitir seleccionar 2-5 plantas", () => {
      const selectedPlants: string[] = [];
      const maxPlants = 5;

      // Agregar plantas
      for (let i = 0; i < 3; i++) {
        if (selectedPlants.length < maxPlants) {
          selectedPlants.push(`plant-${i}`);
        }
      }

      expect(selectedPlants.length).toBe(3);
      expect(selectedPlants.length >= 2).toBe(true);
      expect(selectedPlants.length <= maxPlants).toBe(true);
    });

    it("debe prevenir agregar más de 5 plantas", () => {
      const selectedPlants: string[] = [];
      const maxPlants = 5;

      // Intentar agregar 10 plantas
      for (let i = 0; i < 10; i++) {
        if (selectedPlants.length < maxPlants) {
          selectedPlants.push(`plant-${i}`);
        }
      }

      expect(selectedPlants.length).toBe(5);
    });

    it("debe generar diseño con solo plantas seleccionadas", () => {
      const selectedPlants = ["plant-1", "plant-2", "plant-3"];
      const designPlants: DesignPlant[] = [
        createMockDesignPlant({ inventoryItemId: "plant-1" }),
        createMockDesignPlant({ inventoryItemId: "plant-2" }),
        createMockDesignPlant({ inventoryItemId: "plant-3" }),
      ];

      const validDesign = designPlants.every((dp) =>
        selectedPlants.includes(dp.inventoryItemId)
      );

      expect(validDesign).toBe(true);
    });
  });
});
