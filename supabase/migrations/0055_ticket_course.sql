-- B10 auto-coursing: stamp the course on each fired kitchen ticket so a bump can
-- tell when a table's whole course is done and (opt-in) auto-fire the next course.
alter table public.kitchen_tickets add column if not exists course_id uuid;
