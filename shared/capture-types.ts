/**
 * ============================================================================
 * CAPTURE MODULE TYPES
 * ============================================================================
 * Types for WebAR capture, terrain detection, and measurements
 */

/**
 * 3D Point in space
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * 2D Point in screen space
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Measurement between two points
 */
export interface Measurement {
  id: string;
  pointA: Point3D;
  pointB: Point3D;
  distanceMeters: number;
  timestamp: number;
  confidence: number; // 0-1, based on LiDAR availability
}

/**
 * Terrain type classification
 */
export enum TerrainType {
  EARTH = "earth",
  GRASS = "grass",
  CONCRETE = "concrete",
  UNKNOWN = "unknown",
}

/**
 * Segmented pixel with terrain classification
 */
export interface SegmentedPixel {
  x: number;
  y: number;
  terrainType: TerrainType;
  confidence: number; // 0-1
}

/**
 * Terrain segmentation result
 */
export interface TerrainSegmentation {
  id: string;
  imageData: ImageData;
  segmentation: SegmentedPixel[];
  terrainCounts: Record<TerrainType, number>;
  timestamp: number;
}

/**
 * Polygon zone (collection of points)
 */
export interface Zone {
  id: string;
  points: Point3D[];
  terrainType: TerrainType;
  areaSquareMeters?: number;
  perimeter?: number;
}

/**
 * Complete capture session
 */
export interface CaptureSession {
  id: string;
  projectId: number;
  timestamp: number;
  
  // Camera and device info
  deviceModel: string; // "iPhone 12 Pro", "iPhone 13 Pro", etc.
  hasLiDAR: boolean;
  cameraType: "webxr" | "fallback";
  
  // Raw capture data
  originalImage: Blob;
  originalImageUrl: string;
  
  // Measurements
  measurements: Measurement[];
  
  // Terrain segmentation
  segmentation?: TerrainSegmentation;
  
  // Detected zones
  zones: Zone[];
  
  // Scale and calibration
  scaleMetersPerPixel?: number;
  calibrationPoints?: Point3D[];
}

/**
 * WebAR session state
 */
export interface ARSessionState {
  isSupported: boolean;
  isActive: boolean;
  hasLiDAR: boolean;
  error?: string;
  frameCount: number;
  fps: number;
}

/**
 * Capture mode
 */
export enum CaptureMode {
  MEASUREMENT = "measurement",
  TERRAIN_DETECTION = "terrain_detection",
  ZONE_DRAWING = "zone_drawing",
}

/**
 * Capture state
 */
export interface CaptureState {
  mode: CaptureMode;
  isCapturing: boolean;
  selectedPoints: Point3D[];
  currentMeasurements: Measurement[];
  detectedZones: Zone[];
  segmentation?: TerrainSegmentation;
  error?: string;
}

/**
 * Export format
 */
export enum ExportFormat {
  JSON = "json",
  GEOJSON = "geojson",
  CSV = "csv",
}

/**
 * Exported capture data
 */
export interface ExportedCaptureData {
  format: ExportFormat;
  data: string;
  mimeType: string;
  filename: string;
}

/**
 * Device capabilities
 */
export interface DeviceCapabilities {
  supportsWebXR: boolean;
  supportsLiDAR: boolean;
  supportsWebGL: boolean;
  maxTextureSize: number;
  devicePixelRatio: number;
  userAgent: string;
}

/**
 * ML Model inference result
 */
export interface MLInferenceResult {
  terrainType: TerrainType;
  confidence: number;
  processingTimeMs: number;
}

/**
 * Batch ML inference results
 */
export interface BatchMLResults {
  results: MLInferenceResult[];
  totalProcessingTimeMs: number;
  pixelsProcessed: number;
}
