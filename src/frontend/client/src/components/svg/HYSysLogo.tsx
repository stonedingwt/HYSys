import React from 'react';

interface HYSysLogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon' | 'text';
}

export default function HYSysLogo({ size = 32, className = '', variant = 'icon' }: HYSysLogoProps) {
  if (variant === 'text') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <LogoIcon size={size} />
        <span
          className="font-display font-bold tracking-tight text-slate-900 dark:text-slate-100"
          style={{ fontSize: size * 0.625 }}
        >
          HYSys
        </span>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <LogoIcon size={size} />
        <div className="flex flex-col">
          <span
            className="font-display font-bold tracking-tight leading-none text-slate-900 dark:text-slate-100"
            style={{ fontSize: size * 0.5 }}
          >
            HYSys
          </span>
          <span
            className="text-slate-400 dark:text-slate-500 leading-none mt-0.5"
            style={{ fontSize: size * 0.25 }}
          >
            AI Maritime
          </span>
        </div>
      </div>
    );
  }

  return <LogoIcon size={size} className={className} />;
}

function LogoIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="nodeGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      {/* Hexagon shell */}
      <path
        d="M24 3L42.186 13.5V34.5L24 45L5.814 34.5V13.5L24 3Z"
        fill="url(#logoGrad)"
        fillOpacity="0.1"
        stroke="url(#logoGrad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Compass needle - pointing north */}
      <path
        d="M24 12L27 24L24 36L21 24L24 12Z"
        fill="url(#logoGrad)"
        fillOpacity="0.8"
      />
      {/* Compass cross arms */}
      <line x1="16" y1="24" x2="32" y2="24" stroke="url(#logoGrad)" strokeWidth="1.5" strokeOpacity="0.4" />
      {/* AI neural nodes */}
      <circle cx="24" cy="12" r="2.5" fill="url(#nodeGrad)" />
      <circle cx="24" cy="36" r="2" fill="url(#nodeGrad)" fillOpacity="0.6" />
      <circle cx="14" cy="18" r="1.5" fill="url(#nodeGrad)" fillOpacity="0.5" />
      <circle cx="34" cy="18" r="1.5" fill="url(#nodeGrad)" fillOpacity="0.5" />
      <circle cx="14" cy="30" r="1.5" fill="url(#nodeGrad)" fillOpacity="0.4" />
      <circle cx="34" cy="30" r="1.5" fill="url(#nodeGrad)" fillOpacity="0.4" />
      {/* Neural connections */}
      <line x1="24" y1="12" x2="14" y2="18" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.3" />
      <line x1="24" y1="12" x2="34" y2="18" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.3" />
      <line x1="14" y1="30" x2="24" y2="36" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.3" />
      <line x1="34" y1="30" x2="24" y2="36" stroke="#38BDF8" strokeWidth="0.75" strokeOpacity="0.3" />
      {/* Center dot */}
      <circle cx="24" cy="24" r="3" fill="url(#nodeGrad)" />
      <circle cx="24" cy="24" r="1.5" fill="white" />
    </svg>
  );
}
