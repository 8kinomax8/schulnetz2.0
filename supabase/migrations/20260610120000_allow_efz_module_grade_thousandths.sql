-- Allow EFZ current module grades imported manually or by scan to keep thousandths.
-- Other grade tables keep their existing precision.

ALTER TABLE public.efz_module_grades
  ALTER COLUMN grade SET DATA TYPE numeric(4,3);

COMMENT ON COLUMN public.efz_module_grades.grade IS 'Swiss grade scale: 1.000 to 6.000, stored with thousandth precision for module controls.';
