import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/brand/Logo';
import { AngleReadout, SimulatorFlash, Waveform } from '@/components/heist/Hud';
import { LockDial } from '@/components/heist/LockDial';
import { Button } from '@/components/ui/Button';
import { SoundEngine } from '@/engine/audio/SoundEngine';
import { HapticEngine } from '@/engine/haptics';
import { EngineConfig, SENSITIVITY_VALUES } from '@/engine/lock/LockEngine';
import { useLockEngine } from '@/engine/lock/useLockEngine';
import { useCareer, useGame } from '@/state/GameProvider';
import { C, GUTTER, R, T } from '@/theme';
import type { Zone } from '@/types/game';
import { clamp, mod, rand } from '@/utils/math';

const STEPS = [
  {
    key: 'rotate',
    title: 'Le grain du cadran',
    text: 'Posez le pouce sur le cadran et tracez un cercle. Chaque cran de 2° produit un micro-tic. Faites un demi-tour.',
  },
  {
    key: 'find',
    title: 'Le tremblement',
    text: 'Un point d’ancrage est caché. À l’approche, le téléphone tremble de plus en plus vite. Pile dessus : une double impulsion feutrée.',
  },
  {
    key: 'hold',
    title: 'L’immobilité',
    text: 'Revenez sur le point et ne bougez plus pendant une seconde, doigt posé. Si vous tremblez ou levez le doigt, la goupille retombe.',
  },
  {
    key: 'decoy',
    title: 'Les leurres',
    text: 'Deux points sont cachés. Le leurre ne donne qu’un seul choc sec. Touchez-le, quittez-le vite, puis débloquez le vrai point.',
  },
  {
    key: 'done',
    title: 'Diplômé',
    text: 'Vous savez lire une serrure au toucher. En vrai casse : chrono, essais limités, jusqu’à cinq goupilles et plusieurs leurres.',
  },
] as const;

