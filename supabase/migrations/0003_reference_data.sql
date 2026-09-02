-- =====================================================================
-- Reference / lookup data — shared across all farms
-- =====================================================================

insert into crop (name) values
  ('Corn'), ('Soybeans'), ('Milo (Grain Sorghum)'), ('Wheat'), ('Alfalfa'),
  ('Hay'), ('Cotton'), ('Oats'), ('Sunflowers'), ('Other')
on conflict (name) do nothing;

insert into job_service (name) values
  ('Spraying'), ('Fertilizer Application'), ('Planting'), ('Harvest'),
  ('Baling'), ('Swathing'), ('Tillage'), ('Trucking'),
  ('Manure Application'), ('Conservation Work'), ('Equipment Rental'), ('Other')
on conflict (name) do nothing;

insert into jurisdiction (code, name) values
  ('US-FEDERAL', 'United States (Federal)'),
  ('US-KS', 'Kansas'), ('US-NE', 'Nebraska'), ('US-IA', 'Iowa'),
  ('US-IL', 'Illinois'), ('US-MO', 'Missouri'), ('US-OK', 'Oklahoma'),
  ('US-TX', 'Texas'), ('US-CO', 'Colorado'), ('US-MN', 'Minnesota')
on conflict (code) do nothing;

-- Tax categories map roughly to Schedule F lines. Informational labels only —
-- never a legal determination. "Ask your tax professional."
insert into tax_category (code, label, schedule_reference, income_or_expense, sort_order) values
  ('income_sales_livestock_resale', 'Sales of Livestock/Items Bought for Resale', 'Schedule F, Line 1a', 'income', 10),
  ('income_sales_livestock_produce', 'Sales of Livestock, Produce, Grains Raised', 'Schedule F, Line 2', 'income', 20),
  ('income_custom_hire', 'Custom Hire (Machine Work) Income', 'Schedule F, Line 7', 'income', 30),
  ('income_govt_payments', 'Agricultural Program Payments', 'Schedule F, Line 4a', 'income', 40),
  ('income_crop_insurance', 'Crop Insurance Proceeds', 'Schedule F, Line 6a', 'income', 50),
  ('income_other', 'Other Farm Income', 'Schedule F, Line 8', 'income', 60),
  ('exp_car_truck', 'Car and Truck Expenses', 'Schedule F, Line 10', 'expense', 100),
  ('exp_chemicals', 'Chemicals', 'Schedule F, Line 11', 'expense', 110),
  ('exp_conservation', 'Conservation Expenses', 'Schedule F, Line 12', 'expense', 120),
  ('exp_custom_hire', 'Custom Hire (Machine Work)', 'Schedule F, Line 13', 'expense', 130),
  ('exp_depreciation', 'Depreciation', 'Schedule F, Line 14', 'expense', 140),
  ('exp_seed_plants', 'Seeds and Plants', 'Schedule F, Line 15', 'expense', 150),
  ('exp_fertilizer', 'Fertilizers and Lime', 'Schedule F, Line 16', 'expense', 160),
  ('exp_freight_trucking', 'Freight and Trucking', 'Schedule F, Line 17', 'expense', 170),
  ('exp_fuel', 'Gasoline, Fuel, and Oil', 'Schedule F, Line 18', 'expense', 180),
  ('exp_insurance', 'Insurance (Other Than Health)', 'Schedule F, Line 19', 'expense', 190),
  ('exp_interest_mortgage', 'Interest — Mortgage', 'Schedule F, Line 20a', 'expense', 200),
  ('exp_interest_other', 'Interest — Other', 'Schedule F, Line 20b', 'expense', 210),
  ('exp_labor_hired', 'Labor Hired', 'Schedule F, Line 22', 'expense', 220),
  ('exp_rent_lease_equipment', 'Rent/Lease — Vehicles, Machinery, Equipment', 'Schedule F, Line 24a', 'expense', 230),
  ('exp_rent_lease_land', 'Rent/Lease — Land, Animals', 'Schedule F, Line 24b', 'expense', 240),
  ('exp_repairs_maintenance', 'Repairs and Maintenance', 'Schedule F, Line 25', 'expense', 250),
  ('exp_seeds', 'Seeds and Plants Purchased', 'Schedule F, Line 15', 'expense', 260),
  ('exp_storage_warehousing', 'Storage and Warehousing', 'Schedule F, Line 26', 'expense', 270),
  ('exp_supplies', 'Supplies', 'Schedule F, Line 27', 'expense', 280),
  ('exp_taxes', 'Taxes', 'Schedule F, Line 28', 'expense', 290),
  ('exp_utilities', 'Utilities', 'Schedule F, Line 29', 'expense', 300),
  ('exp_vet_breeding_medicine', 'Veterinary, Breeding, and Medicine', 'Schedule F, Line 30', 'expense', 310),
  ('exp_other', 'Other Expenses', 'Schedule F, Line 32', 'expense', 320),
  ('personal_excluded', 'Personal / Not a Farm Expense', null, 'expense', 999)
