import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { C, GUTTER, T } from '@/theme';

/** Filet de sécurité : une erreur de rendu affiche un écran de reprise au lieu d'un crash. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={T.title2}>Un problème est survenu</Text>
        <Text style={[T.subhead, { textAlign: 'center' }]}>{this.state.error.message}</Text>
        <Button label="Réessayer" onPress={() => this.setState({ error: null })} style={{ alignSelf: 'stretch', marginTop: 16 }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: GUTTER, gap: 8 },
});
