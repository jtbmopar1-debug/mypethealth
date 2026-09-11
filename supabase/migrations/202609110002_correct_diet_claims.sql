-- Correct already-seeded entries as well as fresh installations.
update public.knowledge_entries
set answer = 'Wheat-free and grain-free mean different things: wheat-free foods may still contain other grains. Grain-free food is not automatically healthier or the better choice. Choose a complete diet appropriate for the individual pet and any confirmed sensitivities. A wheat allergy does not establish an allergy to every grain. Recurring yeast problems have several possible causes and do not by themselves establish a need for grain-free food. Ask a veterinarian about suspected food allergy and an appropriate supervised diet trial.',
    summary = 'Wheat-free does not mean grain-free. Choose according to confirmed needs, not a hierarchy of cleaner foods.',
    safety_notes = array['Do not quote an unsupported allergy percentage.', 'Do not infer a grain allergy or recommend grain-free solely from yeast symptoms.', 'Do not diagnose; seek veterinary assessment for persistent symptoms.'],
    tags = array['grain free', 'grain-free', 'wheat free', 'wheat-free', 'wheat allergy', 'grain allergy'],
    relevant_product_tags = array[]::text[]
where id = '40000000-0000-4000-8000-000000000004';

update public.knowledge_entries
set answer = 'The online store uses pink backgrounds to identify products labelled hypoallergenic and green backgrounds for non-hypoallergenic products. These colours are browsing guides, not a guarantee of suitability for an individual pet. Check the ingredients, species and life-stage label against your pet''s known needs and allergies.',
    safety_notes = array['A hypoallergenic label or pink background does not guarantee safety for every allergy.', 'Check the individual ingredients and species/life-stage suitability.']
where id = '40000000-0000-4000-8000-000000000003';
