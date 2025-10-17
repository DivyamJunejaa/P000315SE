-- =========================================================
-- 1) EXTENSIONS & ENUMS
-- =========================================================
create extension if not exists pgcrypto;

do $$ begin create type billing_interval_enum as enum ('month','year'); exception when duplicate_object then null; end $$;
do $$ begin create type subscription_status_enum as enum ('trialing','active','past_due','canceled','incomplete'); exception when duplicate_object then null; end $$;
do $$ begin create type invoice_status_enum       as enum ('draft','open','paid','void','uncollectible'); exception when duplicate_object then null; end $$;
do $$ begin create type export_status_enum        as enum ('queued','processing','ready','failed'); exception when duplicate_object then null; end $$;

-- =========================================================
-- 2) CORE USER & AUTH (ALL-CAPS TABLE NAMES)
-- =========================================================
create table if not exists "User" (
  user_id       serial primary key,
  email         varchar(255) not null unique check (position('@' in email) > 1),
  username      varchar(100),
  password_hash varchar(255) check (password_hash is null or length(password_hash) >= 20),
  created_at    timestamp not null default current_timestamp,
  user_role     varchar(50)
);

create table if not exists "UserProfile" (
  email        varchar(255) primary key references "User"(email) on delete cascade,
  first_name   varchar(100),
  last_name    varchar(100),
  avatar_url   text,
  organisation varchar(255),
  updated_at   timestamp not null default current_timestamp
);

create table if not exists "UserAuthProvider" (
  auth_id          serial primary key,
  email            varchar(255) not null references "User"(email) on delete cascade,
  provider         varchar(100) not null,
  provider_user_id varchar(255) not null,
  email_verified   boolean not null default false,
  linked_at        timestamp,
  constraint uq_auth_provider unique (provider, provider_user_id)
);

create table if not exists "UserTermsAcceptance" (
  email       varchar(255) primary key references "User"(email) on delete cascade,
  accepted_at timestamp not null default current_timestamp
);

create table if not exists "UserNewsLetterSubs" (
  email       varchar(255) primary key references "User"(email) on delete cascade,
  accepted_at timestamp not null default current_timestamp
);

create table if not exists "UserSession" (
  session_id serial primary key,
  user_id    int not null references "User"(user_id) on delete cascade,
  login_at   timestamp not null default current_timestamp,
  logout_at  timestamp
);

create table if not exists "PasswordResetTokens" (
  id        serial primary key,
  user_id   int not null references "User"(user_id) on delete cascade,
  email     varchar(255) not null references "User"(email) on delete cascade,
  token     varchar(255) not null unique,
  expires_at timestamp not null,
  created_at timestamp not null default current_timestamp
);

-- =========================================================
-- 3) PLANS / BILLING
-- =========================================================
-- create table if not exists "Plan" (
--   plan_id          varchar(25) serial primary key,
--   name             varchar(100) not null unique,
--   price_cents      int not null check (price_cents >= 0),
--   billing_interval billing_interval_enum not null
-- );

create table if not exists "Subscription" (
  subscription_ID varchar(255) NOT NULL,
  email           varchar(255) not null references "User"(email) on delete cascade,
  plan_ID         varchar(25) not null,  
  status          subscription_status_enum not null,
  start_date      timestamp not null default current_timestamp,
  renewal_date    timestamp,
  updated_at      timestamp not null default current_timestamp,
  expires_at      timestamp,
  auto_renew      boolean not null default true,
  check (renewal_date is null or renewal_date >= start_date),
  check (expires_at  is null or expires_at  >= start_date)
);


CREATE TABLE public."TermsAndCondition" (
  id serial NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT TermsAndCondition_pkey PRIMARY KEY (id),
  CONSTRAINT TermsAndCondition_key_key UNIQUE (key)
) TABLESPACE pg_default;
 



