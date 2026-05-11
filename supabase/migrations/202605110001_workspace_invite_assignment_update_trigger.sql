-- Ensure accepted invites assign scoped properties even when an existing member row
-- is reactivated through the join upsert path. The security-definer function still
-- validates invite email, pending status, workspace code, roles, and property scope.

drop trigger if exists workspace_member_assign_invited_properties on public.workspace_members;
create trigger workspace_member_assign_invited_properties
  after insert or update of status, roles on public.workspace_members
  for each row
  when (new.status = 'active')
  execute function public.assign_invited_properties();