export function TutorialScreen() {
  const career = useCareer();
  const settings = career.settings;
  const { completeTutorial, setHeistLevel } = useGame();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [decoyFelt, setDecoyFelt] = useState(false);
  const stepRef = useRef(step);
  stepRef.current = step;
  const decoyFeltRef = useRef(false);
  const dialSize = Math.min(width - GUTTER * 2 - 24, height * 0.36, 320);
  const cur = STEPS[step];

  const advance = useCallback(() => {
    HapticEngine.notify(Haptics.NotificationFeedbackType.Success);
    SoundEngine.play('reveal', 0.6);
    setFeedback('');
    setHint(false);
    setProgress(0);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, []);

  const engineCfg = useMemo<EngineConfig>(
    () => ({
      pins: 99,
      decoys: 0,
      nearWindow: 4.5,
      lockWindow: 2.4,
      holdMs: cur.key === 'find' ? 9e9 : 1000,
      decoyTrapRatio: 0.7,
      sensitivity: SENSITIVITY_VALUES[settings.sensitivity],
      autoRegenerate: false,
    }),
    [cur.key, settings.sensitivity],
  );

  const engine = useLockEngine(
    engineCfg,
    {
      onAnchor: (decoy) => {
        const k = STEPS[stepRef.current].key;
        if (decoy) {
          decoyFeltRef.current = true;
          setDecoyFelt(true);
          setFeedback('Un seul choc sec : c’est un leurre. Partez vite.');
        } else if (k === 'find') {
          setFeedback('Double impulsion ressentie : point trouvé.');
          setTimeout(advance, 900);
        } else {
          setFeedback('Ancrage. Restez immobile…');
        }
      },
      onHoldBroken: (reason) => setFeedback(reason === 'released' ? 'Doigt levé : la goupille retombe.' : 'Vous avez bougé : la goupille retombe.'),
      onPinUnlocked: () => {
        const k = STEPS[stepRef.current].key;
        if (k === 'hold') {
          setFeedback('Goupille débloquée.');
          setTimeout(advance, 900);
        } else if (k === 'decoy') {
          if (decoyFeltRef.current) {
            setFeedback('Parfait : leurre repéré et vraie goupille débloquée.');
            setTimeout(advance, 1000);
          } else {
            setFeedback('Débloquée, mais trouvez aussi le leurre (un seul choc sec).');
            engine.setZones([
              { angle: engine.freeAngle([]), kind: 'target' },
              { angle: mod(engine.reading + 120, 360), kind: 'decoy' },
            ]);
          }
        }
      },
      onTrap: () => setFeedback('Alarme : vous êtes resté sur un leurre. Ici, c’est sans conséquence.'),
      onZonesChanged: (z) => setZones([...z]),
    },
    cur.key !== 'done',
    dialSize,
  );

  // Mise en place de chaque étape
  useEffect(() => {
    engine.reset();
    if (cur.key === 'rotate') engine.setZones([]);
    if (cur.key === 'find') engine.setZones([{ angle: mod(engine.reading + rand(70, 290), 360), kind: 'target' }]);
    if (cur.key === 'hold' && engine.zones.length === 0) engine.setZones([{ angle: mod(engine.reading + 90, 360), kind: 'target' }]);
    if (cur.key === 'decoy') {
      decoyFeltRef.current = false;
      setDecoyFelt(false);
      const a = mod(engine.reading + rand(60, 120), 360);
      engine.setZones([
        { angle: a, kind: 'decoy' },
        { angle: mod(a + rand(110, 170), 360), kind: 'target' },
      ]);
    }
    if (cur.key === 'done') {
      engine.setZones([]);
      HapticEngine.unlock();
      SoundEngine.play('coins', 0.8);
      completeTutorial();
    }
  }, [cur.key, engine, completeTutorial]);

  // Étape 1 : rotation cumulée
  useEffect(() => {
    if (cur.key !== 'rotate') return;
    const t = setInterval(() => {
      const p = clamp(engine.cumulative / 180, 0, 1);
      setProgress(p);
      if (p >= 1) {
        clearInterval(t);
        advance();
      }
    }, 100);
    return () => clearInterval(t);
  }, [cur.key, engine, advance]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={T.largeTitle}>Tutoriel</Text>
        <Text style={T.subhead}>Étape {step + 1} sur {STEPS.length}</Text>
      </View>
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={s.key} style={[styles.progressSeg, { backgroundColor: i < step ? C.gold : i === step ? C.text : C.surface3 }]} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={T.title3}>{cur.title}</Text>
        <Text style={[T.subhead, { color: C.text }]}>{cur.text}</Text>
        {cur.key === 'rotate' ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        ) : null}
        {cur.key === 'decoy' ? <Text style={[T.footnote, { color: decoyFelt ? C.green : C.text3 }]}>{decoyFelt ? 'Leurre ressenti' : 'Leurre pas encore ressenti'}</Text> : null}
        {feedback ? <Text style={[T.footnote, { color: C.gold }]}>{feedback}</Text> : null}
      </View>

      {cur.key !== 'done' ? (
        <>
          <View style={styles.dial}>
            <LockDial size={dialSize} engine={engine} accent={C.gold} markers={hint || settings.cheat ? zones : null} />
          </View>
          <View style={styles.bottom}>
            <View style={{ flex: 1 }}>
              <Waveform width={width - GUTTER * 2 - 32 - 92} blind={false} height={34} />
            </View>
            <AngleReadout engine={engine} blind={false} cheat={hint || settings.cheat} />
          </View>
          <View style={styles.actions}>
            <Button style={{ flex: 1 }} size="md" variant="secondary" icon={hint ? 'eye-off' : 'eye'} label={hint ? 'Masquer' : 'Indice'} onPress={() => setHint((h) => !h)} />
            <Button style={{ flex: 1 }} size="md" variant="ghost" icon="skip" label="Passer" onPress={advance} />
          </View>
        </>
      ) : (
        <View style={styles.done}>
          <AppIcon size={96} />
          <Text style={T.title2}>Crocheteur certifié</Text>
          <Text style={T.subhead}>Délivré par la Guilde des Doigts de Velours</Text>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 16 }}>
            <Button
              label="Lancer mon premier casse"
              icon="play"
              onPress={() => {
                setHeistLevel(career.level);
                router.push('/briefing');
              }}
            />
            <Button label="Recommencer le tutoriel" variant="secondary" onPress={() => setStep(0)} />
          </View>
        </View>
      )}
      <SimulatorFlash enabled={settings.simulator} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: GUTTER },
  header: { gap: 2 },
  progress: { flexDirection: 'row', gap: 4, marginTop: 16 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  card: { marginTop: 16, padding: 16, gap: 8, borderRadius: R.lg - 4, backgroundColor: C.surface2 },
  track: { height: 4, borderRadius: 2, backgroundColor: C.surface3, overflow: 'hidden', marginTop: 4 },
  fill: { height: 4, borderRadius: 2, backgroundColor: C.gold },
  dial: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 16, borderRadius: R.lg - 4, backgroundColor: C.surface2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 12 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
