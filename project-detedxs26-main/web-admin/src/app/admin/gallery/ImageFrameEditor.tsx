"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Slider } from "antd";
import { AimOutlined } from "@ant-design/icons";

interface ImageFrameEditorProps {
  imageUrl: string;
  focalPoint: { x: number; y: number };
  zoom: number;
  onChange: (next: { focalPoint: { x: number; y: number }; zoom: number }) => void;
}

const MIN_RECOMMENDED_WIDTH = 800;
const MIN_RECOMMENDED_HEIGHT = 1000;

/**
 * Live preview of the fixed 3300x4200 (11:14) gallery poster frame. Drag
 * inside the frame to set the focal point (object-position), use the slider
 * to zoom 1x-2x. Only focalPoint/zoom are ever persisted — the source image
 * is never mutated or re-cropped.
 */
export default function ImageFrameEditor({
  imageUrl,
  focalPoint,
  zoom,
  onChange,
}: ImageFrameEditorProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setNaturalSize(null);
      setLoadFailed(false);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) {
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        setLoadFailed(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) setLoadFailed(true);
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      onChange({ focalPoint: { x, y }, zoom });
    },
    [onChange, zoom],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromPointer(e.clientX, e.clientY);
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const isLowRes =
    naturalSize !== null &&
    (naturalSize.w < MIN_RECOMMENDED_WIDTH || naturalSize.h < MIN_RECOMMENDED_HEIGHT);

  return (
    <div>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div
          ref={frameRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-[180px] shrink-0 cursor-crosshair overflow-hidden rounded-[10px] border border-gray-300 bg-gray-100"
          style={{ aspectRatio: "3300 / 4200" }}
        >
          {imageUrl && !loadFailed ? (
            // Plain <img>, not next/image: this preview needs raw
            // getBoundingClientRect-based coordinates and arbitrary,
            // admin-supplied URLs that next/image's loader isn't configured for.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              style={{
                objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%`,
                transform: `scale(${zoom})`,
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              {loadFailed ? "Couldn't load image" : "No image yet"}
            </div>
          )}
          {/* Focal point marker */}
          {imageUrl && !loadFailed && (
            <div
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              style={{ left: `${focalPoint.x * 100}%`, top: `${focalPoint.y * 100}%` }}
            />
          )}
        </div>

        <div className="w-full flex-1 space-y-3">
          <p className="text-xs text-gray-500">
            Drag inside the frame to set the focal point. This is exactly how
            the card will appear in the public strip.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Zoom ({zoom.toFixed(2)}x)
            </label>
            <Slider
              min={1}
              max={2}
              step={0.01}
              value={zoom}
              onChange={(v) => onChange({ focalPoint, zoom: v })}
            />
          </div>
          <Button
            size="small"
            icon={<AimOutlined />}
            onClick={() => onChange({ focalPoint: { x: 0.5, y: 0.5 }, zoom: 1 })}
          >
            Reset to center / cover
          </Button>
          {isLowRes && (
            <Alert
              type="warning"
              showIcon
              title={`Image is ${naturalSize!.w}×${naturalSize!.h}px — below the recommended ${MIN_RECOMMENDED_WIDTH}×${MIN_RECOMMENDED_HEIGHT}px minimum. It may look soft on larger screens.`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
