import React, { useRef, useEffect, useState } from 'react';

interface AlgorithmToggleProps {
  leftLabel: string;
  rightLabel: string;
  middle1Label?: string;
  middle2Label?: string;
  middle3Label?: string;
  activeId: string;
  onToggle: (id: string) => void;
}

const AlgorithmToggle: React.FC<AlgorithmToggleProps> = ({
  leftLabel,
  rightLabel,
  middle1Label,
  middle2Label,
  middle3Label,
  activeId,
  onToggle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(12);

  const positions = [
    { id: 'left', label: leftLabel },
    { id: 'middle1', label: middle1Label },
    { id: 'middle2', label: middle2Label },
    { id: 'middle3', label: middle3Label },
    { id: 'right', label: rightLabel },
  ].filter((pos): pos is { id: string; label: string } =>
    pos.label !== undefined && pos.label !== ''
  );

  const totalPositions = positions.length;
  const activeIndex = positions.findIndex(pos => pos.id === activeId);
  const safeActiveIndex = activeIndex === -1 ? 0 : activeIndex;

  const maxLabelLength = Math.max(...positions.map(p => p.label.length));

  const getMinWidth = () => {
    const charWidth = 8;
    const padding = 24;
    const minWidthPerPosition = maxLabelLength * charWidth + padding;
    const totalMinWidth = totalPositions * minWidthPerPosition + (totalPositions - 1) * 2;
    return Math.max(200, totalMinWidth);
  };

  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const availableWidth = containerWidth / totalPositions;
      const padding = 16;
      const textWidth = availableWidth - padding;
      const calculatedSize = Math.min(14, Math.max(10, textWidth / (maxLabelLength * 0.6)));
      setFontSize(calculatedSize);
    }
  }, [maxLabelLength, totalPositions]);

  if (positions.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-flex bg-slate-200 rounded-full p-1"
      style={{
        minWidth: `${getMinWidth()}px`,
        maxWidth: '600px',
        width: '100%',
      }}
    >
      <div
        className="absolute top-0.5 bottom-0.5 bg-white rounded-full shadow-md transition-all duration-300 ease-in-out"
        style={{
          left: `calc(${safeActiveIndex * (100 / totalPositions)}% + 2px)`,
          width: `calc(${100 / totalPositions}% - 4px)`,
        }}
      />

      <div className="relative flex w-full" style={{ gap: '2px' }}>
        {positions.map((pos) => {
          const isActive = pos.id === activeId;
          return (
            <button
              key={pos.id}
              onClick={() => onToggle(pos.id)}
              className={`
                relative z-10 px-2 py-1 font-medium rounded-full
                transition-colors duration-200 whitespace-nowrap flex-1
                ${isActive
                  ? 'text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
                }
              `}
              style={{
                fontSize: `${fontSize}px`,
                minWidth: '40px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={pos.label}
            >
              {pos.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AlgorithmToggle;
