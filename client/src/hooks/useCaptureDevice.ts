import { useEffect, useState } from "react";
import type { DeviceCapabilities, ARSessionState } from "../../../shared/capture-types";

// Extend Navigator with WebXR support
declare global {
  interface Navigator {
    xr?: XRSystem;
  }
}

interface XRSystem {
  isSessionSupported(mode: string): Promise<boolean>;
}

/**
 * Hook para detectar capacidades del dispositivo y soporte de WebAR
 */
export function useCaptureDevice() {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [arState, setArState] = useState<ARSessionState>({
    isSupported: false,
    isActive: false,
    hasLiDAR: false,
    frameCount: 0,
    fps: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function detectCapabilities() {
      try {
        // Detect WebGL support
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") || canvas.getContext("webgl2");
        const supportsWebGL = !!gl;

        // Get max texture size
        let maxTextureSize = 2048;
        if (gl) {
          maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        }

        // Detect WebXR support
        let supportsWebXR = false;
        try {
          if (navigator.xr) {
            supportsWebXR = await (navigator.xr as XRSystem).isSessionSupported("immersive-ar");
          }
        } catch {
          supportsWebXR = false;
        }

        // Detect LiDAR (iPhone 12 Pro and later)
        const hasLiDAR = await detectLiDAR();

        // Get device info
        const userAgent = navigator.userAgent;
        const devicePixelRatio = window.devicePixelRatio || 1;

        const caps: DeviceCapabilities = {
          supportsWebXR,
          supportsLiDAR: hasLiDAR,
          supportsWebGL,
          maxTextureSize,
          devicePixelRatio,
          userAgent,
        };

        setCapabilities(caps);

        // Update AR state
        setArState((prev) => ({
          ...prev,
          isSupported: supportsWebXR,
          hasLiDAR,
        }));

        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setLoading(false);
      }
    }

    detectCapabilities();
  }, []);

  return {
    capabilities,
    arState,
    loading,
    error,
    isARSupported: arState.isSupported,
    hasLiDAR: arState.hasLiDAR,
  };
}

/**
 * Detectar si el dispositivo tiene LiDAR
 * (iPhone 12 Pro, 13 Pro, 14 Pro, 15 Pro)
 */
async function detectLiDAR(): Promise<boolean> {
  try {
    // Check if WebXR is supported
    if (!navigator.xr) {
      return false;
    }

    // Try to get AR session with depth sensing
    let supported = false;
    try {
      supported = await (navigator.xr as XRSystem).isSessionSupported("immersive-ar");
    } catch {
      supported = false;
    }

    if (!supported) {
      return false;
    }

    // Check user agent for iPhone Pro models with LiDAR
    const userAgent = navigator.userAgent;
    const hasProModel = /iPhone1[2-5],3/.test(userAgent); // iPhone 12-15 Pro

    // Additional check: try to access depth data
    // This would require an actual AR session, so we use heuristics instead
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isModernIOS = /OS (1[5-9]|[2-9]\d)_/.test(userAgent);

    return isIOS && isModernIOS && hasProModel;
  } catch {
    return false;
  }
}

/**
 * Get device model name from user agent
 */
export function getDeviceModel(): string {
  const userAgent = navigator.userAgent;

  // iPhone models
  if (/iPhone15,3/.test(userAgent)) return "iPhone 15 Pro";
  if (/iPhone15,2/.test(userAgent)) return "iPhone 15 Pro Max";
  if (/iPhone14,3/.test(userAgent)) return "iPhone 14 Pro";
  if (/iPhone14,2/.test(userAgent)) return "iPhone 14 Pro Max";
  if (/iPhone13,3/.test(userAgent)) return "iPhone 13 Pro";
  if (/iPhone13,4/.test(userAgent)) return "iPhone 13 Pro Max";
  if (/iPhone12,3/.test(userAgent)) return "iPhone 12 Pro";
  if (/iPhone12,4/.test(userAgent)) return "iPhone 12 Pro Max";

  // iPad models
  if (/iPad Pro/.test(userAgent)) return "iPad Pro";
  if (/iPad Air/.test(userAgent)) return "iPad Air";
  if (/iPad/.test(userAgent)) return "iPad";

  // Generic device
  if (/iPhone/.test(userAgent)) return "iPhone";
  if (/iPad/.test(userAgent)) return "iPad";
  if (/Android/.test(userAgent)) return "Android Device";

  return "Unknown Device";
}

/**
 * Check if device is iPad
 */
export function isIPad(): boolean {
  const userAgent = navigator.userAgent;
  return /iPad/.test(userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
}

/**
 * Check if device is iPhone
 */
export function isIPhone(): boolean {
  const userAgent = navigator.userAgent;
  return /iPhone/.test(userAgent);
}

/**
 * Check if browser is Safari
 */
export function isSafari(): boolean {
  const userAgent = navigator.userAgent;
  return /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
}

/**
 * Get iOS version
 */
export function getIOSVersion(): number | null {
  const userAgent = navigator.userAgent;
  const match = userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if device supports depth sensing (LiDAR)
 */
export function supportsDepthSensing(): boolean {
  const userAgent = navigator.userAgent;
  // iPhone 12 Pro and later, iPad Pro with LiDAR
  return /iPhone1[2-5],3|iPad.*Pro/.test(userAgent);
}
