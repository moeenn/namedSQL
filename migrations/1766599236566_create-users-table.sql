-- Up Migration
create type user_role as enum('admin', 'user');

create table
  users (
    id uuid
    , email text not null
    , password text not null
    , role user_role not null default 'user'
    , "isActive" boolean not null default true
    , "createdAt" timestamp not null default now()
    , "deletedAt" timestamp null
    , primary key (id)
    , constraint email_unique unique (email)
  )

-- Down Migration
drop table users;
drop type user_role;