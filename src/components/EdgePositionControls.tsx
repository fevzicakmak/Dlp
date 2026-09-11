import React from 'react';
import { ArrowLeft, ArrowUp, Move3d } from 'lucide-react';
import { SceneObject } from '../types/cad';

type PositionAxis = 'x' | 'y' | 'z';
type DimensionAxis = 'width' | 'depth' | 'thickness';

interface EdgePositionControlsProps {
  object: SceneObject;
  onChange: (axis: PositionAxis, value: number) => void;
  onDimensionChange: (axis: DimensionAxis, value: number) => void;
}

const axisRange: Record<PositionAxis, { min: number; max: number }> = {
  x: { min: -3000, max: 3000 },
  y: { min: 0, max: 3000 },
  z: { min: -3000, max: 3000 },
};

const dimensionRange: Record<DimensionAxis, { min: number; max: number }> = {
  width: { min: 10, max: 3000 },
  depth: { min: 10, max: 1500 },
  thickness: { min: 1, max: 100 },
};

const clamp = (axis: PositionAxis, value: number) =>
  Math.max(axisRange[axis].min, Math.min(axisRange[axis].max, value));

const clampDimension = (axis: DimensionAxis, value: number) =>
  Math.max(dimensionRange[axis].min, Math.min(dimensionRange[axis].max, value));

export const EdgePositionControls: React.FC<EdgePositionControlsProps> = ({
  object,
  onChange,
  onDimensionChange,
}) => {
  const updatePosition = (axis: PositionAxis, value: number) => onChange(axis, clamp(axis, value));
  const updateDimension = (axis: DimensionAxis, value: number) => onDimensionChange(axis, clampDimension(axis, value));

  return (
    <div className="edge-position-controls pointer-events-none fixed inset-0 z-[35] select-none" aria-label="Seçili nesne konum kontrolleri">
      <div className="edge-rail edge-rail-left pointer-events-auto">
        <div className="edge-rail-label"><ArrowLeft className="h-3 w-3" /> X</div>
        <input
          aria-label="Seçili nesne sağa sola konumu"
          type="range"
          min={axisRange.x.min}
          max={axisRange.x.max}
          step={1}
          value={clamp('x', object.position.x)}
          onChange={(event) => updatePosition('x', Number(event.target.value))}
        />
        <div className="edge-rail-hint"><span>Sol</span><span>Sağ</span></div>
      </div>

      <div className="edge-rail edge-rail-right pointer-events-auto">
        <div className="edge-rail-label"><Move3d className="h-3 w-3" /> Z</div>
        <input
          aria-label="Seçili nesne ileri geri konumu"
          type="range"
          min={axisRange.z.min}
          max={axisRange.z.max}
          step={1}
          value={clamp('z', object.position.z)}
          onChange={(event) => updatePosition('z', Number(event.target.value))}
        />
        <div className="edge-rail-hint"><span>Geri</span><span>İleri</span></div>
      </div>

      <div className="edge-rail edge-rail-top pointer-events-auto">
        <div className="edge-dimension-group">
          <label><span>Genişlik</span><input aria-label="Seçili nesne genişliği" type="range" min={dimensionRange.width.min} max={dimensionRange.width.max} step={1} value={clampDimension('width', object.dimensions.width)} onChange={(event) => updateDimension('width', Number(event.target.value))} /></label>
          <label><span>Derinlik</span><input aria-label="Seçili nesne derinliği" type="range" min={dimensionRange.depth.min} max={dimensionRange.depth.max} step={1} value={clampDimension('depth', object.dimensions.depth)} onChange={(event) => updateDimension('depth', Number(event.target.value))} /></label>
          <label><span>Kalınlık</span><input aria-label="Seçili nesne kalınlığı" type="range" min={dimensionRange.thickness.min} max={dimensionRange.thickness.max} step={1} value={clampDimension('thickness', object.dimensions.thickness)} onChange={(event) => updateDimension('thickness', Number(event.target.value))} /></label>
        </div>
      </div>

      <div className="edge-rail edge-rail-bottom pointer-events-auto">
        <div className="edge-rail-label"><ArrowUp className="h-3 w-3" /> Y Yukarı / Aşağı</div>
        <input
          aria-label="Seçili nesne yukarı aşağı konumu"
          type="range"
          min={axisRange.y.min}
          max={axisRange.y.max}
          step={1}
          value={clamp('y', object.position.y)}
          onChange={(event) => updatePosition('y', Number(event.target.value))}
        />
        <div className="edge-rail-hint"><span>Aşağı</span><span>Yukarı</span></div>
      </div>
    </div>
  );
};
