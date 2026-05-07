import React from 'react';
import { Building2, Loader2, Plus } from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

function getWorkspaceName(workspace) {
  return workspace?.name || workspace?.business_name || workspace?.businessName || 'Unnamed workspace';
}

function getWorkspaceCurrency(workspace) {
  return workspace?.defaultCurrency || workspace?.default_currency || 'USD';
}

function uniqueWorkspaces(workspaces = [], currentWorkspace) {
  const map = new Map();

  workspaces.forEach((workspace) => {
    if (workspace?.id) map.set(workspace.id, workspace);
  });

  if (currentWorkspace?.id && !map.has(currentWorkspace.id)) {
    map.set(currentWorkspace.id, currentWorkspace);
  }

  return Array.from(map.values());
}

export function WorkspaceSwitcher() {
  const { workspaces = [], currentWorkspace, setCurrentWorkspace } = useApp();
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const workspaceOptions = React.useMemo(
    () => uniqueWorkspaces(workspaces, currentWorkspace),
    [workspaces, currentWorkspace],
  );

  const currentWorkspaceId = currentWorkspace?.id || '';
  const currentWorkspaceName = getWorkspaceName(currentWorkspace);
  const currentWorkspaceCurrency = getWorkspaceCurrency(currentWorkspace);

  const handleChange = async (event) => {
    const workspaceId = event.target.value;

    if (!workspaceId || workspaceId === currentWorkspaceId) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      await setCurrentWorkspace(workspaceId);
    } catch (error) {
      setMessage(error?.message || 'Could not switch workspace.');
    } finally {
      setBusy(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="workspace-switcher-wrap">
        <button
          type="button"
          className="workspace-switcher-empty"
          onClick={() => navigate('/workspace-setup')}
          data-skip-create-action="true"
        >
          <Plus size={16} />
          <span>Create or join workspace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="workspace-switcher-wrap">
      <div className="workspace-switcher-shell">
        <Building2 size={16} aria-hidden="true" />

        <label className="sr-only" htmlFor="workspace-switcher">
          Switch workspace
        </label>

        <select
          id="workspace-switcher"
          className="workspace-switcher"
          value={currentWorkspaceId}
          onChange={handleChange}
          disabled={busy}
          aria-label="Switch workspace"
        >
          {workspaceOptions.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {getWorkspaceName(workspace)}
            </option>
          ))}
        </select>

        {busy ? <Loader2 className="workspace-switcher-spinner" size={15} /> : null}
      </div>

      <span className="workspace-switcher-meta" title={currentWorkspaceName}>
        {currentWorkspaceCurrency} workspace
      </span>

      {message && (
        <span className="workspace-error" role="alert">
          {message}
        </span>
      )}
    </div>
  );
}
