import { Link, NavLink, Outlet } from 'react-router-dom';
import { MobileHexTabBar } from './MobileHexTabBar';

const employeeHexTabs = [
  { to: '/employee/historique', label: 'Historique', icon: 'history' },
  { to: '/employee', label: 'Pointer', icon: 'alarm_on', center: true, matchIndex: true },
  { to: '/employee/parametres', label: 'Paramètres', icon: 'tune' },
];

export function EmployeeShell() {
  return (
    <div className="flex min-h-screen flex-col bg-surface pb-28 text-on-surface md:pb-0">
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
          <Link to="/employee" className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              hexagon
            </span>
            <span className="text-xl font-semibold">Mobile Sync</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <NavLink
              to="/employee"
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'border-b-2 border-primary pb-1 text-primary' : 'text-on-surface-variant hover:text-primary'}`
              }
            >
              Pointer
            </NavLink>
            <NavLink
              to="/employee/historique"
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'border-b-2 border-primary pb-1 text-primary' : 'text-on-surface-variant hover:text-primary'}`
              }
            >
              Historique
            </NavLink>
            <NavLink
              to="/employee/parametres"
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'border-b-2 border-primary pb-1 text-primary' : 'text-on-surface-variant hover:text-primary'}`
              }
            >
              Paramètres
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <Outlet />
      </main>
      <MobileHexTabBar items={employeeHexTabs} />
    </div>
  );
}
