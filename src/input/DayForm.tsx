import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { analyzePreview } from '../audio/analyze';
import { refreshPreview } from '../audio/itunes';
import { buildDaySpec } from '../rules';
import { EMPTY_DESIGN, reflow } from '../rules/sheet';
import type {
  DayInput,
  Mood,
  Overrides,
  PageSpec,
  PhotoInput,
  SongFeatures,
  SongInput,
} from '../types/dayspec';
import type { SheetDesign } from '../types/sheet';
import { getDayWeather } from '../weather';
import type { DayErrors, DayField, PlaceKey } from './editor/context';
import { SheetEditor } from './editor/SheetEditor';
import { useHistory } from './editor/useHistory';
import type { SongChoice } from './SongPicker';
import { usePhotos, type PhotoItem } from './usePhotos';

export interface DayFormProps {
  /** Номер нового дня в архиве. */
  nextNumber: number;
  /** Сохранённый день, если его правят. */
  initial?: { input: DayInput; photos: Record<string, Blob> };
  /**
   * Готовый день: DayInput (у своих фото src пустой) и сами фото по PhotoInput.id.
   * Дальше приложение сохраняет день и открывает его в галерее.
   */
  onDone(input: DayInput, photos: Record<string, Blob>): void | Promise<void>;
  onCancel(): void;
}

const AUDIO_TIMEOUT_MS = 20_000;

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Разбор фрагмента песни; любая неудача — null, день складывается без признаков звука. */
async function listen(song: SongInput, signal: AbortSignal) {
  try {
    const url =
      song.previewUrl ?? (song.trackId ? await refreshPreview(song.trackId, signal) : null);
    if (!url) return null;
    const limit = AbortSignal.timeout(AUDIO_TIMEOUT_MS);
    return await analyzePreview(url, AbortSignal.any([signal, limit]));
  } catch {
    signal.throwIfAborted();
    return null;
  }
}

function savedPhotos(day: NonNullable<DayFormProps['initial']>): PhotoItem[] {
  return day.input.photos.flatMap(({ id, width, height, palette, lightness, focus }) => {
    const blob = day.photos[id];
    if (!blob) return [];
    const prepared = { blob, width, height, palette, lightness };
    return [{ id, name: '', status: 'ready', prepared, focus } satisfies PhotoItem];
  });
}

function photoInputs(items: PhotoItem[], saved?: DayInput): PhotoInput[] {
  return items.flatMap(({ id, url, prepared, focus }) => {
    if (!prepared) return [];
    const caption = saved?.photos.find((p) => p.id === id)?.caption;
    const { width, height, palette, lightness } = prepared;
    return [
      {
        id,
        src: url ?? '',
        width,
        height,
        palette,
        lightness,
        ...(focus ? { focus } : {}),
        ...(caption !== undefined ? { caption } : {}),
      },
    ];
  });
}

const photoMarks = (items: PhotoItem[]) =>
  items.map((p) => `${p.id}:${p.focus?.x},${p.focus?.y}`).join();

/**
 * Экран «Записать день»: сразу редактор листа. Здесь живёт черновик (текст, 1–5 фото,
 * настроение, песня, погода, правки листа), а рисует и собирает поля SheetEditor.
 */
