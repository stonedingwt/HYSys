import { memo, useEffect, useId, useState } from 'react';

const SAILE_LABELS = [
  '正在理解您的问题…',
  '正在检索相关数据…',
  '正在分析并整理结果…',
  '即将为您呈现回复…',
];

const TASK_LABELS = [
  '正在处理任务…',
  '正在执行操作步骤…',
  '正在整合处理结果…',
  '即将完成，请稍候…',
];

interface AIThinkingAnimationProps {
  variant?: 'assistant' | 'task';
  labels?: string[];
  subtitle?: string;
  size?: 'sm' | 'md';
}

const AIThinkingAnimation = memo(({
  variant = 'assistant',
  labels,
  subtitle,
  size = 'md',
}: AIThinkingAnimationProps) => {
  const uid = useId();
  const [labelIdx, setLabelIdx] = useState(0);
  const displayLabels = labels ?? (variant === 'task' ? TASK_LABELS : SAILE_LABELS);
  const displaySubtitle = subtitle ?? (variant === 'task' ? '任务执行中' : '赛乐助手为您服务');

  useEffect(() => {
    const timer = setInterval(() => setLabelIdx((i) => (i + 1) % displayLabels.length), 3200);
    return () => clearInterval(timer);
  }, [displayLabels.length]);

  const isSm = size === 'sm';
  const orbSize = isSm ? 36 : 48;
  const g1 = `aiGrad1-${uid.replace(/:/g, '')}`;
  const g2 = `aiGrad2-${uid.replace(/:/g, '')}`;

  const dotStyle = (delay: number): React.CSSProperties => ({
    display: 'inline-block',
    width: isSm ? 6 : 7,
    height: isSm ? 6 : 7,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    animation: `aiDotPulse 1.4s ease-in-out ${delay}s infinite`,
    flexShrink: 0,
  });

  return (
    <div
      className="ai-thinking-enter"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: isSm ? 10 : 14,
        padding: isSm ? '8px 2px' : '14px 4px',
      }}
    >
      {/* Orb */}
      <div style={{ position: 'relative', flexShrink: 0, width: orbSize, height: orbSize }}>
        {/* Glow */}
        <div
          className="ai-orb-glow"
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          }}
        />
        {/* Ring 1 — clockwise */}
        <svg
          className="ai-orb-spin"
          viewBox="0 0 48 48"
          width={orbSize}
          height={orbSize}
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <linearGradient id={g1} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4d6bfe" />
              <stop offset="45%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <circle
            cx="24" cy="24" r="20.5"
            fill="none"
            stroke={`url(#${g1})`}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeDasharray="75 55"
            opacity="0.92"
          />
        </svg>
        {/* Ring 2 — counter-clockwise */}
        <svg
          className="ai-orb-spin-reverse"
          viewBox="0 0 48 48"
          width={orbSize}
          height={orbSize}
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <linearGradient id={g2} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <circle
            cx="24" cy="24" r="20.5"
            fill="none"
            stroke={`url(#${g2})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="42 86"
            opacity="0.5"
          />
        </svg>
        {/* Center text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="ai-orb-text"
            style={{
              fontWeight: 700,
              fontSize: isSm ? 11 : 14,
              userSelect: 'none',
              background: 'linear-gradient(135deg, #4d6bfe 0%, #a855f7 50%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            T+
          </span>
        </div>
      </div>

      {/* Text bubble */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingTop: 2 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: isSm ? 8 : 10,
            padding: isSm ? '8px 14px' : '10px 18px',
            borderRadius: '16px 16px 16px 4px',
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(229,231,235,0.7)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}
          className="dark:!bg-gray-800/85 dark:!border-gray-700/50"
        >
          {/* Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={dotStyle(0)} />
            <span style={dotStyle(0.16)} />
            <span style={dotStyle(0.32)} />
          </div>
          {/* Label */}
          <span
            key={labelIdx}
            className="ai-label-transition"
            style={{
              fontSize: isSm ? 13 : 14,
              color: '#6b7280',
              userSelect: 'none',
              fontWeight: 500,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {displayLabels[labelIdx]}
          </span>
        </div>
        {/* Subtitle */}
        <span
          style={{
            fontSize: 11,
            color: '#b0b8c4',
            userSelect: 'none',
            paddingLeft: 6,
            letterSpacing: '0.04em',
          }}
        >
          {displaySubtitle}
        </span>
      </div>
    </div>
  );
});

AIThinkingAnimation.displayName = 'AIThinkingAnimation';
export default AIThinkingAnimation;
