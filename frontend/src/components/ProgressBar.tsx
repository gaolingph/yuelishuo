import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercent?: boolean;
  color?: 'primary' | 'accent' | 'green' | 'amber';
  size?: 'sm' | 'md';
}

const colorMap = {
  primary: 'bg-primary-500',
  accent: 'bg-accent-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
};

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  label,
  showPercent = true,
  color = 'primary',
  size = 'md',
}) => {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-gray-600">{label}</span>}
          {showPercent && <span className="text-sm font-medium text-gray-700">{percent}%</span>}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${size === 'sm' ? 'h-2' : 'h-3'}`}>
        <div
          className={`progress-bar ${colorMap[color]} ${size === 'sm' ? 'h-2' : 'h-3'} rounded-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
