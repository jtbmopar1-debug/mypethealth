create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 300),
  answer text not null check (char_length(answer) between 10 and 12000),
  category text not null check (char_length(category) between 2 and 100),
  summary text check (char_length(summary) between 3 and 500 or summary is null),
  follow_up_questions text[] not null default '{}',
  safety_notes text[] not null default '{}',
  tags text[] not null default '{}',
  relevant_product_tags text[] not null default '{}',
  recommended_product_urls text[] not null default '{}',
  source_candidate_id text,
  enabled boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_entries
  add column if not exists source_candidate_id text;

alter table public.knowledge_entries
  add column if not exists recommended_product_urls text[] not null default '{}';

create unique index if not exists knowledge_entries_source_candidate_idx
  on public.knowledge_entries (source_candidate_id)
  where source_candidate_id is not null;

create index if not exists knowledge_entries_enabled_updated_idx
  on public.knowledge_entries (enabled, updated_at desc);

alter table public.knowledge_entries enable row level security;

revoke all on public.knowledge_entries from anon, authenticated;
grant select, insert, update, delete on public.knowledge_entries to service_role;

comment on table public.knowledge_entries is
  'Admin-managed, reviewed question-and-answer knowledge used to ground Buddy responses.';


-- Seed the reviewed baseline into the editable store. Re-running this migration is
-- safe: staff edits are retained because existing IDs are never overwritten.
insert into public.knowledge_entries
  (id, question, answer, category, summary, follow_up_questions, safety_notes, tags, relevant_product_tags, enabled, created_by)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Itchy dogs: dietary first steps',
    'Itching can have several causes, including environmental triggers, parasites and skin conditions. Ask what food and protein the dog currently eats, age, approximate weight, how long the itching has been present, other symptoms and what has already been tried. A consistent trial of a different protein may be reasonable, but avoid presenting it as a diagnosis or confirmed allergy.',
    'itchy-dogs',
    'Gather context before suggesting a food trial and keep non-dietary causes in view.',
    array['What food and protein are they eating now?', 'How long has the itching been going on?', 'Are there any other symptoms?', 'Have they tried another protein before?'],
    array['Persistent, severe or worsening itching should be discussed with a veterinarian.', 'Do not diagnose a food allergy.'],
    array['itching', 'itchy', 'skin', 'coat', 'allergy', 'sensitivities', 'protein'],
    array['single-protein', 'skin-support'], true, 'baseline'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Sensitive stomachs and digestive changes',
    'For loose stools, gas or a sensitive stomach, ask when the issue began, what the dog currently eats, whether treats or table food changed, and whether vomiting, lethargy, blood or weight loss is present. A simple recipe and gradual transition may help some dogs. Sudden or serious symptoms need veterinary advice.',
    'digestive-issues',
    'Look at duration, current diet, treats and warning signs before discussing gentle dietary options.',
    array['What are they eating now?', 'How long has this been happening?', 'Any vomiting, blood, lethargy or weight loss?', 'Did anything in their diet change recently?'],
    array['Urgent or severe digestive symptoms require veterinary attention.'],
    array['stomach', 'digestion', 'digestive', 'stool', 'diarrhoea', 'gas', 'sensitive'],
    array['digestive-support', 'single-protein'], true, 'baseline'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Transitioning onto a new food',
    'A typical transition takes 7 to 10 days: begin with about 25% new food, move towards half-and-half, then 75% new food before fully changing. Dogs with sensitive digestion may need longer. Keep portions measured and avoid introducing several other new foods at the same time.',
    'transitioning-food',
    'Change food gradually and slow down if mild digestive upset appears.',
    array['Does your dog usually handle food changes well?', 'What food are you transitioning from?'],
    array['Repeated vomiting, blood, marked lethargy or persistent diarrhoea needs veterinary advice.'],
    array['transition', 'change', 'switch', 'new food', 'stool'],
    array[]::text[], true, 'baseline'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Working out a feeding amount',
    'Feeding needs vary with current weight, ideal weight, age, activity, neuter status and treats. Start with the guide for the exact product, measure the daily amount, and review body condition and weight over two to four weeks. Split the daily amount across meals where appropriate.',
    'feeding-amounts',
    'Use the product guide as a starting point, then adjust for body condition and lifestyle.',
    array['What does your dog weigh?', 'How old and active are they?', 'Are you aiming to maintain, gain or lose weight?', 'Which product are you feeding?'],
    array['Growing puppies and dogs with medical weight concerns may need an individual plan from a veterinarian.'],
    array['feed', 'feeding', 'amount', 'portion', 'weight', 'cups', 'grams'],
    array[]::text[], true, 'baseline'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'Food for puppies',
    'Ask the puppy''s age, breed or expected adult size, current weight and current food. Puppies generally need multiple meals each day and their needs change quickly as they grow. Use the feeding guide for the specific puppy product and review growth and body condition regularly.',
    'puppies',
    'Puppies need a complete food appropriate for growth and feeding matched to age and expected adult size.',
    array['How old is your puppy?', 'What breed or expected adult size?', 'What do they weigh now?', 'What are they eating currently?'],
    array['Large-breed puppy nutrition needs particular care; seek veterinary guidance when unsure.'],
    array['puppy', 'puppies', 'growth', 'young dog'],
    array['puppy', 'growth'], true, 'baseline'
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'Supporting older dogs',
    'For an older dog, ask about weight trend, appetite, activity, dental comfort, current diet and any veterinary conditions. Some seniors benefit from controlled energy and highly digestible protein, while active older dogs may still need substantial nutrition.',
    'senior-dogs',
    'Choose food using the individual dog''s condition, activity and health rather than age alone.',
    array['How old and active is your dog?', 'Has their weight or appetite changed?', 'Do they have any diagnosed health conditions?'],
    array['Unexplained weight loss, appetite changes or increased thirst should be discussed with a veterinarian.'],
    array['senior', 'older', 'ageing', 'old dog', 'weight'],
    array['senior', 'weight-care'], true, 'baseline'
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    'Delivery and subscriptions',
    'Delivery areas, timeframes, costs and subscription rules must come from current store information. If live store information is unavailable, Buddy must say so and direct the customer to the store team for confirmation.',
    'customer-service',
    'Do not invent delivery promises or subscription terms when live store data is unavailable.',
    array['Which delivery area are you in?', 'Is this about a current order or a new purchase?'],
    array[]::text[],
    array['delivery', 'shipping', 'subscription', 'order', 'account'],
    array[]::text[], true, 'baseline'
  )
on conflict (id) do nothing;
