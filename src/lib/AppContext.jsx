import React, { createContext, useContext, useMemo, useState } from 'react';
import { demoUsers, workspaces, properties, bookings, cleaningTasks, maintenanceWorkOrders, notifications, ownerReports } from '../data/sampleData.js';
import { roles } from '../data/constants.js';

const AppContext = createContext(null);
const initialData = { properties, bookings, cleaningTasks, maintenanceWorkOrders, notifications, ownerReports };
const blankData = { properties: [], bookings: [], cleaningTasks: [], maintenanceWorkOrders: [], notifications: [], ownerReports: [] };

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(demoUsers.find((user) => user.roles.includes(roles.OWNER_ADMIN)));
  const [currentWorkspace, setCurrentWorkspace] = useState(workspaces[0]);
  const [data, setData] = useState(initialData);

  const workspaceData = useMemo(() => {
    const workspaceId = currentWorkspace?.id;
    return Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.filter((row) => !row.workspaceId || row.workspaceId === workspaceId)]));
  }, [data, currentWorkspace]);

  const value = {
    currentUser,
    setCurrentUser,
    currentWorkspace,
    setCurrentWorkspace,
    workspaces,
    data: workspaceData,
    resetDemoData: () => setData(initialData),
    resetBlankData: () => setData(blankData),
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
