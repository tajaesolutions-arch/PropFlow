import React from 'react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
export function OwnersPage(){ return <AppLayout title="Owners"><EmptyState title="Owner records are coming soon." description="Property-owner assignment is represented in the Phase 1 schema, but full owner CRM and payout workflows are deferred." /></AppLayout>}
