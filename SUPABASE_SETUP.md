# 🗄️ Supabase 云端解锁码配置指南（5 步，约 15 分钟）

这个系统让你的解锁码**每个只能使用一次**（防转发）：用户输入码时，网页会去 Supabase 云端核对，已用过的码立即作废。所有解锁码由你在云端管理，**网页源码里看不到码表**。

---

## 第 1 步：注册 Supabase（免费）

1. 打开 https://supabase.com/ ，点 **Start your project**（可用 GitHub 登录，最快）
2. 免费套餐 Free Plan 即可，无需绑卡
3. 进入控制台后点 **New project**：
   - **Name**：随意，如 `edugame-codes`
   - **Database Password**：自己设一个（记下来）
   - **Region**：选 `Southeast Asia (Singapore)`（离国内最近，延迟最低）
4. 等 1-2 分钟创建完成

## 第 2 步：执行建库 SQL

1. 左侧菜单点 **SQL Editor** → **New query**
2. 把项目里的 **`supabase-setup.sql`** 文件内容全部复制粘贴进去
3. 点 **Run**（运行）
4. 确认输出没有报错（应该看到 "Success. No rows returned"）

## 第 3 步：确认表和数据

1. 左侧点 **Table Editor** → 应看到 `unlock_codes` 表
2. 点开表 → 应有 **20 行**数据（你卖一批就发一批码）

## 第 4 步：拿到 URL 和密钥，填入配置

1. 左侧点 **Project Settings**（齿轮图标）→ **API**
2. 复制两个值：
   - **Project URL**（形如 `https://xxxx.supabase.co`）→ 填入 `supabase.md` 的 `SUPABASE_URL`
   - **anon public** 密钥（形如 `eyJhbGci...`）→ 填入 `supabase.md` 的 `SUPABASE_ANON_KEY`
3. 保存 `supabase.md`，然后告诉我"填好了"，我帮你重新部署

## 第 5 步：验证

部署后，我自己会先用一个解锁码测试：
- ✅ 输入正确码 → 解锁成功
- ✅ 再次输入同一码 → 提示"已使用"
- ✅ 输入错码 → 提示"无效"

---

## 📌 日常使用说明

| 操作 | 方法 |
|---|---|
| **查看哪些码已用** | Supabase → Table Editor → unlock_codes 表，`used=true` 的即已发出 |
| **新增一批码** | SQL Editor 执行 `insert into unlock_codes (code) values ('9.9XXXX');` |
| **想作废某人** | Table Editor 里把该码 `used` 改回 `false`（回收） |
| **改解锁金额文案** | 改 game.js 里 `PAY_AMOUNT` |

## ⚠️ 安全提醒
- `SUPABASE_ANON_KEY` 是公钥（前端本来就公开），但**有 RLS/函数权限保护**，匿名用户只能调用 `redeem_code` 函数、不能读码表——这就是防转发的关键
- 不要把你的 **service_role** 密钥（另一个 key）填进前端，那等于把数据库钥匙公开