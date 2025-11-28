-- Add vehicle-specific fields to parts table for car parts
ALTER TABLE public.parts
ADD COLUMN vehicle_make TEXT,
ADD COLUMN vehicle_model TEXT,
ADD COLUMN vehicle_year_from INTEGER,
ADD COLUMN vehicle_year_to INTEGER;

-- Add comment for clarity
COMMENT ON COLUMN public.parts.vehicle_make IS 'Vehicle manufacturer (e.g., Toyota, Honda) - used for car parts';
COMMENT ON COLUMN public.parts.vehicle_model IS 'Vehicle model (e.g., Hilux, Civic) - used for car parts';
COMMENT ON COLUMN public.parts.vehicle_year_from IS 'Compatible from year - used for car parts';
COMMENT ON COLUMN public.parts.vehicle_year_to IS 'Compatible to year - used for car parts';