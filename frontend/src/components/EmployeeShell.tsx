import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';
import { MobileHexTabBar, type HexTabItem } from './MobileHexTabBar';

export function EmployeeShell() {
  const { t } = useTranslation();
  const employeeHexTabs: HexTabItem[] = [
    { to: '/employee/historique', label: t('employee.navHistory'), icon: 'history' },
    { to: '/employee', label: t('employee.navPointer'), icon: 'alarm_on', center: true, matchIndex: true },
    { to: '/employee/controller', label: t('employee.navController'), icon: 'qr_code_2' },
    { to: '/employee/parametres', label: t('employee.navSettings'), icon: 'tune' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface pb-28 text-on-surface md:pb-0">
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 md:px-6">
          <Link to="/employee" className="flex min-w-0 items-center gap-2 text-primary">
            <span className="material-symbols-outlined shrink-0 text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              hexagon
            </span>
            <span className="truncate text-xl font-semibold">{t('employee.brand')}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle />
            <nav className="hidden gap-4 md:flex lg:gap-6">
              <NavLink
                to="/employee"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'border-b-2 border-primary pb-1 text-primary' : 'text-on-surface-variant hover:text-primary'}`
                }
              >
                {t('employee.navPointer')}
              </NavLink>
              <NavLink
                to="/employee/historique"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'border-b-2 border-primary pb-1 text-primary' : 'text-on-surface-variant hover:text-primary'}`
                }
              >
                {t('employee.navHistory')}
              </NavLink>
              <NavLink
                to="/employee/controller"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'border-b-2 border-primary pb-1 text-primary' : 'text-on-surface-variant hover:text-primary'}`
                }
              >
                {t('employee.navController')}
              </NavLink>
              <NavLink
                to="/employee/parametres"
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'border-b-2 border-primary pb-1 text-primary' : 'text-on-surface-variant hover:text-primary'}`
                }
              >
                {t('employee.navSettings')}
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6">
        <Outlet />
      </main>
      <MobileHexTabBar items={employeeHexTabs} variant="compact" />
    </div>
  );
}
