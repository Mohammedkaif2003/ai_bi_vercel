-- 1. Create a table to track user datasets
create table if not exists public.datasets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) not null,
    filename text not null,
    storage_path text not null,
    row_count integer,
    column_count integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS) on the datasets table
alter table public.datasets enable row level security;

-- 3. Create RLS policies for the datasets table
-- Users can only view their own datasets
drop policy if exists "Users can view their own datasets" on public.datasets;
create policy "Users can view their own datasets" 
on public.datasets for select 
using (auth.uid() = user_id);

-- Users can only insert their own datasets
drop policy if exists "Users can insert their own datasets" on public.datasets;
create policy "Users can insert their own datasets" 
on public.datasets for insert 
with check (auth.uid() = user_id);

-- Users can only delete their own datasets
drop policy if exists "Users can delete their own datasets" on public.datasets;
create policy "Users can delete their own datasets" 
on public.datasets for delete 
using (auth.uid() = user_id);

-- Users can only update their own datasets
drop policy if exists "Users can update their own datasets" on public.datasets;
create policy "Users can update their own datasets" 
on public.datasets for update 
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- 4. Create a Storage Bucket for the CSV files
insert into storage.buckets (id, name, public) 
values ('user_datasets', 'user_datasets', false)
on conflict (id) do nothing;


-- 6. Create RLS policies for the storage bucket
-- Users can only upload files to their own folder (folder name = user_id)
drop policy if exists "Users can upload their own datasets" on storage.objects;
create policy "Users can upload their own datasets"
on storage.objects for insert
with check (
    bucket_id = 'user_datasets' and 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only read files from their own folder
drop policy if exists "Users can read their own datasets" on storage.objects;
create policy "Users can read their own datasets"
on storage.objects for select
using (
    bucket_id = 'user_datasets' and 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only delete files from their own folder
drop policy if exists "Users can delete their own datasets" on storage.objects;
create policy "Users can delete their own datasets"
on storage.objects for delete
using (
    bucket_id = 'user_datasets' and 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only update files in their own folder
drop policy if exists "Users can update their own datasets" on storage.objects;
create policy "Users can update their own datasets"
on storage.objects for update
using (
    bucket_id = 'user_datasets' and 
    (storage.foldername(name))[1] = auth.uid()::text
)
with check (
    bucket_id = 'user_datasets' and 
    (storage.foldername(name))[1] = auth.uid()::text
);


-- ==========================================
-- Security Fixes for Chat Tables
-- ==========================================

-- 7. Enable RLS on chat tables
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- 8. Policies for chat_sessions (Split into strict CRUD operations)
drop policy if exists "Users can manage their own chat sessions" on public.chat_sessions;
drop policy if exists "Users can select their own chat sessions" on public.chat_sessions;
drop policy if exists "Users can insert their own chat sessions" on public.chat_sessions;
drop policy if exists "Users can update their own chat sessions" on public.chat_sessions;
drop policy if exists "Users can delete their own chat sessions" on public.chat_sessions;

create policy "Users can select their own chat sessions"
on public.chat_sessions for select to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own chat sessions"
on public.chat_sessions for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own chat sessions"
on public.chat_sessions for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own chat sessions"
on public.chat_sessions for delete to authenticated
using (auth.uid() = user_id);


-- 9. Policies for chat_messages (Split into strict CRUD operations)
drop policy if exists "Users can manage their own chat messages" on public.chat_messages;
drop policy if exists "Users can select their own chat messages" on public.chat_messages;
drop policy if exists "Users can insert their own chat messages" on public.chat_messages;
drop policy if exists "Users can update their own chat messages" on public.chat_messages;
drop policy if exists "Users can delete their own chat messages" on public.chat_messages;

create policy "Users can select their own chat messages"
on public.chat_messages for select to authenticated
using (session_id in (select id from public.chat_sessions where user_id = auth.uid()));

create policy "Users can insert their own chat messages"
on public.chat_messages for insert to authenticated
with check (session_id in (select id from public.chat_sessions where user_id = auth.uid()));

create policy "Users can update their own chat messages"
on public.chat_messages for update to authenticated
using (session_id in (select id from public.chat_sessions where user_id = auth.uid()))
with check (session_id in (select id from public.chat_sessions where user_id = auth.uid()));

create policy "Users can delete their own chat messages"
on public.chat_messages for delete to authenticated
using (session_id in (select id from public.chat_sessions where user_id = auth.uid()));
-- ==========================================
-- Database Schema Updates for Global History
-- ==========================================

-- 10. Add dataset_key to chat_sessions to support global chat history
alter table public.chat_sessions add column if not exists dataset_key text;

-- 11. Add title to chat_sessions for ChatGPT-style sidebar
alter table public.chat_sessions add column if not exists title text;
