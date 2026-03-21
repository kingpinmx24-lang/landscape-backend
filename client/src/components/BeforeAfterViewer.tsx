/**
 * ============================================================================
 * BEFORE/AFTER VIEWER COMPONENT
 * ============================================================================
 * Side-by-side comparison with slider for design visualization
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import type { RenderConfig } from "@shared/visualization-types";
import DesignCanvas from "./DesignCanvas";

interface BeforeAfterViewerProps {
  beforeConfig: RenderConfig;
  afterConfig: RenderConfig;
  onInteraction?: (type: string, data: any) => void;
  fullscreen?: boolean;
  optimizeForIPad?: boolean;
}

export const BeforeAfterViewer: React.FC<BeforeAfterViewerProps> = ({
  beforeConfig,
  afterConfig,
  onInteraction,
  fullscreen = false,
  optimizeForIPad = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  /**
   * Manejar movimiento del slider
   */
  const handleSliderMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let clientX: number;

      if (e instanceof TouchEvent) {
        clientX = e.touches[0]?.clientX || 0;
      } else {
        clientX = e.clientX;
      }

      const x = clientX - rect.left;
      const newPosition = Math.max(0, Math.min(100, (x / rect.width) * 100));

      setSliderPosition(newPosition);
      onInteraction?.("slider", { position: newPosition });
    },
    []
  );

  /**
   * Manejar mouse down en slider
   */
  const handleSliderMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  /**
   * Manejar mouse up
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Manejar movimiento del ratón
   */
  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener("mousemove", handleSliderMove);
    document.addEventListener("touchmove", handleSliderMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleSliderMove);
      document.removeEventListener("touchmove", handleSliderMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleSliderMove, handleMouseUp]);

  /**
   * Manejar clic en contenedor
   */
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newPosition = (x / rect.width) * 100;

      setSliderPosition(newPosition);
      onInteraction?.("slider", { position: newPosition });
    },
    []
  );

  /**
   * Manejar resize
   */
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      style={{
        position: "relative",
        width: fullscreen ? "100vw" : "100%",
        height: fullscreen ? "100vh" : "100%",
        overflow: "hidden",
        backgroundColor: "#f5f5f5",
        userSelect: "none",
      }}
    >
      {/* BEFORE Canvas */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <DesignCanvas
          config={beforeConfig}
          onInteraction={onInteraction}
          fullscreen={fullscreen}
          optimizeForIPad={optimizeForIPad}
        />
      </div>

      {/* AFTER Canvas (clipped) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${sliderPosition}%`,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: containerWidth > 0 ? `${(100 / sliderPosition) * 100}%` : "100%",
            height: "100%",
          }}
        >
          <DesignCanvas
            config={afterConfig}
            onInteraction={onInteraction}
            fullscreen={fullscreen}
            optimizeForIPad={optimizeForIPad}
          />
        </div>
      </div>

      {/* Slider */}
      <div
        ref={sliderRef}
        onMouseDown={handleSliderMouseDown}
        onTouchStart={handleSliderMouseDown}
        style={{
          position: "absolute",
          top: 0,
          left: `${sliderPosition}%`,
          width: "4px",
          height: "100%",
          backgroundColor: "#fff",
          cursor: "col-resize",
          zIndex: 10,
          transform: "translateX(-50%)",
          boxShadow: "0 0 10px rgba(0, 0, 0, 0.3)",
          transition: isDragging ? "none" : "left 0.2s ease-out",
        }}
      >
        {/* Slider Handle */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "50px",
            height: "50px",
            backgroundColor: "#fff",
            borderRadius: "50%",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Arrows */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              color: "#666",
              fontSize: "16px",
            }}
          >
            <span>‹</span>
            <span>›</span>
          </div>
        </div>
      </div>

      {/* BEFORE Label */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: "4px",
          fontSize: "14px",
          fontWeight: "600",
          zIndex: 5,
        }}
      >
        BEFORE
      </div>

      {/* AFTER Label */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: "4px",
          fontSize: "14px",
          fontWeight: "600",
          zIndex: 5,
        }}
      >
        AFTER
      </div>

      {/* Position Indicator */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: "4px",
          fontSize: "12px",
          zIndex: 5,
        }}
      >
        {sliderPosition.toFixed(0)}%
      </div>
    </div>
  );
};

export default BeforeAfterViewer;
