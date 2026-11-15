create schema if not exists pushkar_phone_auth;

create table if not exists pushkar_phone_auth."user" (
  "id" text primary key not null,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null default false,
  "image" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "phoneNumber" text unique,
  "phoneNumberVerified" boolean
);

create table if not exists pushkar_phone_auth."session" (
  "id" text primary key not null,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references pushkar_phone_auth."user" ("id") on delete cascade
);

create table if not exists pushkar_phone_auth."account" (
  "id" text primary key not null,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references pushkar_phone_auth."user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null
);

create table if not exists pushkar_phone_auth."verification" (
  "id" text primary key not null,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists pushkar_phone_auth_session_user_id_idx
  on pushkar_phone_auth."session" ("userId");
create index if not exists pushkar_phone_auth_account_user_id_idx
  on pushkar_phone_auth."account" ("userId");
create index if not exists pushkar_phone_auth_verification_identifier_idx
  on pushkar_phone_auth."verification" ("identifier");
