import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconBtn } from '@/components/IconBtn';
import { useT } from '@/i18n/helpers';
import { Sticker } from '@/components/Sticker';
import { VISION_MODEL_LABEL } from '@/data/visionModel';
import { useNav } from '@/store/useNav';
import { PB } from '@/tokens/pb';
import pkg from '../../package.json';

type Library = {
  name: string;
  version: string;
};

const GOOGLE_SEARCH_BASE = 'https://www.google.com/search?q=';

function packageSearchUrl(packageName: string): string {
  return `${GOOGLE_SEARCH_BASE}${encodeURIComponent(`${packageName} npm`)}`;
}

async function openPackageSearch(packageName: string): Promise<void> {
  await Linking.openURL(packageSearchUrl(packageName));
}

// Read from package.json at build time, so the list can't fall behind the real dependencies.
const toLibraries = (deps: Record<string, string> = {}): readonly Library[] =>
  Object.entries(deps).map(([name, version]) => ({ name, version }));
const RUNTIME_LIBRARIES = toLibraries(pkg.dependencies);
const DEV_LIBRARIES = toLibraries(pkg.devDependencies);

const REPO = 'https://github.com/krzysztofradomski/critterboard/blob/main';

/**
 * Licence notices for the on-device models: species ID (eu-1k-field-v7),
 * species icons and the chat model (Gemma 4 E2B, Apache 2.0).
 * Apache 2.0 asks for the licence + a notice with redistributed weights;
 * CC BY asks for credit to the photographers whose photos trained it
 * (species icons are drawn from CC0 photos, credited as a courtesy).
 */
const MODEL_CREDITS: readonly { name: string; detail: string; url: string }[] = [
  {
    name: `Species model: ${VISION_MODEL_LABEL}`,
    detail: 'Fine-tuned for insects by Critterboard. Model card, sources, accuracy',
    url: `${REPO}/training/vision/results/field-v7/MODEL_CARD.md`,
  },
  {
    name: 'Training photos: 7,101 iNaturalist contributors',
    detail: 'CC BY 4.0 / CC0. Photos used for training only; full credits list',
    url: `${REPO}/training/vision/results/field-v7/ATTRIBUTION.md`,
  },
  {
    name: 'Base weights: Google Vision Transformer (AugReg)',
    detail: '© Google, Apache License 2.0. Modified: fine-tuned',
    url: `${REPO}/packs/models/LICENSE-google-vit-apache-2.0.txt`,
  },
  {
    name: 'Model runtime: PyTorch ExecuTorch',
    detail: '© Meta Platforms, BSD 3-Clause. Runs the species model on your phone with the XNNPACK kernels (© Google, BSD 3-Clause), via react-native-executorch (Software Mansion, MIT)',
    url: 'https://github.com/pytorch/executorch',
  },
  {
    name: 'Chat runtime: llama.cpp',
    detail: '© the ggml authors, MIT. Runs the chat model on your phone, via llama.rn (MIT)',
    url: 'https://github.com/ggml-org/llama.cpp',
  },
  {
    name: 'Chat model: Google Gemma 4 E2B',
    detail: '© Google, Apache License 2.0. 4-bit GGUF conversion by Unsloth, downloaded when you turn on chat',
    url: 'https://huggingface.co/google/gemma-4-E2B-it',
  },
  {
    name: 'Species icons: drawn from iNaturalist photos',
    detail: 'One CC0 photo per species, cartoonised; photo and photographer per icon',
    url: `${REPO}/packs/icons/CREDITS.md`,
  },
];

function ModelCreditsSection() {
  const t = useT();
  return (
    <Sticker bg={PB.paper} style={{ padding: 0 }}>
      <View style={styles.sectionHeader}>
        <Text style={{ fontSize: 24 }}>🐞</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{t('openSource.models')}</Text>
          <Text style={styles.sectionSub}>{t('openSource.modelsSub')}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>
        {MODEL_CREDITS.map((c) => (
          <Pressable
            key={c.name}
            style={styles.row}
            onPress={() => {
              void Linking.openURL(c.url);
            }}
            accessibilityRole="link"
            accessibilityHint={`Open ${c.name}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{c.name}</Text>
              <Text style={styles.creditDetail}>{c.detail}</Text>
            </View>
            <Text style={styles.rowLink}>↗</Text>
          </Pressable>
        ))}
      </View>
    </Sticker>
  );
}

function DependencySection({
  icon,
  title,
  subtitle,
  libs,
}: {
  icon: string;
  title: string;
  subtitle: string;
  libs: readonly Library[];
}) {
  return (
    <Sticker bg={PB.paper} style={{ padding: 0 }}>
      <View style={styles.sectionHeader}>
        <Text style={{ fontSize: 24 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>
        {libs.map((lib) => (
            <Pressable
              key={lib.name}
              style={styles.row}
              onPress={() => {
                void openPackageSearch(lib.name);
              }}
              accessibilityRole="link"
              accessibilityHint={`Search Google for ${lib.name}`}
            >
              <Text style={styles.rowName}>{lib.name}</Text>
              <View style={styles.rowRight}>
                <View style={styles.versionPill}>
                  <Text style={styles.versionText}>{lib.version}</Text>
                </View>
                <Text style={styles.rowLink}>🔎</Text>
              </View>
            </Pressable>
        ))}
      </View>
    </Sticker>
  );
}

export function OpenSourceLibraries() {
  const { back } = useNav();
  const t = useT();

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('openSource.title')}</Text>
          <Text style={styles.sub}>{t('openSource.sub')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ModelCreditsSection />
        <DependencySection
          icon="📦"
          title={t('openSource.runtime')}
          subtitle={t('openSource.runtimeSub', { n: RUNTIME_LIBRARIES.length })}
          libs={RUNTIME_LIBRARIES}
        />
        <DependencySection
          icon="🛠️"
          title={t('openSource.dev')}
          subtitle={t('openSource.devSub', { n: DEV_LIBRARIES.length })}
          libs={DEV_LIBRARIES}
        />
        <Text style={styles.footer}>{t('openSource.footer')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: PB.cream, paddingTop: 50 },
  head: {
    padding: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    backgroundColor: PB.pink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: PB.cream, lineHeight: 22 },
  sub: { fontSize: 11, color: PB.cream, opacity: 0.9, marginTop: 2 },
  scroll: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30, gap: 12 },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: PB.blue,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    borderTopLeftRadius: 15.5,
    borderTopRightRadius: 15.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: PB.cream, lineHeight: 16 },
  sectionSub: { fontSize: 12, color: PB.cream, opacity: 0.92, marginTop: 3, fontWeight: '600' },
  sectionBody: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: PB.cream,
  },
  rowName: { flex: 1, fontSize: 12, fontWeight: '700', color: PB.ink },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  versionPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    backgroundColor: PB.yellow,
  },
  versionText: { fontSize: 10, fontWeight: '800', color: PB.ink },
  creditDetail: { fontSize: 11, color: PB.ink, opacity: 0.7, marginTop: 2 },
  rowLink: { fontSize: 14 },
  footer: {
    marginTop: 2,
    fontSize: 11,
    color: PB.ink,
    opacity: 0.6,
    fontWeight: '600',
    textAlign: 'center',
  },
});
