import React from 'react';
import { useApp } from '../lib/AppContext.jsx';
export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useApp();
  if (!currentWorkspace) return <span className="workspace-switcher muted">No workspace</span>;
  return <select className="workspace-switcher" value={currentWorkspace.id} onChange={(e) => setCurrentWorkspace(workspaces.find((w) => w.id === e.target.value))}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select>;
}
