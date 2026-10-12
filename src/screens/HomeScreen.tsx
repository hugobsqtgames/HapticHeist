import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedLogo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Group, Row } from '@/components/ui/List';
import { Screen } from '@/components/ui/Layout';
import { getHeistConfig } from '@/game/content';
import { useCareer, useGame } from '@/state/GameProvider';
import { C, NUM, R, T } from '@/theme';
import { formatClock, formatMoneyShort } from '@/utils/format';

export function HomeScreen() {
  const career = useCareer();
  const { setHeistLevel } = useGame();
  const cfg = getHeistConfig(career.level);
  const attempts = career.heists + career.failures;
  const rate = attempts > 0 ? Math.round((career.heists / attempts) * 100) : 0;

  const launch = () => {
    setHeistLevel(career.level);
    router.push('/briefing');
  };

  return (
    <Screen>
      <View style={styles.logo}>
        <AnimatedLogo size={104} />
      </View>

      {/* Prochaine cible */}
      <View style={styles.hero}>
        <View style={styles.heroHead}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={T.footnote}>Prochaine cible · niveau {cfg.level}</Text>
            <Text style={T.title2} numberOfLines={1}>
              {cfg.tier.name}
            </Text>
            <Text style={T.subhead}>
              {cfg.tier.type} · {cfg.tier.city}
            </Text>
          </View>
        </View>
        <View style={styles.chips}>
          <Chip label={`${cfg.pins} goupille${cfg.pins > 1 ? 's' : ''}`} color={cfg.tier.accent} />
          <Chip label={cfg.decoys > 0 ? `${cfg.decoys} leurre${cfg.decoys > 1 ? 's' : ''}` : 'Aucun leurre'} color={cfg.decoys > 0 ? C.red : C.text2} />
          <Chip label={cfg.timeLimitMs > 0 ? formatClock(cfg.timeLimitMs).slice(0, 5) : 'Sans chrono'} color={C.text2} />
        </View>
        <Button label="Lancer le casse" icon="play" onPress={launch} />
      </View>

      {/* Carrière */}
      <View style={styles.stats}>
        <Stat label="Casses" value={`${career.heists}`} />
        <View style={styles.statSep} />
        <Stat label="Butin" value={formatMoneyShort(career.totalLoot)} accent />
        <View style={styles.statSep} />
        <Stat label="Réussite" value={`${rate} %`} />
      </View>

      <Group>
        <Row icon="vault" label="Mon butin" value={`${career.loot.length}`} chevron onPress={() => router.navigate('/vault')} />
        <Row
          icon="finger"
          iconColor={C.green}
          label="Tutoriel"
          value={career.tutorialDone ? 'Terminé' : 'Recommandé'}
          valueColor={career.tutorialDone ? C.text2 : C.gold}
          chevron
          onPress={() => router.navigate('/tutorial')}
        />
        <Row icon="settings" iconColor={C.text2} label="Réglages" chevron onPress={() => router.navigate('/settings')} />
      </Group>

      <Text style={[T.caption, { textAlign: 'center' }]}>Hors ligne · Sans compte · Sans publicité</Text>
    </Screen>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[T.title3, NUM, accent && { color: C.gold }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={T.footnote}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', paddingTop: 8 },
  hero: { backgroundColor: C.surface2, borderRadius: R.xl, padding: 20, gap: 16 },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stats: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: R.lg - 4, paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 8 },
  statSep: { width: StyleSheet.hairlineWidth, backgroundColor: C.separator },
});
