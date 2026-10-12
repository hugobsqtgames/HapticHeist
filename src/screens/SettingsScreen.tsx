import React from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Segmented, Toggle } from '@/components/ui/Controls';
import { Group, Row } from '@/components/ui/List';
import { LargeTitle, Screen } from '@/components/ui/Layout';
import { SoundEngine } from '@/engine/audio/SoundEngine';
import { HapticEngine } from '@/engine/haptics';
import { useCareer, useGame } from '@/state/GameProvider';
import { C, R, T } from '@/theme';
import { formatClock, formatDate } from '@/utils/format';

type Level = 0 | 1 | 2;

const HAPTIC_TESTS: { label: string; run: () => void }[] = [
  { label: 'Tic', run: () => HapticEngine.tick() },
  { label: 'Tremblement', run: () => [0, 90, 170, 240, 300, 350, 395].forEach((ms, i) => setTimeout(() => HapticEngine.tremor(i / 6), ms)) },
  {
    label: 'Ancrage',
    run: () => {
      HapticEngine.anchor();
      SoundEngine.play('anchor');
    },
  },
  {
    label: 'Leurre',
    run: () => {
      HapticEngine.decoy();
      SoundEngine.play('decoy');
    },
  },
  {
    label: 'Déblocage',
    run: () => {
      HapticEngine.unlock();
      SoundEngine.play('unlock');
    },
  },
  {
    label: 'Alarme',
    run: () => {
      HapticEngine.alarm(6);
      SoundEngine.play('error');
    },
  },
];

export function SettingsScreen() {
  const career = useCareer();
  const { updateSettings, resetCareer } = useGame();
  const s = career.settings;

  const confirmReset = () => {
    const run = () => {
      void resetCareer();
      HapticEngine.error();
    };
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert('Effacer toutes les données ?', 'Votre carrière et tout votre butin seront définitivement supprimés de cet appareil.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen>
      <LargeTitle title="Réglages" />

      <Group title="Sensations" footer="Le retour haptique est le cœur du jeu : laissez-le activé.">
        <Row label="Retour haptique" right={<Toggle label="Retour haptique" value={s.haptics} onChange={(v) => updateSettings({ haptics: v })} />} />
        <View style={styles.block}>
          <Text style={T.body}>Puissance</Text>
          <Segmented<Level>
            options={[
              { label: 'Douce', value: 0 },
              { label: 'Normale', value: 1 },
              { label: 'Forte', value: 2 },
            ]}
            value={s.hapticPower}
            onChange={(v) => updateSettings({ hapticPower: v })}
          />
        </View>
        <View style={styles.block}>
          <Text style={T.body}>Sensibilité du cadran</Text>
          <Segmented<Level>
            options={[
              { label: 'Fine', value: 0 },
              { label: 'Normale', value: 1 },
              { label: 'Rapide', value: 2 },
            ]}
            value={s.sensitivity}
            onChange={(v) => updateSettings({ sensitivity: v })}
          />
        </View>
      </Group>

      <Group title="Essayer les vibrations">
        <View style={styles.tests}>
          {HAPTIC_TESTS.map((t) => (
            <Button key={t.label} label={t.label} size="sm" variant="secondary" onPress={t.run} />
          ))}
        </View>
      </Group>

      <Group title="Son">
        <Row label="Effets sonores" detail="Clics, pênes, sirène" right={<Toggle label="Effets sonores" value={s.sound} onChange={(v) => updateSettings({ sound: v })} />} />
        <Row label="Ambiance" detail="Ventilation de la salle des coffres" right={<Toggle label="Ambiance" value={s.ambience} onChange={(v) => updateSettings({ ambience: v })} />} />
      </Group>

      <Group title="Défi et test" footer="Le simulateur affiche un liseré à chaque vibration, utile sur émulateur ou tablette.">
        <Row label="Mode aveugle" detail="Angle et onde masqués · butin × 1,5" right={<Toggle label="Mode aveugle" value={s.blind} onChange={(v) => updateSettings({ blind: v })} />} />
        <Row label="Simulateur haptique" right={<Toggle label="Simulateur haptique" value={s.simulator} onChange={(v) => updateSettings({ simulator: v })} />} />
        <Row
          label="Mode triche"
          detail="Cibles visibles, tolérance élargie, choix du niveau"
          right={<Toggle label="Mode triche" value={s.cheat} tint={C.red} onChange={(v) => updateSettings({ cheat: v })} />}
        />
      </Group>

      <Group title="Carrière">
        <Row label="Casses réussis" value={`${career.heists}`} />
        <Row label="Arrestations" value={`${career.failures}`} />
        <Row label="Goupilles crochetées" value={`${career.pinsCracked}`} />
        <Row label="Leurres déclenchés" value={`${career.trapsTriggered}`} />
        <Row label="Meilleur temps" value={career.bestTimeMs ? formatClock(career.bestTimeMs) : '—'} />
        <Row label="Débutée le" value={formatDate(career.createdAt).slice(0, 10)} />
        <Row label="Effacer toutes les données" destructive onPress={confirmReset} />
      </Group>

      <View style={styles.about}>
        <AppIcon size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={T.headline}>Haptic Heist 1.0</Text>
          <Text style={T.footnote}>Aucune connexion, aucun compte, aucun traceur, aucune publicité. Vos données restent sur cet appareil.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  tests: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  about: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: R.lg - 4, backgroundColor: C.surface2 },
});
