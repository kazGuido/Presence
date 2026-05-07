import { Link, NavLink, Outlet } from 'react-router-dom';

export function EmployeeShell() {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface pb-20 md:pb-0">
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around rounded-t-xl border-t border-primary/5 bg-surface-container px-4 py-2 shadow-sm md:hidden">
        <NavLink
          to="/employee"
          className={({ isActive }) =>
            `flex flex-col items-center rounded-full px-4 py-1 text-xs ${isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`
          }
        >
          <span className="material-symbols-outlined text-[22px]">alarm_on</span>
          Pointer
        </NavLink>
        <NavLink
          to="/employee/historique"
          className={({ isActive }) =>
            `flex flex-col items-center rounded-full px-4 py-1 text-xs ${isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`
          }
        >
          <span className="material-symbols-outlined text-[22px]">history</span>
          Historique
        </NavLink>
        <NavLink
          to="/employee/parametres"
          className={({ isActive }) =>
            `flex flex-col items-center rounded-full px-4 py-1 text-xs ${isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`
          }
        >
          <span className="material-symbols-outlined text-[22px]">settings</span>
          Paramètres
        </NavLink>
      </nav>
    </div>
  );
}
