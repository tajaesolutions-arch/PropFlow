import React from 'react';
import { useApp } from '../lib/AppContext.jsx';

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useApp();
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  if (!currentWorkspace) {
    return <span className="workspace-switcher muted">No workspace</span>;
  }

  const handleChange = async (event) => {
    const workspaceId = event.target.value;

    if (!workspaceId || workspaceId === currentWorkspace.id) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      await setCurrentWorkspace(workspaceId);
    } catch (error) {
      setMessage(error.message || 'Could not switch workspace.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workspace-switcher-wrap">
      <select
        className="workspace-switcher"
        value={currentWorkspace.id}
        onChange={handleChange}
        disabled={busy}
        aria-label="Switch workspace"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>

      {message && <span className="workspace-error">{message}</span>}
    </div>
  );
}
