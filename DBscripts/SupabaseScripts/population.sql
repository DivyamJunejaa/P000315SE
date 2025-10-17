-- =========================================================
-- SAMPLE DATA can you see this 
-- =========================================================

-- USERS
insert into "USER" (email, username, password_hash, user_role)
values
('alice@example.com', 'alice', repeat('a', 40), 'admin'),
('bob@example.com', 'bob', repeat('b', 40), 'user'),
('carol@example.com', 'carol', repeat('c', 40), 'user'),
('dave@example.com', 'dave', repeat('d', 40), 'editor'),
('eva@example.com', 'eva', repeat('e', 40), 'user'),
('frank@example.com', 'frank', repeat('f', 40), 'user');

-- USER PROFILE
insert into "USERPROFILE" (email, first_name, last_name, avatar_url, organisation)
values
('alice@example.com', 'Alice', 'Anderson', 'https://pics.example.com/alice.png', 'Acme Corp'),
('bob@example.com', 'Bob', 'Brown', 'https://pics.example.com/bob.png', 'Beta Ltd'),
('carol@example.com', 'Carol', 'Clark', 'https://pics.example.com/carol.png', 'Gamma Inc'),
('dave@example.com', 'Dave', 'Davis', 'https://pics.example.com/dave.png', 'Acme Corp'),
('eva@example.com', 'Eva', 'Edwards', 'https://pics.example.com/eva.png', 'Delta Org'),
('frank@example.com', 'Frank', 'Foster', 'https://pics.example.com/frank.png', 'Zeta LLC');

-- USER AUTH PROVIDER
insert into "USERAUTHPROVIDER" (email, provider, provider_user_id, email_verified)
values
('alice@example.com', 'google', 'alice_g123', true),
('bob@example.com', 'google', 'bob_g123', false),
('carol@example.com', 'github', 'carol_gh123', true),
('dave@example.com', 'facebook', 'dave_fb123', true),
('eva@example.com', 'github', 'eva_gh123', false),
('frank@example.com', 'google', 'frank_g123', true);

-- USER TERMS ACCEPTANCE
insert into "USERTERMSACCEPTANCE" (email)
values
('alice@example.com'),
('bob@example.com'),
('carol@example.com'),
('dave@example.com'),
('eva@example.com'),
('frank@example.com');

-- USER NEWSLETTER SUBSCRIPTIONS
insert into "USERNEWSLETTERSUBS" (email)
values
('alice@example.com'),
('bob@example.com'),
('carol@example.com'),
('dave@example.com'),
('eva@example.com'),
('frank@example.com');

-- USER SESSIONS
insert into "USERSESSION" (user_id, login_at, logout_at)
values
(1, current_timestamp - interval '2 days', current_timestamp - interval '1 day'),
(2, current_timestamp - interval '3 days', current_timestamp - interval '2 days'),
(3, current_timestamp - interval '4 days', current_timestamp - interval '3 days'),
(4, current_timestamp - interval '1 days', current_timestamp),
(5, current_timestamp - interval '5 days', current_timestamp - interval '4 days'),
(6, current_timestamp - interval '6 days', current_timestamp - interval '5 days');

-- PASSWORD RESET TOKENS
insert into "PASSWORDRESETTOKENS" (user_id, email, token, expires_at)
values
(1, 'alice@example.com', md5('alice_reset'), current_timestamp + interval '1 day'),
(2, 'bob@example.com', md5('bob_reset'), current_timestamp + interval '1 day'),
(3, 'carol@example.com', md5('carol_reset'), current_timestamp + interval '1 day'),
(4, 'dave@example.com', md5('dave_reset'), current_timestamp + interval '1 day'),
(5, 'eva@example.com', md5('eva_reset'), current_timestamp + interval '1 day'),
(6, 'frank@example.com', md5('frank_reset'), current_timestamp + interval '1 day');

-- -- PLAN
-- insert into "PLAN" (name, price_cents, billing_interval)
-- values
-- ('Basic', 1000, 'month'),
-- ('Standard', 2000, 'month'),
-- ('Premium', 5000, 'month'),
-- ('Enterprise', 15000, 'year'),
-- ('Student', 500, 'month'),
-- ('NonProfit', 1200, 'year');

-- SUBSCRIPTION
insert into "SUBSCRIPTION" (email, plan_id, status, start_date, auto_renew)
values
('alice@example.com', 1, 'active', current_timestamp - interval '30 days', true),
('bob@example.com', 2, 'trialing', current_timestamp - interval '10 days', true),
('carol@example.com', 3, 'past_due', current_timestamp - interval '90 days', false),
('dave@example.com', 4, 'active', current_timestamp - interval '1 year', true),
('eva@example.com', 5, 'canceled', current_timestamp - interval '60 days', false),
('frank@example.com', 6, 'active', current_timestamp - interval '120 days', true);

-- -- INVOICE
-- insert into "INVOICE" (subscription_id, email, amount_cents, currency, status)
-- values
-- (1, 'alice@example.com', 1000, 'USD', 'paid'),
-- (2, 'bob@example.com', 2000, 'USD', 'draft'),
-- (3, 'carol@example.com', 5000, 'USD', 'open'),
-- (4, 'dave@example.com', 15000, 'USD', 'paid'),
-- (5, 'eva@example.com', 500, 'USD', 'void'),
-- (6, 'frank@example.com', 1200, 'USD', 'open');

-- -- PAYMENT
-- insert into "PAYMENT" (subscription_id, invoice_id, amount_cents, currency, status)
-- values
-- (1, 1, 1000, 'USD', 'completed'),
-- (2, 2, 2000, 'USD', 'pending'),
-- (3, 3, 5000, 'USD', 'failed'),
-- (4, 4, 15000, 'USD', 'completed'),
-- (5, 5, 500, 'USD', 'refunded'),
-- (6, 6, 1200, 'USD', 'completed');

-- PROJECT
insert into "PROJECT" (email, title)
values
('alice@example.com', 'AI Research'),
('bob@example.com', 'Web App'),
('carol@example.com', 'Data Pipeline'),
('dave@example.com', 'Mobile App'),
('eva@example.com', 'Finance Dashboard'),
('frank@example.com', 'Healthcare System');

-- PROJECT CANVAS
insert into "PROJECTCANVAS" (project_id, diagram_json)
values
(1, '{"nodes": ["start","ml_model","end"]}'),
(2, '{"nodes": ["frontend","backend","db"]}'),
(3, '{"nodes": ["extract","transform","load"]}'),
(4, '{"nodes": ["ui","api","server"]}'),
(5, '{"nodes": ["data","chart","report"]}'),
(6, '{"nodes": ["patient","doctor","report"]}');

-- EXPORT FILES
insert into "EXPORTFILE" (project_id, email, format, filename, status)
values
(1, 'alice@example.com', 'PDF', 'ai_research.pdf', 'ready'),
(2, 'bob@example.com', 'PNG', 'webapp.png', 'queued'),
(3, 'carol@example.com', 'SVG', 'pipeline.svg', 'processing'),
(4, 'dave@example.com', 'DOCX', 'mobile.docx', 'failed'),
(5, 'eva@example.com', 'PDF', 'finance.pdf', 'ready'),
(6, 'frank@example.com', 'PNG', 'healthcare.png', 'ready');



INSERT INTO public."TermsAndCondition" (key, value, updated_at)
VALUES (
  'terms_content',
  'These are the Terms and Conditions for using our service. By accessing or using our service, you agree to be bound by these terms. Please read them carefully before proceeding.',
  NOW()
);