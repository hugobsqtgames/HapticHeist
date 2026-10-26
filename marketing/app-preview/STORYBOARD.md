# Haptic Heist — App Store Preview

**Format :** 886 × 1920 (iPhone 6,9" / 6,5"), 30 i/s, H.264 + AAC stéréo, 29,6 s.

## 1. Analyse du projet

### Ce qui rend l'app unique (à montrer en priorité)

1. **Le cadran qu'on crochète au toucher** (`src/components/heist/LockDial.tsx` + `src/engine/lock/`). C'est le cœur du produit. Il est très visuel : graduations qui tournent, jauge de maintien circulaire, contour qui s'allume à l'ancrage, onde haptique en bas d'écran.
2. **Le vocabulaire haptique** (`src/engine/haptics.ts`) : micro-tic à chaque cran, tremblement qui s'accélère, double impulsion sur le vrai point, choc sec unique sur un leurre. Les vibrations sont invisibles. La vidéo les rend perceptibles avec les vrais sons de l'app et des ondes concentriques calées sur les événements réels.
3. **L'ouverture du coffre** (`src/screens/SuccessScreen.tsx`) : pênes qui se rétractent, volant qui tourne, porte qui pivote, halo de rareté, valeur qui défile. C'est le moment le plus spectaculaire.
4. **Les leurres et l'alarme** (`HeistScreen` + `BustedScreen`) : flash rouge, goupilles qui tremblent, essais qui chutent, puis l'écran « Arrêté » avec ses gyrophares rouge et bleu.
5. **La progression** : briefing de mission, salle au trésor (butin procédural, raretés), tutoriel en 5 étapes, réglages haptiques.
6. **La promesse** : 100 % hors ligne, sans compte, sans publicité (écran Réglages, pied de l'accueil).

### Écrans les plus visuels

Accueil (logo animé) · Mission · Casse (cadran) · Révélation (porte de coffre) · Arrêté (gyrophares) · Butin (liste colorée).

### Parcours utilisateur retenu

Accueil → Lancer le casse → Mission → Commencer → compte à rebours → rotation du cadran → ancrage → maintien → ouverture → butin. Puis, plus loin dans la carrière : un leurre, l'alarme, l'arrestation, et la salle au trésor bien remplie.

### Ce qui ne doit pas être modifié

- **Les écrans eux-mêmes.** Chaque image d'écran vient de l'app réelle, rendue par son propre code : rien n'est redessiné ni retouché.
- **L'identité visuelle** : noir OLED, surfaces grises, accent or `#F5B942`, couleurs système iOS, typographie système.
- **Les comportements.** Aucune fonctionnalité inventée : chaque texte à l'écran décrit quelque chose que l'app fait vraiment.

## 2. Méthode : la vraie app, filmée image par image

`scripts/capture.cjs` lance l'export web de l'app dans Chromium, au format exact d'un iPhone 15 Pro : 393 × 852 pt, ×3, marges de Dynamic Island et de barre d'accueil imposées. L'horloge du navigateur est figée et avance de 1/30 s par image, puis le script prend une capture. Les animations, minuteries et le moteur de crochetage tournent sans modification. Le résultat est parfaitement fluide, quelle que soit la vitesse de la machine.

- **Le hasard est rejoué de façon déterministe.** Une première partie de repérage trouve où se cache le point d'ancrage. La prise filmée tourne ensuite le cadran pile dessus, comme un joueur : un balayage franc, puis une approche lente quand le tremblement grandit.
- **Les carrières sont produites par le vrai générateur de butin** (`scripts/careers.cjs` → `src/game/content.ts`).
- **Les sons de la bande-son sont ceux de l'app**, synthétisés par `src/engine/audio/synth.ts`.

## 3. Storyboard

| Temps | Plan | Image (vraie app) | Texte | Son |
|---|---|---|---|---|
| 0,0–3,2 | **Accroche.** Macro sur le logo animé, le cadran qui « cherche ». Lent travelling arrière. | Accueil, logo en 8× | « Un coffre-fort. » / « Aucun indice à l'écran. » → « Juste une *vibration*. » | Tics de cadran, puis double impulsion + ondes |
| 3,2–5,8 | **Découverte.** La caméra recule et révèle l'iPhone, qui pivote doucement. | Accueil | « Le casse se joue *au toucher*. » | Nappe grave qui s'installe |
| 5,8–8,6 | **Mission.** Appui sur « Lancer le casse », la fiche monte. Zoom sur le bloc Sécurité. | Mission | « Choisissez votre *cible*. » | Clic d'interface |
| 8,6–9,7 | Appui sur « Commencer », compte à rebours accéléré. | Casse : 3, 2, 1 | — | Clics du compte à rebours |
| 9,7–13,9 | **Le cadran.** Le doigt trace un cercle. Poussée de caméra sur le cadran. Ancrage, maintien, la jauge se remplit. | Casse | « Tracez un cercle. » → « Sentez le *tremblement*. » → « Double impulsion. *Ne bougez plus.* » | Tics réels à chaque cran, ancrage, déverrouillage |
| 13,9–19,3 | **Révélation.** Pênes, volant, porte, halo. Zoom sur le butin qui défile. | Révélation | « Chaque coffre cache *un trésor*. » | Pênes, alarme désactivée, souffle, carillon, pièces |
| 19,3–22,6 | **Les leurres.** Bascule de l'iPhone (plan de coupe), banque, accent bleu. Le cadran tombe sur un leurre : flash rouge. | Casse niv. 3 | « Méfiez-vous des *leurres*. » | Choc sec, buzzer |
| 22,6–24,1 | **L'arrestation.** | Arrêté | « Trois erreurs. *Arrêté.* » | Sirène |
| 24,1–26,6 | **La carrière.** Triptyque : Tutoriel, Butin (51,9 M$), Réglages. | Butin, Tutoriel, Réglages | « Une collection qui *grandit*. » · « Tutoriel guidé · Réglages haptiques · Mode aveugle » | Carillon |
| 26,6–27,8 | **La promesse.** | — | « 100 % hors ligne. » « Sans compte. » « Sans pub. » | — |
| 27,8–29,6 | **Signature.** Icône réelle, ondes, nom, appel à l'action. | Icône de l'app | « Haptic Heist » · « Ouvrez votre premier coffre. » | Double impulsion finale |

## 4. Direction artistique de la vidéo

- **Couleurs et lumière.** Le fond est noir, comme l'app. Seul l'accent change selon la scène : or pour la marque, bleu pour la banque, rouge pour l'alarme. C'est un halo diffus derrière l'iPhone, jamais un reflet.
- **Typographie.** Inter Display, gras, interlettrage serré, en casse normale. Un seul mot en or par phrase, au maximum.
- **L'iPhone.** Un appareil plat et sobre : bord fin, Dynamic Island, barre d'état 9:41, barre d'accueil. Pas de reflets, pas de dégradés métalliques.
- **Mouvements.** Caméra lente, sur des courbes de type « expo » et « cubic ». Les zooms visent des points précis de l'écran, sans secousses ni rebonds gratuits.
- **Transitions.** On s'appuie d'abord sur les vraies transitions de l'app : la fiche qui monte, le fondu de l'écran de révélation. Le seul plan de coupe ajouté est une bascule de l'iPhone, qui cache le changement de scène.
- **Visualiser le toucher.** Un point de contact discret montre le doigt. Des ondes concentriques rendent visibles les vibrations : deux pour une double impulsion, une seule pour un choc de leurre.
