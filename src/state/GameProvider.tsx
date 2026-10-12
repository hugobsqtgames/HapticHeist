import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { SoundEngine } from '@/engine/audio/SoundEngine';
import { HapticEngine } from '@/engine/haptics';
import { generateLoot, getHeistConfig } from '@/game/content';
import { CareerWriter, MAX_LOOT_ITEMS, defaultCareer, loadCareer } from '@/storage/career';
import type { Career, HeistResult, LootItem, Settings } from '@/types/game';

interface GameContextValue {
  /** Carrière persistée (null tant que le chargement local n'est pas terminé). */
  career: Career | null;
  /** Niveau ciblé par le prochain briefing / casse. */
  heistLevel: number;
  setHeistLevel: (level: number) => void;
  /** Résultat du dernier casse, lu par les écrans Succès / Arrêté. */
  lastResult: HeistResult | null;
  /** Objet à mettre en évidence dans la salle au trésor. */
  highlightId: string | null;
  setHighlightId: (id: string | null) => void;
  recordSuccess: (r: Omit<HeistResult, 'loot'>) => LootItem;
  recordFailure: (r: HeistResult) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  completeTutorial: () => void;
  resetCareer: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [career, setCareer] = useState<Career | null>(null);
  const [heistLevel, setHeistLevel] = useState(1);
  const [lastResult, setLastResult] = useState<HeistResult | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const careerRef = useRef<Career | null>(null);
  careerRef.current = career;

  // Chargement local + application des réglages aux moteurs
  useEffect(() => {
    let alive = true;
    void (async () => {
      const c = await loadCareer();
      if (!alive) return;
      HapticEngine.configure(c.settings);
      SoundEngine.configure(c.settings);
      careerRef.current = c;
      setCareer(c);
      setHeistLevel(c.level);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Sauvegarde immédiate en arrière-plan, pause / reprise de l'audio
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') SoundEngine.resumeAll();
      else {
        void CareerWriter.flush();
        SoundEngine.pauseAll();
      }
    });
    return () => sub.remove();
  }, []);

  const update = useCallback((fn: (c: Career) => Career) => {
    const prev = careerRef.current;
    if (!prev) return;
    const next = fn(prev);
    careerRef.current = next;
    setCareer(next);
    CareerWriter.schedule(next);
  }, []);

  const recordSuccess = useCallback(
    (r: Omit<HeistResult, 'loot'>) => {
      const blind = careerRef.current?.settings.blind ?? false;
      const loot = generateLoot(getHeistConfig(r.level), blind);
      update((prev) => ({
        ...prev,
        heists: prev.heists + 1,
        totalLoot: prev.totalLoot + loot.value,
        loot: [loot, ...prev.loot].slice(0, MAX_LOOT_ITEMS),
        level: Math.max(prev.level, r.level + 1),
        bestTimeMs: prev.bestTimeMs === 0 ? r.timeMs : Math.min(prev.bestTimeMs, r.timeMs),
        pinsCracked: prev.pinsCracked + r.pinsDone,
        trapsTriggered: prev.trapsTriggered + r.traps,
      }));
      void CareerWriter.flush();
      setLastResult({ ...r, loot });
      return loot;
    },
    [update],
  );

  const recordFailure = useCallback(
    (r: HeistResult) => {
      update((prev) => ({
        ...prev,
        failures: prev.failures + 1,
        pinsCracked: prev.pinsCracked + r.pinsDone,
        trapsTriggered: prev.trapsTriggered + r.traps,
      }));
      void CareerWriter.flush();
      setLastResult(r);
    },
    [update],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) =>
      update((prev) => {
        const settings = { ...prev.settings, ...patch };
        HapticEngine.configure(settings);
        SoundEngine.configure(settings);
        return { ...prev, settings };
      }),
    [update],
  );

  const completeTutorial = useCallback(() => update((p) => (p.tutorialDone ? p : { ...p, tutorialDone: true })), [update]);

  const resetCareer = useCallback(async () => {
    await CareerWriter.wipe();
    const fresh = defaultCareer();
    if (careerRef.current) fresh.settings = { ...careerRef.current.settings };
    careerRef.current = fresh;
    setCareer(fresh);
    setHeistLevel(1);
    setLastResult(null);
    setHighlightId(null);
    CareerWriter.schedule(fresh);
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      career,
      heistLevel,
      setHeistLevel,
      lastResult,
      highlightId,
      setHighlightId,
      recordSuccess,
      recordFailure,
      updateSettings,
      completeTutorial,
      resetCareer,
    }),
    [career, heistLevel, lastResult, highlightId, recordSuccess, recordFailure, updateSettings, completeTutorial, resetCareer],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame doit être utilisé sous <GameProvider>.');
  return ctx;
}

/** Carrière chargée : les écrans ne sont montés qu'une fois le chargement terminé. */
export function useCareer(): Career {
  const { career } = useGame();
  if (!career) throw new Error('Carrière non chargée.');
  return career;
}
