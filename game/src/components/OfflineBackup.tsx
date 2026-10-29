import React, { useRef, useState } from 'react';
import { SAVE_KEY } from '../offline/fs';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes } from '@noble/hashes/utils';

const ID_KEY = 'hk_demo_tg_id';
const NAME_KEY = 'hk_demo_username';
const MAX_SIZE = 5 * 1024 * 1024;

export function OfflineBackup() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  function exportSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const id = localStorage.getItem(ID_KEY);
      if (!raw || !id) throw new Error('Сохранение пока не создано.');
      const data = { format: 'hacker-kombat-offline', version: 1, identity: id, name: localStorage.getItem(NAME_KEY), save: JSON.parse(raw) };
      const json = JSON.stringify(data);
      const android = (window as Window & { AndroidBackup?: { save: (content: string) => void } }).AndroidBackup;
      if (android) {
        android.save(json);
        setMessage('Выберите место для резервного файла.');
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'hacker-kombat-save.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setMessage('Файл подготовлен. Сохраните его в надёжном месте.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось создать файл.');
    }
  }

  async function importSave(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_SIZE) throw new Error('Файл сохранения слишком большой.');
      const data = JSON.parse(await file.text());
      if (data?.format !== 'hacker-kombat-offline' || data.version !== 1 ||
          typeof data.identity !== 'string' || !/^\d{1,16}$/.test(data.identity) ||
          (data.name !== null && typeof data.name !== 'string') ||
          !data.save || typeof data.save !== 'object' || Array.isArray(data.save) ||
          !data.save.playersByTgId || typeof data.save.playersByTgId !== 'object' || Array.isArray(data.save.playersByTgId) ||
          Object.keys(data.save.playersByTgId).length === 0) {
        throw new Error('Это не поддерживаемый файл сохранения.');
      }
      const digest = sha256(utf8ToBytes(`hk-guest-sandbox:${data.identity}`));
      const key = String(-(100_000_000 + new DataView(digest.buffer, digest.byteOffset).getUint32(0) % 800_000_000));
      const player = data.save.playersByTgId[key];
      if (!player || typeof player !== 'object' || Array.isArray(player) || player.tgId !== Number(key) ||
          typeof player.id !== 'string' || typeof player.stats !== 'object' || !player.stats) {
        throw new Error('Игрок в файле не соответствует сохранению.');
      }
      if (!window.confirm('Заменить текущий прогресс данными из файла? Отменить это действие не получится.')) return;
      const keys = [SAVE_KEY, ID_KEY, NAME_KEY];
      const previous = keys.map(key => localStorage.getItem(key));
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data.save));
        localStorage.setItem(ID_KEY, data.identity);
        if (data.name === null) localStorage.removeItem(NAME_KEY);
        else localStorage.setItem(NAME_KEY, data.name.slice(0, 24));
      } catch {
        keys.forEach((key, i) => {
          try { previous[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, previous[i]!); } catch { /* storage unavailable */ }
        });
        throw new Error('Не удалось записать сохранение на устройство.');
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось прочитать файл.');
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section className="rounded-xl bg-[#10172e] border border-slate-700 p-3 space-y-2" aria-label="Резервная копия">
      <h2 className="font-bold text-sm text-white">Сохранение игры</h2>
      <p className="text-xs text-slate-300">Прогресс хранится на устройстве и может исчезнуть при удалении игры или очистке данных. Сохраните резервный файл отдельно.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportSave} className="rounded-lg bg-cyan-400 text-slate-950 px-3 py-2 text-xs font-bold">Сохранить в файл</button>
        <button type="button" onClick={() => input.current?.click()} className="rounded-lg border border-slate-500 text-white px-3 py-2 text-xs font-bold">Загрузить из файла</button>
        <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={e => void importSave(e.target.files?.[0])} />
      </div>
      {message && <p role="status" className="text-xs text-amber-300">{message}</p>}
    </section>
  );
}