on conflict (code) do nothing;

-- Default farm-facing categories (the plain-language buckets farmers actually
-- think in) mapped to the tax categories above. farm_business_id is null =
-- global default, cloned/overridable per farm in the application layer.
insert into farm_category (name, default_tax_category_id)
select v.name, tc.id from (values
  ('Seed', 'exp_seeds'),
  ('Fertilizer', 'exp_fertilizer'),
  ('Chemical', 'exp_chemicals'),
  ('Fuel', 'exp_fuel'),
  ('Rent', 'exp_rent_lease_land'),
  ('Insurance', 'exp_insurance'),
  ('Custom Work', 'exp_custom_hire'),
  ('Harvest', 'exp_custom_hire'),
  ('Drying', 'exp_storage_warehousing'),
  ('Trucking', 'exp_freight_trucking'),
  ('Repairs & Maintenance', 'exp_repairs_maintenance'),
  ('Labor', 'exp_labor_hired'),
  ('Utilities', 'exp_utilities'),
  ('Veterinary & Medicine', 'exp_vet_breeding_medicine'),
  ('Supplies', 'exp_supplies'),
  ('Taxes & Licenses', 'exp_taxes'),
  ('Equipment Rent/Lease', 'exp_rent_lease_equipment'),
  ('Vehicle', 'exp_car_truck'),
  ('Conservation', 'exp_conservation'),
  ('Other', 'exp_other'),
  ('Personal / Excluded', 'personal_excluded')
) as v(name, tax_code)
join tax_category tc on tc.code = v.tax_code
where not exists (select 1 from farm_category fc where fc.farm_business_id is null and fc.name = v.name);

-- Example tax-opportunity trigger rules. These are illustrative
-- starting points, NOT legal advice, and must be reviewed/maintained by
-- a qualified tax professional before being relied on in production.
insert into tax_rule (key, title, description, trigger_event, jurisdiction_id)
select v.key, v.title, v.description, v.trigger_event, j.id
from (values
  ('section_179_equipment', 'Section 179 / Bonus Depreciation Review',
   'A farm equipment purchase may be eligible for accelerated expensing. Elections and limits change by tax year.',
   'equipment_purchase', 'US-FEDERAL'),
  ('like_kind_no_longer_avail', 'Equipment Trade-In Basis Review',
   'Trading equipment changes how basis and gain/loss are computed. Review with a tax professional.',
   'equipment_sale', 'US-FEDERAL'),
  ('prepaid_farm_supplies', 'Prepaid Farm Supplies Limit',
   'Large prepaid input purchases near year-end may be subject to deduction limits.',
   'prepaid_input', 'US-FEDERAL'),
  ('breeding_livestock_capital', 'Breeding Livestock Capital Gain Treatment',
   'Sale of breeding livestock held for the required period may qualify for different tax treatment than resale stock.',
   'livestock_purchase', 'US-FEDERAL'),
  ('disaster_casualty', 'Disaster / Casualty Loss Documentation',
   'Losses from weather or disaster events may have special farm tax provisions and documentation requirements.',
   'disaster_casualty_event', 'US-FEDERAL'),
  ('conservation_expense', 'Soil & Water Conservation Expense Review',
   'Conservation-related expenditures (terraces, waterways, tree planting) may have specific deduction limits.',
   'conservation_expense', 'US-FEDERAL'),
  ('government_payment_reporting', 'Government Program Payment Reporting',
   'Agricultural program payments are generally reported as farm income and may affect other calculations.',
   'government_payment', 'US-FEDERAL'),
  ('crop_insurance_deferral', 'Crop Insurance Proceeds — Possible Deferral',
   'Crop insurance proceeds received for crop damage may, in limited situations, be eligible for one-year deferral.',
   'crop_insurance', 'US-FEDERAL')
) as v(key, title, description, trigger_event, jur_code)
join jurisdiction j on j.code = v.jur_code
on conflict (key) do nothing;

insert into tax_rule_version (tax_rule_id, effective_tax_year, summary, official_reference, required_questions, required_documents)
select tr.id, 2026,
  tr.description,
  'https://www.irs.gov/forms-pubs/about-publication-225',
  '["Was this asset placed in service this tax year?", "What is the business-use percentage?"]'::jsonb,
  array['receipt','tax']::document_category[]
from tax_rule tr
where not exists (
  select 1 from tax_rule_version v where v.tax_rule_id = tr.id and v.effective_tax_year = 2026
);
