/**
 * ============================================================================
 * RESPONSE HELPERS
 * ============================================================================
 * Standardized response format for all API endpoints
 * 
 * REGLA CRÍTICA: Todos los endpoints deben usar este formato:
 * {
 *   "success": true/false,
 *   "data": {...} o null,
 *   "error": null o "mensaje claro"
 * }
 */

/**
 * Tipo de respuesta exitosa
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  error: null;
}

/**
 * Tipo de respuesta de error
 */
export interface ErrorResponse {
  success: false;
  data: null;
  error: string;
}

/**
 * Tipo de respuesta genérica
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Crear respuesta exitosa
 * @param data - Datos a retornar
 * @returns Respuesta estructurada
 * 
 * @example
 * return successResponse({ projectId: 123 });
 */
export function successResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    error: null,
  };
}

/**
 * Crear respuesta de error
 * @param message - Mensaje de error claro
 * @returns Respuesta de error estructurada
 * 
 * @example
 * return errorResponse("Project not found");
 */
export function errorResponse(message: string): ErrorResponse {
  return {
    success: false,
    data: null,
    error: message,
  };
}

/**
 * Procesar resultado de query y retornar respuesta estructurada
 * @param result - Resultado de operación
 * @param successMessage - Mensaje de éxito (opcional)
 * @returns Respuesta estructurada
 * 
 * @example
 * const result = await createProject(...);
 * return handleQueryResult(result, "Project created successfully");
 */
export function handleQueryResult<T>(
  result: { success: boolean; error?: string; [key: string]: any },
  successMessage?: string
): ApiResponse<T> {
  if (result.success) {
    const { success, error, ...data } = result;
    return successResponse(data as T);
  }
  return errorResponse(result.error || "Operation failed");
}

/**
 * Wrapper para operaciones async con manejo automático de errores
 * @param operation - Función async a ejecutar
 * @returns Respuesta estructurada
 * 
 * @example
 * return asyncHandler(async () => {
 *   const project = await getProjectById(id);
 *   return { projectId: project.id };
 * });
 */
export async function asyncHandler<T>(
  operation: () => Promise<T>
): Promise<ApiResponse<T>> {
  try {
    const data = await operation();
    return successResponse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[asyncHandler] Error:", message);
    return errorResponse(message);
  }
}

/**
 * Validar que los datos requeridos estén presentes
 * @param data - Objeto a validar
 * @param requiredFields - Campos requeridos
 * @returns Error si falta algún campo, null si todo está bien
 * 
 * @example
 * const error = validateRequired({ name: "Test" }, ["name", "description"]);
 * if (error) return errorResponse(error);
 */
export function validateRequired(
  data: Record<string, any>,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (!data[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Validar que un valor sea de un tipo específico
 * @param value - Valor a validar
 * @param type - Tipo esperado
 * @param fieldName - Nombre del campo (para mensaje de error)
 * @returns Error si el tipo no coincide, null si está bien
 * 
 * @example
 * const error = validateType(123, "number", "projectId");
 * if (error) return errorResponse(error);
 */
export function validateType(
  value: any,
  type: string,
  fieldName: string
): string | null {
  if (typeof value !== type) {
    return `Invalid type for ${fieldName}: expected ${type}, got ${typeof value}`;
  }
  return null;
}

/**
 * Validar que un número esté dentro de un rango
 * @param value - Valor a validar
 * @param min - Valor mínimo
 * @param max - Valor máximo
 * @param fieldName - Nombre del campo
 * @returns Error si está fuera de rango, null si está bien
 * 
 * @example
 * const error = validateRange(50, 0, 100, "progress");
 * if (error) return errorResponse(error);
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): string | null {
  if (value < min || value > max) {
    return `${fieldName} must be between ${min} and ${max}, got ${value}`;
  }
  return null;
}

/**
 * Validar que un string cumpla con un patrón regex
 * @param value - Valor a validar
 * @param pattern - Patrón regex
 * @param fieldName - Nombre del campo
 * @returns Error si no coincide, null si está bien
 * 
 * @example
 * const error = validatePattern(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, "email");
 * if (error) return errorResponse(error);
 */
export function validatePattern(
  value: string,
  pattern: RegExp,
  fieldName: string
): string | null {
  if (!pattern.test(value)) {
    return `Invalid format for ${fieldName}`;
  }
  return null;
}

/**
 * Combinar múltiples validaciones
 * @param validations - Array de errores o null
 * @returns Primer error encontrado o null
 * 
 * @example
 * const error = combineValidations([
 *   validateRequired(data, ["name"]),
 *   validateType(data.id, "number", "id"),
 *   validateRange(data.progress, 0, 100, "progress")
 * ]);
 * if (error) return errorResponse(error);
 */
export function combineValidations(validations: (string | null)[]): string | null {
  for (const validation of validations) {
    if (validation) return validation;
  }
  return null;
}
