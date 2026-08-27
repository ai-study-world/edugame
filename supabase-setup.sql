-- ============================================================
-- edugame 解锁码表 + 防转发 RPC 函数（Supabase SQL）
-- 在 Supabase 控制台 → SQL Editor 里执行整个文件
-- ============================================================

-- 1. 建表：解锁码 + 使用状态
create table if not exists public.unlock_codes (
  id bigint generated always as identity primary key,
  code text not null unique,             -- 解锁码，如 9.98W27
  used boolean not null default false,   -- 是否已使用
  used_at timestamptz,                   -- 使用时间
  used_by text                           -- 使用者的设备标识（可选）
);

-- 2. 插入 20 个解锁码（改成你的码）
insert into public.unlock_codes (code) values
  ('9.98W27'),
  ('9.92HA9'),
  ('9.9V6KS'),
  ('9.9DVCX'),
  ('9.9TGBJ'),
  ('9.93JJV'),
  ('9.9R797'),
  ('9.98BY5'),
  ('9.9DJSQ'),
  ('9.9RED7'),
  ('9.9WD96'),
  ('9.9AUUP'),
  ('9.997YB'),
  ('9.93U2W'),
  ('9.96Z5Y'),
  ('9.9MYX4'),
  ('9.97KEC'),
  ('9.9AHYS'),
  ('9.9HKSD'),
  ('9.9BZRQ')
on conflict (code) do nothing;

-- 3. RPC 函数：校验 + 原子标记已用（防并发/防重复使用）
create or replace function public.redeem_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.unlock_codes;
begin
  -- 大小写不敏感 + 去空格
  select * into v_row
  from public.unlock_codes
  where upper(code) = upper(btrim(p_code));

  if v_row is null then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_row.used then
    return json_build_object('ok', false, 'reason', 'used');
  end if;

  -- 原子标记已用（conditional update，防止并发双花）
  update public.unlock_codes
  set used = true, used_at = now()
  where id = v_row.id and used = false
  returning * into v_row;

  if v_row.used then
    return json_build_object('ok', true, 'code', v_row.code);
  else
    return json_build_object('ok', false, 'reason', 'used');
  end if;
end;
$$;

-- 4. 授权匿名用户可调用 RPC（但不可直接读表）
revoke all on public.unlock_codes from anon, authenticated;
grant execute on function public.redeem_code(text) to anon, authenticated;

-- ============================================================
-- 完成后在 Supabase 左侧确认：
--   ✅ Table Editor 里有 unlock_codes 表（20 行）
--   ✅ Database → Functions 里有 redeem_code 函数
-- 然后把 SUPABASE_URL 和 SUPABASE_ANON_KEY 填到 SUPABASE.md
-- ============================================================