
import React from 'react';

const NavItem = ({ icon, label, active = false, badge, onClick }: { icon: React.ReactNode, label: string, active?: boolean, badge?: string | number, onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`flex items-center justify-between px-4 py-3 cursor-pointer rounded-xl transition-all duration-200 group ${active ? 'bg-[#004D40] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
  >
    <div className="flex items-center gap-3">
      <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-[#004D40]'}`}>{icon}</span>
      <span className="font-medium text-sm">{label}</span>
    </div>
    {badge !== undefined && (
      <span className="bg-[#004D40] text-white text-[10px] px-1.5 py-0.5 rounded-full border border-white/20">
        {badge}
      </span>
    )}
  </div>
);

export const Sidebar = ({
  activeView,
  onViewChange,
  role,
  appointmentBadge = 0,
  prescriptionBadge = 0
}: {
  activeView: string,
  onViewChange: (view: string) => void,
  role: 'patient' | 'doctor',
  appointmentBadge?: number,
  prescriptionBadge?: number
}) => {
  return (
    <div className="w-64 h-screen bg-white border-r border-slate-100 p-6 flex flex-col fixed left-0 top-0 z-50">
      <div className="flex items-center gap-2 mb-10 px-2 cursor-pointer" onClick={() => onViewChange('home')}>
        <div className="w-10 h-10 bg-[#004D40] rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-[#004D40]">Health Link</span>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto">
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-4">Menu</h3>
          <div className="space-y-1">
            <NavItem
              active={activeView === 'home'}
              onClick={() => onViewChange('home')}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
              label="Home"
            />
            <NavItem
              active={activeView === 'dashboard'}
              onClick={() => onViewChange('dashboard')}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
              label="Dashboard"
            />
            <NavItem
              active={activeView === 'appointments'}
              onClick={() => onViewChange('appointments')}
              badge={appointmentBadge > 0 ? appointmentBadge : undefined}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              label="Appointments"
            />
            <NavItem
              active={activeView === 'emergencies'}
              onClick={() => onViewChange('emergencies')}
              icon={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              label="Emergency"
            />
            {role === 'patient' && (
              <NavItem
                active={activeView === 'prescriptions'}
                onClick={() => onViewChange('prescriptions')}
                badge={prescriptionBadge > 0 ? prescriptionBadge : undefined}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                label="Prescriptions"
              />
            )}
            {role === 'doctor' && (
              <NavItem
                active={activeView === 'vitals'}
                onClick={() => onViewChange('vitals')}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                label="Vitals"
              />
            )}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 mb-4">General</h3>
          <div className="space-y-1">
            <NavItem
              active={activeView === 'settings'}
              onClick={() => onViewChange('settings')}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              label="Settings"
            />
            <NavItem
              onClick={() => onViewChange('logout')}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
              label="Logout"
            />
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 bg-[#004D40] rounded-2xl relative overflow-hidden group cursor-pointer shadow-xl">
        <div className="relative z-10">
          <p className="text-white font-bold text-sm mb-1">Download Health Link</p>
          <p className="text-white/60 text-[11px] mb-3">Get real-time alerts on your phone</p>
          <button className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold py-2 px-4 rounded-lg transition-colors w-full">
            Download App
          </button>
        </div>
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
      </div>
    </div>
  );
};
