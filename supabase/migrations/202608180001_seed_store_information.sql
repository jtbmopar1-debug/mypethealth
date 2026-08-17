-- Current public store information verified against All Good Petfood's own
-- site-wide footer and confirmed by the store owner on 18 August 2026. This entry remains
-- editable in the admin knowledge manager when regular hours or contact details
-- change.

insert into public.knowledge_entries
  (id, question, answer, category, summary, follow_up_questions, safety_notes, tags, relevant_product_tags, recommended_product_urls, source_candidate_id, enabled, created_by)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'Where is All Good Petfood, when is the store open, and how can I contact the team?',
    'The All Good Petfood retail store is at 12 Mill Lane, Kerikeri 0230, Northland, New Zealand. Regular staffed shop hours are Monday to Friday, 8:30 am to 5:00 pm, and Saturday, 9:00 am to 2:00 pm. The self-service dog-wash machine is outside the store and is available 24 hours a day, 7 days a week. Buddy is available online 24/7, and customers can shop online at https://allgoodpetfood.co.nz at any time. Phone the store on 09 945 6498 or email admin@allgoodpetfood.co.nz. The official contact page is https://allgoodpetfood.co.nz/pages/contact-us. Staffed hours may change on public holidays or for exceptional closures, so customers needing assistance on a holiday should check the contact page or phone the store first. No staffed Sunday shop hours are published.',
    'store-information',
    'All Good Petfood is at 12 Mill Lane, Kerikeri; the outdoor dog wash, Buddy and online shopping are available 24/7 even when the staffed shop is closed.',
    array['Do you need the staffed shop, the outdoor dog wash, Buddy or online shopping?', 'Are you planning to visit the staffed shop on a public holiday?', 'Would you like the phone number or contact-page address?'],
    array['Do not claim staffed holiday hours are unchanged unless current holiday hours have been confirmed.', 'Keep the staffed retail-store hours separate from the 24/7 outdoor dog wash, Buddy and online store.', 'The confirmed retail-store address is 12 Mill Lane, Kerikeri 0230.'],
    array['store hours', 'shop hours', 'opening hours', 'open today', 'open now', 'closing time', 'what time', 'address', 'location', 'located', 'directions', 'Kerikeri store', 'Mill Lane', 'phone number', 'contact', 'email address', 'Sunday', 'Saturday', 'public holiday', 'dog wash', 'dog wash machine', 'self-service dog wash', 'outside dog wash', '24/7', 'Buddy availability', 'online shopping', 'online store'],
    array[]::text[],
    array[]::text[],
    'allgoodpetfood-site:store-contact-hours', true, 'verified-store-owner'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'Who is on the All Good Petfood team?',
    'The current All Good Petfood team includes Luanne, Craig and Wayne. Luanne is the owner. Wayne is newly joining the team. If a customer needs help from a particular person, Buddy should offer the main store contact details rather than personal contact information and should not promise who is currently working or when an individual will reply.',
    'store-information',
    'The current team is Luanne, Craig and newly joining team member Wayne.',
    array['Would you like the store phone number or email address?', 'Is there a message you would like to pass to a particular team member?'],
    array['Do not provide personal phone numbers, email addresses, schedules or other private staff information.', 'Do not promise that a particular team member is currently working or will respond within a specific timeframe.', 'Use the main store contact details for customer enquiries.'],
    array['staff', 'team', 'team members', 'who works there', 'who works at All Good Petfood', 'Luanne', 'Craig', 'Wayne', 'owner', 'speak to staff', 'contact team'],
    array[]::text[],
    array[]::text[],
    'allgoodpetfood-owner:current-team', true, 'verified-store-owner'
  )
on conflict do nothing;
