import { NavLink } from 'react-router-dom';

export type HexTabItem = {
  to: string;
  label: string;
  icon: string;
  /** Visually lifted center tab (e.g. main action). */
  center?: boolean;
  /** NavLink `end` — match index route only. */
  matchIndex?: boolean;
};

function fillStyle(active: boolean) {
  return { fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400" } as const;
}

export function MobileHexTabBar({ items, variant = 'default' }: { items: HexTabItem[]; variant?: 'default' | 'compact' }) {
  const compact = variant === 'compact';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {/* Frosted strip: blur + stronger at bottom, fades upward */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[7.25rem] overflow-hidden motion-reduce:backdrop-blur-none"
        aria-hidden
      >
        <div
          className="absolute inset-x-0 bottom-0 top-0 backdrop-blur-xl motion-reduce:backdrop-blur-none"
          style={{
            WebkitBackdropFilter: 'blur(20px)',
            backdropFilter: 'blur(20px)',
            maskImage: 'linear-gradient(to top, black 0%, black 35%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, black 35%, transparent 100%)',
            background:
              'linear-gradient(to top, rgba(249, 249, 252, 0.88) 0%, rgba(249, 249, 252, 0.32) 45%, transparent 100%)',
          }}
        />
      </div>

      <div
        className={[
          'relative mx-auto flex items-end justify-center px-1 pb-1 pt-2',
          compact ? 'max-w-xl gap-0.5' : 'max-w-lg gap-1',
        ].join(' ')}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.matchIndex === true}
            className={[
              'group flex min-w-0 flex-1 flex-col items-center tap-highlight-none',
              !compact && item.center ? '-mt-4 shrink-0' : 'shrink-0',
              compact ? 'pb-0.5' : item.center ? '' : 'pb-1',
            ].join(' ')}
          >
            {({ isActive }) => {
              const box =
                compact
                  ? 'h-10 w-[2.45rem]'
                  : item.center
                    ? 'h-[4.25rem] w-[3.35rem] shadow-md'
                    : 'h-12 w-[2.85rem]';
              const iconSz = compact ? 'text-[18px]' : item.center ? 'text-[26px]' : 'text-[22px]';
              const labelSz = compact ? 'text-[7px]' : item.center ? 'text-[9px]' : 'text-[8px]';
              return (
                <>
                  <div
                    className={[
                      'hex-clip flex flex-col items-center justify-center motion-safe:transition-all motion-safe:duration-200',
                      box,
                      isActive
                        ? 'bg-primary text-on-primary shadow-primary/25 ring-1 ring-primary/40'
                        : 'bg-surface-container text-on-surface-variant ring-1 ring-outline/15 group-active:scale-95',
                    ].join(' ')}
                  >
                    <span className={`material-symbols-outlined ${iconSz}`} style={fillStyle(isActive)}>
                      {item.icon}
                    </span>
                  </div>
                  <span
                    className={[
                      'mt-1 max-w-full truncate px-0.5 text-center font-semibold uppercase tracking-wide',
                      labelSz,
                      'leading-tight opacity-90',
                      isActive ? 'text-primary' : 'text-on-surface-variant',
                    ].join(' ')}
                  >
                    {item.label}
                  </span>
                </>
              );
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
