-- =====================================================================
-- Adds a self-employment-specific trigger rule so the tax-opportunity
-- scanner isn't only checking farm (Schedule F) data. The existing 8
-- rules stay as they are; this adds a 9th, purely additive.
-- =====================================================================

insert into tax_rule (key, title, description, trigger_event, jurisdiction_id)
select 'self_employment_tax_review',
  'Self-Employment Tax (Schedule SE) Review',
  'Net self-employment earnings for the year may be at or above the $400 threshold where self-employment tax (Social Security and Medicare, via Schedule SE) generally applies, separate from ordinary income tax.',
  'self_employment_income', j.id
from jurisdiction j where j.code = 'US-FEDERAL'
on conflict (key) do nothing;

insert into tax_rule_version (tax_rule_id, effective_tax_year, summary, official_reference, required_questions, required_documents)
select tr.id, 2026,
  tr.description,
  'https://www.irs.gov/forms-pubs/about-schedule-se-form-1040',
  '["Was self-employment income earned outside the farm business this year?", "Were any estimated self-employment tax payments made?"]'::jsonb,
  array['tax']::document_category[]
from tax_rule tr
where tr.key = 'self_employment_tax_review'
  and not exists (
    select 1 from tax_rule_version v where v.tax_rule_id = tr.id and v.effective_tax_year = 2026
  );