-- create table if not exists "Invoice" (
--   invoice_id      serial primary key,
--   subscription_id int not null references "Subscription"(subscription_id) on delete cascade,
--   email           varchar(255) not null references "User"(email) on delete cascade,
--   amount_cents    int not null check (amount_cents >= 0),
--   currency        varchar(10) not null check (currency ~ '^[A-Z]{3}$'),
--   period_start    timestamp,
--   period_end      timestamp,
--   issued_at       timestamp not null default current_timestamp,
--   due_at          timestamp,
--   status          invoice_status_enum not null,
--   pdf_url         text,
--   is_public       boolean not null default false,
--   check (period_end is null or period_start is null or period_end >= period_start),
--   check (due_at is null or due_at >= issued_at)
-- );

-- create table if not exists "Payment" (
--   payment_id        serial primary key,
--   subscription_id   int not null references "Subscription"(subscription_id) on delete cascade,
--   invoice_id        int null references "Invoice"(invoice_id) on delete set null,
--   amount_cents      int not null check (amount_cents >= 0),
--   currency          varchar(10) not null check (currency ~ '^[A-Z]{3}$'),
--   provider_intent_id varchar(255),
--   provider_method_id varchar(255),
--   paid_at           timestamp,
--   status            varchar(50)
-- );

-- =========================================================
-- 4) PROJECTS
-- =========================================================
create table if not exists "Project" (
  project_id   serial primary key,
  email        varchar(255) not null references "User"(email) on delete cascade,
  title        varchar(255) not null check (length(btrim(title)) > 0),
  updated_at   timestamp not null default current_timestamp,
  created_at   timestamp not null default current_timestamp
);

-- create table if not exists "ProjectCanvas" (
--   project_id   int primary key references "Project"(project_id) on delete cascade,
--   diagram_json jsonb,
--   updated_at   timestamp not null default current_timestamp
-- );

create table if not exists "ExportFile" (
  file_id      serial primary key,
  project_id   int not null references "Project"(project_id) on delete cascade,
  email        varchar(255) not null references "User"(email) on delete cascade,
  format       varchar(50) not null check (format in ('PDF','PNG','SVG','DOCX')),
  download_url text,
  filename     varchar(255),
  status       export_status_enum not null default 'queued',
  created_at   timestamp not null default current_timestamp,
  updated_at   timestamp not null default current_timestamp,
  expires_at   timestamp
);

-- =========================================================
-- 5) INDEXES
-- =========================================================
drop index if exists ux_sub_one_active;
create unique index ux_sub_one_active on "Subscription"(email)
  where status in ('trialing','active','past_due');

-- create index if not exists ix_invoice_email_status on "Invoice"(email, status);
create index if not exists ix_project_email        on "Project"(email);
-- create index if not exists ix_export_project       on "ExportFile"(project_id);
-- create index if not exists ix_export_status        on "ExportFile"(status);
create index if not exists ix_authprovider_email   on "UserAuthProvider"(email);
create index if not exists ix_subscription_email   on "Subscription"(email);

create index if not exists ix_usernewsletter_email on "UserNewsLetterSubs"(email);
create index if not exists ix_usersession_user_id  on "UserSession"(user_id);

-- =========================================================
-- 6) updated_at TRIGGERS
-- =========================================================
create or replace function set_updated_at() returns trigger as $$
begin
  if new is distinct from old then
    new.updated_at := current_timestamp;
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_userprofile_updated  on "UserProfile";
drop trigger if exists trg_subscription_updated on "Subscription";
drop trigger if exists trg_project_updated      on "Project";
-- drop trigger if exists trg_canvas_updated       on "ProjectCanvas";
-- drop trigger if exists trg_export_updated       on "ExportFile";

create trigger trg_userprofile_updated  before update on "UserProfile"   for each row execute procedure set_updated_at();
create trigger trg_subscription_updated before update on "Subscription"  for each row execute procedure set_updated_at();
create trigger trg_project_updated      before update on "Project"       for each row execute procedure set_updated_at();
-- create trigger trg_canvas_updated       before update on "ProjectCanvas" for each row execute procedure set_updated_at();
-- create trigger trg_export_updated       before update on "ExportFile"    for each row execute procedure set_updated_at();