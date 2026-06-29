-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Tables
create table public.restaurants (
    id uuid default uuid_generate_v4() primary key,
    owner_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    code text unique not null,
    logo_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.categories (
    id uuid default uuid_generate_v4() primary key,
    restaurant_id uuid references public.restaurants(id) on delete cascade not null,
    name text not null,
    sort_order integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.menu_items (
    id uuid default uuid_generate_v4() primary key,
    restaurant_id uuid references public.restaurants(id) on delete cascade not null,
    category_id uuid references public.categories(id) on delete set null,
    name text not null,
    description text,
    price numeric(10,2) not null,
    photo_url text,
    video_url text,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.orders (
    id uuid default uuid_generate_v4() primary key,
    restaurant_id uuid references public.restaurants(id) on delete cascade not null,
    table_number text not null,
    status text default 'pending' check (status in ('pending', 'delivered', 'cancelled')),
    total numeric(10,2) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.order_items (
    id uuid default uuid_generate_v4() primary key,
    order_id uuid references public.orders(id) on delete cascade not null,
    menu_item_id uuid references public.menu_items(id) on delete set null,
    quantity integer not null default 1,
    price numeric(10,2) not null
);

create table public.analytics (
    id uuid default uuid_generate_v4() primary key,
    restaurant_id uuid references public.restaurants(id) on delete cascade not null,
    menu_item_id uuid references public.menu_items(id) on delete cascade not null,
    views integer default 0,
    orders_count integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(restaurant_id, menu_item_id)
);


-- 2. Storage
insert into storage.buckets (id, name, public) values ('photos', 'photos', true);
insert into storage.buckets (id, name, public) values ('videos', 'videos', true);

-- Storage Policies
create policy "Public photos access" on storage.objects for select using (bucket_id = 'photos');
create policy "Authenticated photos upload" on storage.objects for insert with check (bucket_id = 'photos' and auth.role() = 'authenticated');
create policy "Public videos access" on storage.objects for select using (bucket_id = 'videos');
create policy "Authenticated videos upload" on storage.objects for insert with check (bucket_id = 'videos' and auth.role() = 'authenticated');


-- 3. Row Level Security (RLS)
alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.analytics enable row level security;

-- Restaurants: Owner can CRUD, Public can read (for customer menu)
create policy "Restaurants owner policy" on public.restaurants
    for all using (auth.uid() = owner_id);
create policy "Restaurants public read" on public.restaurants
    for select using (true);

-- Categories: Owner can CRUD, Public can read
create policy "Categories owner policy" on public.categories
    for all using (
        exists (select 1 from public.restaurants where id = restaurant_id and owner_id = auth.uid())
    );
create policy "Categories public read" on public.categories
    for select using (true);

-- Menu Items: Owner can CRUD, Public can read
create policy "Menu items owner policy" on public.menu_items
    for all using (
        exists (select 1 from public.restaurants where id = restaurant_id and owner_id = auth.uid())
    );
create policy "Menu items public read" on public.menu_items
    for select using (is_active = true);

-- Orders: Owner can CRUD, Public can INSERT (customers ordering)
create policy "Orders owner policy" on public.orders
    for all using (
        exists (select 1 from public.restaurants where id = restaurant_id and owner_id = auth.uid())
    );
create policy "Orders public insert" on public.orders
    for insert with check (true);

-- Order Items: Owner can CRUD, Public can INSERT
create policy "Order items owner policy" on public.order_items
    for all using (
        exists (
            select 1 from public.orders o
            join public.restaurants r on r.id = o.restaurant_id
            where o.id = order_id and r.owner_id = auth.uid()
        )
    );
create policy "Order items public insert" on public.order_items
    for insert with check (true);

-- Analytics: Owner can read/update, Public can insert/update (views/orders)
create policy "Analytics owner policy" on public.analytics
    for all using (
        exists (select 1 from public.restaurants where id = restaurant_id and owner_id = auth.uid())
    );
create policy "Analytics public insert update" on public.analytics
    for all using (true) with check (true); -- Allow upsert for views/orders


-- 4. Enable Realtime on Orders
alter publication supabase_realtime add table public.orders;
