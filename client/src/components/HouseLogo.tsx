import React, { useState } from 'react';

interface HouseLogoProps {
  name?: string;
  color?: string;
  icon?: string;
  className?: string;
  imgClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function getHouseLogo(name?: string, icon?: string): string {
  const n = (name || icon || '').toLowerCase();
  if (n.includes('aakash') || n.includes('sky')) return '/houses/house-aakash.png';
  if (n.includes('agni') || n.includes('fire')) return '/houses/house-agni.png';
  if (n.includes('jal') || n.includes('water')) return '/houses/house-jal.png';
  if (n.includes('prudhvi') || n.includes('earth')) return '/houses/house-prudhvi.png';
  if (n.includes('vayu') || n.includes('air') || n.includes('wind')) return '/houses/house-vayu.png';
  return '/houses/house-aakash.png';
}

export const HouseLogo: React.FC<HouseLogoProps> = ({
  name = '',
  color = '#6366f1',
  icon = '',
  className = '',
  imgClassName = '',
  size = 'md'
}) => {
  const [imgError, setImgError] = useState(false);
  const logoUrl = getHouseLogo(name, icon);

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-11 h-11 sm:w-12 sm:h-12 text-base',
    lg: 'w-16 h-16 sm:w-20 sm:h-20 text-2xl',
    xl: 'w-20 h-20 sm:w-24 sm:h-24 text-3xl'
  }[size];

  return (
    <div 
      className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 border shadow-md relative bg-black/40 transition-transform ${sizeClasses} ${className}`}
      style={{ borderColor: color || 'rgba(255,255,255,0.2)', backgroundColor: `${color || '#6366f1'}20` }}
    >
      {!imgError ? (
        <img 
          src={logoUrl} 
          alt={name || 'House Logo'} 
          className={`w-full h-full object-cover rounded-full select-none ${imgClassName}`}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <span className="font-display font-black text-white" style={{ color: color || '#fff' }}>
          {name ? name.replace(/^House\s*/i, '').charAt(0) : 'H'}
        </span>
      )}
    </div>
  );
};
