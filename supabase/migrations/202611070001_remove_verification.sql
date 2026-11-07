-- 本編から独立した通信試遊の関数とデータだけを撤去する。
-- cloud_saves・battle_ledger・認証ユーザー・冒険の記録は変更しない。
drop function if exists public.dos_choice_trial_begin(text,text);
drop function if exists public.dos_choice_trial_append(uuid,integer,uuid,jsonb);
drop function if exists public.dos_choice_trial_close(uuid);
drop schema if exists choice_trial cascade;
