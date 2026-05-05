-- PropFlow demo seed data. Replace demo UUIDs with real auth user ids when seeding against a live Supabase project.
insert into public.plans (id, name, billing_period, price_cents, property_limit, user_limit, is_enterprise) values
('00000000-0000-0000-0000-000000000101','Starter','monthly',4900,3,5,false),
('00000000-0000-0000-0000-000000000102','Growth','monthly',14900,15,25,false),
('00000000-0000-0000-0000-000000000103','Pro','monthly',34900,60,100,false),
('00000000-0000-0000-0000-000000000104','Enterprise','monthly',null,null,null,true)
on conflict (name) do nothing;

insert into public.profiles (id, full_name, email, is_propflow_admin, status) values
('10000000-0000-0000-0000-000000000001','Avery Admin','admin@propflow.demo',true,'active'),
('10000000-0000-0000-0000-000000000002','Morgan Lee','owner@propflow.demo',false,'active'),
('10000000-0000-0000-0000-000000000003','Priya Shah','manager@propflow.demo',false,'active'),
('10000000-0000-0000-0000-000000000004','Tasha Brown','cleaner@propflow.demo',false,'active'),
('10000000-0000-0000-0000-000000000005','Devon Wright','maintenance@propflow.demo',false,'active'),
('10000000-0000-0000-0000-000000000006','Nia Campbell','propertyowner@propflow.demo',false,'active')
on conflict (id) do nothing;

insert into public.workspaces (id, name, country, default_currency, created_by) values
('20000000-0000-0000-0000-000000000001','Blue Harbor Stays','Jamaica','USD','10000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, roles, status) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','{workspace_owner}','active'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','{property_manager,host}','active'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','{cleaner}','active'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','{maintenance_crew}','active'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','{owner}','active')
on conflict (workspace_id, user_id) do nothing;

insert into public.workspace_join_codes (workspace_id, code, default_roles, created_by) values
('20000000-0000-0000-0000-000000000001','BLUE-2026','{host}','10000000-0000-0000-0000-000000000002');

insert into public.subscriptions (workspace_id, plan_id, status, plan_name, billing_period, property_limit, user_limit, trial_starts_at, trial_ends_at) values
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','active','Growth','monthly',15,25,now() - interval '30 days',now() + interval '0 days')
on conflict (workspace_id) do nothing;

insert into public.property_owners (id, workspace_id, name, email, phone, payout_preference, created_by) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Nia Campbell','nia@example.com','+1 876 555 0124','Monthly ACH','10000000-0000-0000-0000-000000000002'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Harbor Trust LLC','finance@harbortrust.example','+1 876 555 0199','Quarterly wire','10000000-0000-0000-0000-000000000002');

insert into public.properties (id, workspace_id, name, address, city, country, property_type, rental_type, bedrooms, bathrooms, max_guests, owner_id, assigned_cleaner_id, assigned_maintenance_user_id, nightly_rate, monthly_rate, currency, status, notes, created_by) values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Seaside Villa','18 Ocean View Road','Montego Bay','Jamaica','Villa','short-term',4,3.5,10,'30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005',420,null,'USD','active','Premium Airbnb property with pool and ocean view.','10000000-0000-0000-0000-000000000002'),
('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Kingston Garden Flat','41 Hope Road','Kingston','Jamaica','Apartment','both',2,2,5,'30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005',210,1850,'USD','active','Flexible monthly and furnished short-stay unit.','10000000-0000-0000-0000-000000000002'),
('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Ocho Rios Townhome','7 Fern Gully Lane','Ocho Rios','Jamaica','Townhome','long-term',3,2,6,'30000000-0000-0000-0000-000000000001',null,'10000000-0000-0000-0000-000000000005',null,2400,'USD','maintenance hold','Long-term lease renews in June.','10000000-0000-0000-0000-000000000002');

insert into public.guests (id, workspace_id, full_name, email, phone, source) values
('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Olivia Martin','olivia@example.com','+1 212 555 0162','Airbnb'),
('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Ethan Clarke','ethan@example.com','+44 20 5555 0198','Direct');

insert into public.bookings (workspace_id, property_id, guest_id, guest_name, check_in, check_out, booking_source, total_amount, cleaning_fee, platform_fee, status, payment_status, notes) values
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Olivia Martin','2026-05-09','2026-05-14','Airbnb',2600,180,390,'upcoming','paid','Anniversary trip.'),
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','Ethan Clarke','2026-05-05','2026-05-12','Direct',1450,120,0,'checked_in','deposit_paid','Direct booking.');

insert into public.expenses (workspace_id, property_id, category, amount, currency, expense_date, vendor, notes) values
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Cleaning',820,'USD','2026-05-01','Tasha Brown','Turnover cleaning'),
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','Maintenance',180,'USD','2026-05-05','Internal','Leak diagnosis');

insert into public.revenue_records (workspace_id, property_id, source, amount, currency, revenue_date) values
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Airbnb',2600,'USD','2026-05-09'),
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','Direct',1450,'USD','2026-05-05');

insert into public.cleaning_checklists (id, workspace_id, property_id, name, is_default, created_by) values
('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Standard guest-ready turnover',true,'10000000-0000-0000-0000-000000000002');
insert into public.cleaning_checklist_items (workspace_id, checklist_id, label, sort_order) values
('20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','Strip and replace linens',1),
('20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','Sanitize kitchen and bathrooms',2),
('20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','Upload before/after photos',3);
insert into public.cleaning_tasks (workspace_id, property_id, assigned_user_id, checklist_id, due_at, status, issue_report, created_by) values
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000001','2026-05-14 11:00+00','not_started',null,'10000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003',null,'60000000-0000-0000-0000-000000000001','2026-05-07 10:00+00','blocked_issue_found','Water leak near laundry room.','10000000-0000-0000-0000-000000000002');

insert into public.vendors (id, workspace_id, name, contact_name, email, service_type) values
('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','AquaCare Ltd','Marcia King','service@aquacare.example','Pool service');
insert into public.maintenance_work_orders (workspace_id, property_id, title, description, priority, status, assigned_user_id, vendor_id, parts_needed, estimated_cost, actual_cost, due_date, created_by) values
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','Laundry room water leak','Urgent issue from cleaner report.','critical','in_progress','10000000-0000-0000-0000-000000000005',null,'Supply hose, shutoff valve',450,180,'2026-05-05','10000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Pool pump service','Preventative service.','medium','assigned','10000000-0000-0000-0000-000000000005','70000000-0000-0000-0000-000000000001','Filter cartridge',260,0,'2026-05-08','10000000-0000-0000-0000-000000000002');

insert into public.owner_reports (workspace_id, owner_id, property_id, report_type, period_start, period_end, status, monthly_email_enabled, emailed_at, created_by) values
('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Monthly owner report','2026-04-01','2026-04-30','ready',true,'2026-04-30 14:00+00','10000000-0000-0000-0000-000000000002');

insert into public.notifications (workspace_id, recipient_user_id, type, message, status) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','New booking','Olivia Martin booked Seaside Villa for May 9–14.','unread'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','Cleaner assigned','Tasha Brown assigned to Kingston Garden Flat turnover.','unread'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','Urgent issue created','Critical leak flagged for Devon Wright.','unread'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','Owner report ready','April owner report is ready.','unread');
