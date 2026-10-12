import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Group, Row } from '@/components/ui/List';
import { NavBar, Screen } from '@/components/ui/Layout';
import { getHeistConfig } from '@/game/content';
import { useCareer, useGame } from '@/state/GameProvider';
import { C, NUM, R, T, alpha } from '@/theme';
import { formatClock, formatMoneyShort } from '@/utils/format';

export function BriefingScreen() {
  const career = useCareer();
  const { heistLevel, setHeistLevel } = useGame();
  const cfg = getHeistConfig(heistLevel);

  return (
    <Screen
      padBottom
      footer={<Button label="Commencer" icon="play" onPress={() => router.replace('/heist')} accessibilityHint="Pose le pouce sur le cadran pour démarrer" />}
    >
      <NavBar title="Mission" onBack={() => router.back()} backIcon="close" />

      <View style={{ gap: 8 }}>
        <Chip label={`${cfg.tier.type} · niveau ${cfg.level}`} color={cfg.tier.accent} />
        <Text style={T.largeTitle}>{cfg.tier.name}</Text>
        <Text style={T.subhead}>
          {cfg.tier.city} · {cfg.tier.safe}
        </Text>
      </View>

      <Group title="Sécurité">
        <Row icon="lock" iconColor={cfg.tier.accent} label="Goupilles" value={`${cfg.pins}`} />
        <Row icon="target" iconColor={C.red} label="Leurres haptiques" value={cfg.decoys > 0 ? `${cfg.decoys}` : 'Aucun'} />
        <Row icon="clock" iconColor={C.blue} label="Temps imparti" value={cfg.timeLimitMs > 0 ? formatClock(cfg.timeLimitMs).slice(0, 5) : 'Illimité'} />
        <Row icon="shield" iconColor={C.green} label="Essais" value={`${cfg.lives}`} />
        <Row icon="wave" iconColor={C.purple} label="Tolérance" value={`±${cfg.lockWindow.toFixed(1)}°`} />
      </Group>

      <View style={styles.loot}>
        <Text style={T.footnote}>Butin estimé</Text>
        <Text style={[T.title2, NUM, { color: C.gold }]}>
          {formatMoneyShort(cfg.lootMin)} – {formatMoneyShort(cfg.lootMax)}
        </Text>
        {career.settings.blind ? <Text style={[T.footnote, { color: C.gold }]}>Mode aveugle : butin × 1,5</Text> : null}
      </View>

      <View style={styles.tip}>
        <Icon name="finger" size={22} color={C.gold} />
        <Text style={[T.subhead, { flex: 1, color: C.text }]}>
          {cfg.decoys > 0
            ? 'Le vrai point d’ancrage donne une double impulsion feutrée. Un leurre ne donne qu’un choc sec : quittez-le avant 0,7 s.'
            : 'Tournez lentement. Le tremblement s’intensifie à l’approche ; sur la double impulsion, restez immobile une seconde.'}
        </Text>
      </View>

      {career.settings.cheat ? (
        <Group title="Mode triche" footer="Choisissez librement le niveau à tester.">
          <Row
            label="Niveau"
            right={
              <View style={styles.stepper}>
                <IconButton icon="chevron-left" label="Niveau précédent" onPress={() => setHeistLevel(Math.max(1, heistLevel - 1))} />
                <Text style={[T.headline, NUM, { minWidth: 28, textAlign: 'center' }]}>{heistLevel}</Text>
                <IconButton icon="chevron-right" label="Niveau suivant" onPress={() => setHeistLevel(Math.min(30, heistLevel + 1))} />
              </View>
            }
          />
        </Group>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loot: { backgroundColor: C.surface2, borderRadius: R.lg - 4, padding: 16, gap: 4 },
  tip: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: R.lg - 4, backgroundColor: alpha(C.gold, 0.1), alignItems: 'flex-start' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