export function DayForm({ nextNumber, initial, onDone, onCancel }: DayFormProps) {
  const saved = initial?.input;
  const [date, setDate] = useState(() => saved?.date ?? today());
  const [text, setText] = useState(saved?.text ?? '');
  const [mood, setMood] = useState<Mood | undefined>(saved?.mood);
  const [choice, setChoice] = useState<SongChoice>({
    song: saved?.song ?? null,
    skipped: !!saved && !saved.song,
  });
  const [withWeather, setWithWeather] = useState(true);
  const [place, setPlace] = useState<PlaceKey>('taldykorgan');
  const [errors, setErrors] = useState<DayErrors>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [failure, setFailure] = useState('');
  const [leaving, setLeaving] = useState(false);

  const [firstPhotos] = useState(() => initial && savedPhotos(initial));
  const photos = usePhotos(firstPhotos);
  const sheet = useHistory<Overrides>(saved?.overrides ?? {});
  // Лист, каким его видел автор, когда менял: по нему видно, что он трогал, а что нет.
  const [seenPages] = useState(() => new WeakMap<SheetDesign, PageSpec>());
  const [heard, setHeard] = useState<{ song: SongInput; features: SongFeatures }>();
  const hearing = useRef<{ song: SongInput; job: Promise<SongFeatures | null> } | null>(null);
  const exiting = useRef(false);
  const busyRef = useRef(false);
  const ctlRef = useRef<AbortController | null>(null);

  useEffect(() => () => ctlRef.current?.abort(), []);

  // Песню разбираем сразу, как выбрали: лист должен заранее видеть её темп и энергию.
  useEffect(() => {
    const song = choice.song;
    if (!song || song.features) return;
    const ctl = new AbortController();
    const job = listen(song, ctl.signal).catch(() => null);
    hearing.current = { song, job };
    void job.then((features) => {
      if (features && !ctl.signal.aborted) setHeard({ song, features });
    });
    return () => ctl.abort();
  }, [choice.song]);

  const draft = useMemo<DayInput>(() => {
    const song = choice.song;
    return {
      date: date || today(),
      number: nextNumber,
      text: text.trim(),
      photos: photoInputs(
        photos.items.filter((p) => p.url),
        saved,
      ),
      song: song && heard?.song === song ? { ...song, features: heard.features } : song,
      ...(mood ? { mood } : {}),
      ...(saved?.weather ? { weather: saved.weather } : {}),
    };
  }, [date, nextNumber, text, photos.items, choice.song, heard, mood, saved]);
  // Разворот на полкадра отстаёт от набора, зато буквы в поле не ждут его.
  const settled = useDeferredValue(draft);
  const { folderName, keySentence, keyPhotoId } = sheet.now;
  const base = useMemo(
    () => buildDaySpec({ ...settled, overrides: { folderName, keySentence, keyPhotoId } }),
    [settled, folderName, keySentence, keyPhotoId],
  );
  const palette = useMemo(
    () =>
      [...new Set(draft.photos.flatMap((p) => p.palette))]
        .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
        .slice(0, 10),
    [draft.photos],
  );

  /** В новой записи нетронутое идёт за правилами, у сохранённой лист уже сложен. */
  const follow = useCallback(
    (design: SheetDesign | undefined, page: PageSpec) => {
      const before = design && seenPages.get(design);
      return design && before && !saved ? reflow(design, before, page) : design;
    },
    [saved, seenPages],
  );
  const design = useMemo(
    () => follow(sheet.now.design, base.page),
    [follow, sheet.now.design, base.page],
  );
  const changeDesign = (next: (design: SheetDesign) => SheetDesign, tag?: string) =>
    sheet.change((now) => {
      const changed = next(follow(now.design, base.page) ?? EMPTY_DESIGN);
      seenPages.set(changed, base.page);
      return { ...now, design: changed };
    }, tag);

  const dirty =
    sheet.canUndo ||
    text !== (saved?.text ?? '') ||
    mood !== saved?.mood ||
    choice.song !== (saved?.song ?? null) ||
    photoMarks(photos.items) !== photoMarks(firstPhotos ?? []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const validate = (): DayErrors => {
    const e: DayErrors = {};
    if (!date) e.date = 'Укажите дату дня.';
    if (!text.trim()) e.text = 'Напишите хотя бы пару строк о дне.';
    if (photos.items.some((p) => p.status === 'loading')) {
      e.photos = 'Фото ещё готовятся, подождите секунду.';
    } else if (!photos.items.length) {
      e.photos = 'Добавьте хотя бы одно фото.';
    }
    if (!choice.song && !choice.skipped) {
      e.song = 'Выберите песню или нажмите «Сохранить без песни».';
    }
    return e;
  };

  const save = async () => {
    busyRef.current = true;
    setBusy(true);
    const ctl = new AbortController();
    ctlRef.current = ctl;
    try {
      let song = choice.song;
      if (song) {
        setStatus('Слушаю песню…');
        const early = hearing.current?.song === song ? await hearing.current.job : null;
        ctl.signal.throwIfAborted();
        song = { ...song, features: song.features ?? early ?? (await listen(song, ctl.signal)) };
      }

      let weather: Awaited<ReturnType<typeof getDayWeather>>;
      const first = photos.items[0].prepared;
      if (saved) weather = saved.weather;
      else if (withWeather) {
        setStatus('Смотрю погоду…');
        const recordedAt = date === today() ? new Date().toISOString() : `${date}T12:00:00`;
        weather = await getDayWeather({
          enabled: true,
          takenAt: first?.takenAt,
          recordedAt,
          place,
          signal: ctl.signal,
        }).catch(() => {
          ctl.signal.throwIfAborted();
          return undefined;
        });
      }

      setStatus('Складываю страницы…');
      const blobs: Record<string, Blob> = {};
      for (const item of photos.items) if (item.prepared) blobs[item.id] = item.prepared.blob;
      const list = photoInputs(photos.items, saved).map((photo) => ({ ...photo, src: '' }));
      const takenAt = saved ? saved.takenAt : first?.takenAt;
      const input: DayInput = {
        date,
        number: nextNumber,
        text: text.trim(),
        photos: list,
        song,
        ...(mood ? { mood } : {}),
        ...(weather ? { weather } : {}),
        ...(takenAt ? { takenAt } : {}),
      };
      const { design: edited, ...words } = sheet.now;
      const overrides: Overrides = { ...words };
      if (edited) {
        // Раскладку досчитываем по готовому дню: погода и разбор песни уже в нём.
        overrides.design = follow(edited, buildDaySpec({ ...input, overrides: words }).page);
      }
      if (Object.keys(overrides).length) input.overrides = overrides;
      setStatus('Сохраняю день…');
      await onDone(input, blobs);
    } catch (err) {
      if (ctl.signal.aborted) return;
      const reason = err instanceof Error && err.message ? err.message : 'неизвестная ошибка';
      setFailure(
        `Не получилось сохранить день: ${reason}. Запись осталась, нажмите кнопку ещё раз.`,
      );
      setStatus('');
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** Не хватает поля — возвращает его, редактор туда и отведёт. */
  const submit = (): DayField | undefined => {
    if (busyRef.current || exiting.current) return;
    const found = validate();
    setErrors(found);
    setFailure('');
    setLeaving(false);
    const missing = (['date', 'text', 'photos', 'song'] as const).find((field) => found[field]);
    if (missing) return missing;
    void save();
    return undefined;
  };

  const leave = () => {
    if (exiting.current) return;
    exiting.current = true;
    ctlRef.current?.abort();
    onCancel();
  };
  const cancel = () => {
    // Записанное одним случайным нажатием не выбрасываем.
    if (dirty && !busy) setLeaving(true);
    else leave();
  };

  // Ошибка у поля уходит, как только человек её исправил.
  const shown: DayErrors = {
    date: date ? undefined : errors.date,
    text: text.trim() ? undefined : errors.text,
    photos:
      photos.items.length && photos.items.every((p) => p.status === 'ready')
        ? undefined
        : errors.photos,
    song: choice.song || choice.skipped ? undefined : errors.song,
  };

  return (
    <SheetEditor
      saved={!!saved}
      number={nextNumber}
      lastDate={today()}
      base={base}
      design={design}
      history={sheet}
      palette={palette}
      date={date}
      onDate={setDate}
      text={text}
      onText={setText}
      mood={mood}
      onMood={setMood}
      photos={photos}
      choice={choice}
      onChoice={setChoice}
      weather={
        saved ? null : { on: withWeather, onToggle: setWithWeather, place, onPlace: setPlace }
      }
      errors={shown}
      dirty={dirty}
      busy={busy}
      status={status}
      failure={failure}
      leaving={leaving}
      onDesign={changeDesign}
      onSave={submit}
      onCancel={cancel}
      onBack={() => {
        if (!busyRef.current && !exiting.current) setLeaving(true);
      }}
      onStay={() => setLeaving(false)}
      onLeave={leave}
    />
  );
}
