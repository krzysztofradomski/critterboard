"""Generate the localized support, privacy and terms pages: website/public/{support,privacy,terms}/{,pl/,de/,es/}index.html.

Photo tips, FAQ and contact text are read from assets/i18n so the site and the app never disagree;
support copy lives in CONTENT below, legal copy in legal_content.py. Run: python3 tools/website/gen_site.py
"""
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUB = ROOT / "website/public"
import sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from legal_content import PRIVACY, TERMS
LANGS = {"en": "English", "pl": "Polski", "de": "Deutsch", "es": "Español"}
path = lambda page, l: f"/{page}/" if l == "en" else f"/{page}/{l}/"

UI = {
    "en": dict(title="Help & About", sub="Everything about finding, scanning and collecting bugs.", home="← Back to critterboard.app", toc="On this page", faq="FAQ", photo="Taking a good photo", contact="Contact", contactText="A real human reads every message. Reply usually within 48 hours.", footer="All processing happens on your device. © 2026 Critterboard · open source"),
    "pl": dict(title="Pomoc i informacje", sub="Wszystko o szukaniu, skanowaniu i kolekcjonowaniu owadów.", home="← Wróć do critterboard.app", toc="Na tej stronie", faq="FAQ", photo="Jak zrobić dobre zdjęcie", contact="Kontakt", contactText="Każdą wiadomość czyta prawdziwy człowiek. Odpowiedź zwykle w 48 godzin.", footer="Całe przetwarzanie odbywa się na twoim urządzeniu. © 2026 Critterboard · otwarte oprogramowanie"),
    "de": dict(title="Hilfe & Info", sub="Alles übers Finden, Scannen und Sammeln von Insekten.", home="← Zurück zu critterboard.app", toc="Auf dieser Seite", faq="FAQ", photo="Ein gutes Foto machen", contact="Kontakt", contactText="Ein echter Mensch liest jede Nachricht. Antwort meist innerhalb von 48 Stunden.", footer="Die gesamte Verarbeitung passiert auf deinem Gerät. © 2026 Critterboard · Open Source"),
    "es": dict(title="Ayuda e información", sub="Todo sobre buscar, escanear y coleccionar bichos.", home="← Volver a critterboard.app", toc="En esta página", faq="Preguntas frecuentes", photo="Cómo hacer una buena foto", contact="Contacto", contactText="Una persona real lee cada mensaje. Responde normalmente en 48 horas.", footer="Todo el procesamiento ocurre en tu dispositivo. © 2026 Critterboard · código abierto"),
}

# (id, title, [paragraph | ("ul", [items])])
CONTENT = {
"en": [
 ("start", "Getting started", [
   "Open the <b>Scan</b> tab, point the camera at an insect and take the photo. Critterboard identifies it on your phone, adds it to your <b>Dex</b> and gives you XP.",
   "Identification needs a regional pack. Go to <b>Me → Brains</b>, pick your region and tap <b>Get</b>. The pack holds the species list and the BugNet vision model (about 88 MB) and is downloaded once.",
 ]),
 ("regions", "Regional packs and the offline map", [
   "Only one regional pack is active at a time. It decides which species Critterboard can recognise and which map you see. Right now Central Europe is available; other regions are marked <i>soon</i>.",
   "The offline map comes with the pack (about 56 MB, all of Europe at low detail). The <b>Map</b> tab stays locked until it is downloaded. After that it works without any connection and shows pins where you caught things.",
   ("ul", ["Download packs on Wi-Fi: the model and the map are tens of megabytes.", "Your location is used only to centre the map and place pins. It is never sent anywhere unless you turn on location sharing."]),
 ]),
 ("progress", "XP, rarity, quests, badges and streaks", [
   ("ul", [
     "<b>XP and levels:</b> every new species earns XP. Rarer species (common → uncommon → rare → epic → legendary) earn more.",
     "<b>Quests:</b> weekly goals such as “Find a Legendary”. Open <b>Me → Quests</b>.",
     "<b>Badges:</b> start at zero and unlock as you play. Tap one to see how to earn it.",
     "<b>Streaks:</b> catch something every day. You earn a freeze every 7 days of activity (up to three) and it is spent automatically if you miss a day.",
   ]),
 ]),
 ("network", "Network, leaderboard and friends", [
   "Critterboard works fully offline and the network switch is <b>off by default</b>. Turn it on in <b>Me → Brains</b> only if you want the online features.",
   ("ul", [
     "<b>Leaderboard:</b> opt-in. Your name and XP appear only if you switch it on.",
     "<b>Friends:</b> follow other trainers from the Ranks tab. Friends see your public profile only.",
     "<b>Share spotting locations:</b> optional. Public pins are blurred by about 500 m.",
     "<b>Crash reports:</b> optional and anonymous.",
   ]),
   "There are no accounts. Your phone creates a random private key on first use; it is how the server recognises your device. If you reinstall the app or wipe your data you start over as a new trainer.",
 ]),
 ("chat", "Chat and the guides", [
   "The chat guides (Prof. Larva, Dr. Snail and R.A. Maywind) run on your phone with the Gemma 4 E2B model. It is an optional download (about 3.1 GB, Wi-Fi recommended) in <b>Me → Brains</b>. Without it, chat is off and everything else still works.",
 ]),
 ("trouble", "Troubleshooting", [
   ("ul", [
     "<b>No match or low confidence:</b> see the photo tips below, and check that you installed the pack for your region.",
     "<b>The Map tab is locked:</b> download the active region in <b>Me → Brains</b>. You need a connection once.",
     "<b>The map or a download fails:</b> check your connection and try again; interrupted downloads are discarded, never half-installed.",
     "<b>Location not detected:</b> allow location for Critterboard in iOS or Android Settings, then reopen the Map tab.",
     "<b>Change the language:</b> <b>Me → Brains → Language</b>. It changes the app, species names and the guides.",
   ]),
 ]),
 ("data", "Your data", [
   "Everything lives on your phone: your Dex, sightings, photos and settings. There is no account, no ad tracking and no analytics unless you opt into crash reports.",
   ("ul", [
     "<b>Export:</b> <b>Me → Help</b> lets you export your Dex (JSON), sightings (CSV), a GBIF-ready occurrence file (Darwin Core) or everything at once.",
     "<b>Wipe:</b> “Wipe everything” in the same screen removes your Dex, sightings, settings and downloaded models. Followers and leaderboard entries go too. There is no undo.",
     "<b>Photos and models:</b> reference photos come from iNaturalist and GBIF ranges. We never train on your photos.",
   ]),
 ]),
],
"pl": [
 ("start", "Pierwsze kroki", [
   "Otwórz zakładkę <b>Skan</b>, skieruj aparat na owada i zrób zdjęcie. Critterboard rozpoznaje go na telefonie, dodaje do twojego <b>Dexa</b> i przyznaje XP.",
   "Rozpoznawanie wymaga pakietu regionalnego. Wejdź w <b>Ja → Mózg</b>, wybierz swój region i dotknij <b>Pobierz</b>. Pakiet zawiera listę gatunków i model wizji BugNet (ok. 88 MB) i pobiera się tylko raz.",
 ]),
 ("regions", "Pakiety regionalne i mapa offline", [
   "Naraz aktywny jest tylko jeden pakiet regionalny. Decyduje, które gatunki Critterboard rozpozna i jaką mapę zobaczysz. Na razie dostępna jest Europa Środkowa; pozostałe regiony oznaczono jako <i>wkrótce</i>.",
   "Mapa offline jest częścią pakietu (ok. 56 MB, cała Europa w niewielkim stopniu szczegółowości). Zakładka <b>Mapa</b> jest zablokowana, dopóki jej nie pobierzesz. Potem działa bez internetu i pokazuje pinezki tam, gdzie coś złapałeś.",
   ("ul", ["Pakiety pobieraj przez Wi-Fi: model i mapa mają dziesiątki megabajtów.", "Lokalizacja służy tylko do wyśrodkowania mapy i stawiania pinezek. Nigdzie nie jest wysyłana, chyba że włączysz udostępnianie lokalizacji."]),
 ]),
 ("progress", "XP, rzadkość, zadania, odznaki i passy", [
   ("ul", [
     "<b>XP i poziomy:</b> każdy nowy gatunek daje XP. Rzadsze gatunki (pospolity → niepospolity → rzadki → epicki → legendarny) dają więcej.",
     "<b>Zadania:</b> cele tygodniowe, np. „Znajdź legendarnego”. Otwórz <b>Ja → Zadania</b>.",
     "<b>Odznaki:</b> zaczynasz od zera i odblokowujesz je w trakcie gry. Dotknij odznaki, by zobaczyć, jak ją zdobyć.",
     "<b>Passy:</b> łap coś codziennie. Co 7 dni aktywności zdobywasz zamrożenie (maks. trzy), które zużywa się automatycznie, gdy pominiesz dzień.",
   ]),
 ]),
 ("network", "Sieć, ranking i znajomi", [
   "Critterboard działa w pełni offline, a przełącznik sieci jest <b>domyślnie wyłączony</b>. Włącz go w <b>Ja → Mózg</b> tylko wtedy, gdy chcesz korzystać z funkcji online.",
   ("ul", [
     "<b>Ranking:</b> dobrowolny. Twoja nazwa i XP pojawią się tylko po włączeniu.",
     "<b>Znajomi:</b> obserwuj innych trenerów w zakładce Rankingi. Znajomi widzą tylko twój profil publiczny.",
     "<b>Udostępnianie lokalizacji:</b> opcjonalne. Publiczne pinezki są rozmyte o ok. 500 m.",
     "<b>Raporty o awariach:</b> opcjonalne i anonimowe.",
   ]),
   "Nie ma kont. Telefon tworzy przy pierwszym użyciu losowy prywatny klucz, po którym serwer rozpoznaje urządzenie. Po ponownej instalacji lub wymazaniu danych zaczynasz jako nowy trener.",
 ]),
 ("chat", "Czat i przewodnicy", [
   "Przewodnicy czatu (Prof. Larwa, Dr Ślimak i Asystent Maj) działają na twoim telefonie z modelem Gemma 4 E2B. To opcjonalne pobranie (ok. 3,1 GB, zalecane Wi-Fi) w <b>Ja → Mózg</b>. Bez niego czat jest wyłączony, a reszta aplikacji działa normalnie.",
 ]),
 ("trouble", "Rozwiązywanie problemów", [
   ("ul", [
     "<b>Brak dopasowania lub niska pewność:</b> zobacz wskazówki o zdjęciach poniżej i sprawdź, czy masz pakiet swojego regionu.",
     "<b>Zakładka Mapa jest zablokowana:</b> pobierz aktywny region w <b>Ja → Mózg</b>. Wymaga to połączenia z internetem jeden raz.",
     "<b>Mapa lub pobieranie się nie udaje:</b> sprawdź połączenie i spróbuj ponownie; przerwane pobrania są odrzucane, nigdy nie zostają w połowie zainstalowane.",
     "<b>Lokalizacja nie jest wykrywana:</b> zezwól Critterboard na lokalizację w Ustawieniach iOS lub Androida, potem otwórz ponownie zakładkę Mapa.",
     "<b>Zmiana języka:</b> <b>Ja → Mózg → Język</b>. Zmienia aplikację, nazwy gatunków i przewodników.",
   ]),
 ]),
 ("data", "Twoje dane", [
   "Wszystko mieszka na twoim telefonie: dex, obserwacje, zdjęcia i ustawienia. Nie ma konta, śledzenia reklamowego ani analityki, chyba że włączysz raporty o awariach.",
   ("ul", [
     "<b>Eksport:</b> w <b>Ja → Pomoc</b> wyeksportujesz dex (JSON), obserwacje (CSV), plik wystąpień gotowy dla GBIF (Darwin Core) albo wszystko naraz.",
     "<b>Wymazanie:</b> „Wymaż wszystko” na tym samym ekranie usuwa dex, obserwacje, ustawienia i pobrane modele. Obserwujący i wpisy rankingu też znikają. Nie ma cofnięcia.",
     "<b>Zdjęcia i modele:</b> zdjęcia referencyjne pochodzą z iNaturalist, a zasięgi z GBIF. Nigdy nie trenujemy na twoich zdjęciach.",
   ]),
 ]),
],
"de": [
 ("start", "Erste Schritte", [
   "Öffne den Tab <b>Scan</b>, richte die Kamera auf ein Insekt und mach das Foto. Critterboard erkennt es auf deinem Telefon, legt es in deinem <b>Dex</b> ab und gibt dir XP.",
   "Für die Erkennung brauchst du ein Regionalpaket. Gehe zu <b>Ich → Hirn</b>, wähle deine Region und tippe auf <b>Laden</b>. Das Paket enthält die Artenliste und das Vision-Modell BugNet (etwa 88 MB) und wird nur einmal geladen.",
 ]),
 ("regions", "Regionalpakete und Offline-Karte", [
   "Es ist immer nur ein Regionalpaket aktiv. Es bestimmt, welche Arten Critterboard erkennt und welche Karte du siehst. Derzeit gibt es Mitteleuropa; andere Regionen sind als <i>bald</i> markiert.",
   "Die Offline-Karte gehört zum Paket (etwa 56 MB, ganz Europa in geringer Detailstufe). Der Tab <b>Karte</b> bleibt gesperrt, bis sie geladen ist. Danach funktioniert sie ohne Verbindung und zeigt Pins dort, wo du etwas gefangen hast.",
   ("ul", ["Lade Pakete im WLAN: Modell und Karte sind jeweils einige Dutzend Megabyte groß.", "Dein Standort dient nur dazu, die Karte zu zentrieren und Pins zu setzen. Er wird nirgendwohin gesendet, außer du aktivierst das Teilen von Standorten."]),
 ]),
 ("progress", "XP, Seltenheit, Quests, Abzeichen und Serien", [
   ("ul", [
     "<b>XP und Level:</b> jede neue Art bringt XP. Seltenere Arten (häufig → gelegentlich → selten → episch → legendär) bringen mehr.",
     "<b>Quests:</b> Wochenziele wie „Finde einen Legendären“. Öffne <b>Ich → Quests</b>.",
     "<b>Abzeichen:</b> du startest bei null und schaltest sie beim Spielen frei. Tippe auf eins, um zu sehen, wie du es bekommst.",
     "<b>Serien:</b> fang jeden Tag etwas. Alle 7 Aktivitätstage verdienst du einen Frost (maximal drei), der automatisch verbraucht wird, wenn du einen Tag verpasst.",
   ]),
 ]),
 ("network", "Netzwerk, Rangliste und Freunde", [
   "Critterboard funktioniert komplett offline, und der Netzwerkschalter ist <b>standardmäßig aus</b>. Schalte ihn in <b>Ich → Hirn</b> nur ein, wenn du die Online-Funktionen willst.",
   ("ul", [
     "<b>Rangliste:</b> freiwillig. Dein Name und deine XP erscheinen nur, wenn du sie einschaltest.",
     "<b>Freunde:</b> folge anderen Trainern im Tab Ränge. Freunde sehen nur dein öffentliches Profil.",
     "<b>Sichtungsorte teilen:</b> optional. Öffentliche Pins werden um etwa 500 m verwischt.",
     "<b>Absturzberichte:</b> optional und anonym.",
   ]),
   "Es gibt keine Konten. Dein Telefon erzeugt bei der ersten Nutzung einen zufälligen privaten Schlüssel, an dem der Server dein Gerät erkennt. Nach Neuinstallation oder Löschen deiner Daten startest du als neuer Trainer.",
 ]),
 ("chat", "Chat und die Guides", [
   "Die Chat-Guides (Prof. Larva, Dr. Schnecke und Assistent Mai) laufen mit dem Modell Gemma 4 E2B auf deinem Telefon. Es ist ein optionaler Download (etwa 3,1 GB, WLAN empfohlen) in <b>Ich → Hirn</b>. Ohne ihn ist der Chat aus und alles andere funktioniert weiter.",
 ]),
 ("trouble", "Fehlerbehebung", [
   ("ul", [
     "<b>Kein Treffer oder geringe Sicherheit:</b> lies die Fototipps unten und prüfe, ob du das Paket deiner Region installiert hast.",
     "<b>Der Tab Karte ist gesperrt:</b> lade die aktive Region in <b>Ich → Hirn</b>. Dafür brauchst du einmal eine Verbindung.",
     "<b>Karte oder Download schlägt fehl:</b> prüfe die Verbindung und versuche es erneut; unterbrochene Downloads werden verworfen und nie halb installiert.",
     "<b>Standort wird nicht erkannt:</b> erlaube Critterboard den Standort in den iOS- oder Android-Einstellungen und öffne dann den Tab Karte erneut.",
     "<b>Sprache ändern:</b> <b>Ich → Hirn → Sprache</b>. Das ändert App, Artennamen und Guides.",
   ]),
 ]),
 ("data", "Deine Daten", [
   "Alles bleibt auf deinem Telefon: Dex, Sichtungen, Fotos und Einstellungen. Es gibt kein Konto, kein Werbe-Tracking und keine Analyse, außer du aktivierst Absturzberichte.",
   ("ul", [
     "<b>Export:</b> unter <b>Ich → Hilfe</b> exportierst du deinen Dex (JSON), Sichtungen (CSV), eine GBIF-taugliche Fundmeldedatei (Darwin Core) oder alles auf einmal.",
     "<b>Löschen:</b> „Alles löschen“ im selben Bildschirm entfernt Dex, Sichtungen, Einstellungen und geladene Modelle. Follower und Ranglisteneinträge verschwinden ebenfalls. Es gibt kein Zurück.",
     "<b>Fotos und Modelle:</b> Referenzfotos stammen von iNaturalist, Verbreitungsgebiete von GBIF. Wir trainieren nie mit deinen Fotos.",
   ]),
 ]),
],
"es": [
 ("start", "Primeros pasos", [
   "Abre la pestaña <b>Escanear</b>, apunta la cámara a un insecto y haz la foto. Critterboard lo identifica en tu teléfono, lo añade a tu <b>Dex</b> y te da XP.",
   "La identificación necesita un pack regional. Ve a <b>Yo → Cerebro</b>, elige tu región y toca <b>Descargar</b>. El pack incluye la lista de especies y el modelo de visión BugNet (unos 88 MB) y se descarga una sola vez.",
 ]),
 ("regions", "Packs regionales y mapa sin conexión", [
   "Solo hay un pack regional activo a la vez. Decide qué especies reconoce Critterboard y qué mapa ves. Ahora mismo está disponible Europa Central; las demás regiones aparecen como <i>próximamente</i>.",
   "El mapa sin conexión viene con el pack (unos 56 MB, toda Europa con poco detalle). La pestaña <b>Mapa</b> permanece bloqueada hasta que lo descargues. Después funciona sin conexión y muestra chinchetas donde capturaste algo.",
   ("ul", ["Descarga los packs con Wi-Fi: el modelo y el mapa pesan decenas de megabytes.", "Tu ubicación solo sirve para centrar el mapa y colocar chinchetas. No se envía a ningún sitio salvo que actives compartir ubicaciones."]),
 ]),
 ("progress", "XP, rareza, misiones, insignias y rachas", [
   ("ul", [
     "<b>XP y niveles:</b> cada especie nueva da XP. Las más raras (común → poco común → rara → épica → legendaria) dan más.",
     "<b>Misiones:</b> objetivos semanales como «Encuentra una legendaria». Abre <b>Yo → Misiones</b>.",
     "<b>Insignias:</b> empiezas con cero y las desbloqueas jugando. Toca una para ver cómo conseguirla.",
     "<b>Rachas:</b> captura algo cada día. Ganas un congelador cada 7 días de actividad (hasta tres) y se gasta solo si pierdes un día.",
   ]),
 ]),
 ("network", "Red, ranking y amigos", [
   "Critterboard funciona totalmente sin conexión y el interruptor de red está <b>apagado por defecto</b>. Actívalo en <b>Yo → Cerebro</b> solo si quieres las funciones en línea.",
   ("ul", [
     "<b>Ranking:</b> opcional. Tu nombre y XP aparecen solo si lo activas.",
     "<b>Amigos:</b> sigue a otros entrenadores desde la pestaña Rangos. Los amigos solo ven tu perfil público.",
     "<b>Compartir ubicaciones:</b> opcional. Las chinchetas públicas se difuminan unos 500 m.",
     "<b>Informes de fallos:</b> opcionales y anónimos.",
   ]),
   "No hay cuentas. Tu teléfono crea una clave privada aleatoria la primera vez que se usa y con ella el servidor reconoce tu dispositivo. Si reinstalas la app o borras tus datos, empiezas como un entrenador nuevo.",
 ]),
 ("chat", "Chat y guías", [
   "Las guías del chat (Prof. Larva, Dr. Caracol y Asistente Mayo) funcionan en tu teléfono con el modelo Gemma 4 E2B. Es una descarga opcional (unos 3,1 GB, mejor con Wi-Fi) en <b>Yo → Cerebro</b>. Sin él, el chat está desactivado y todo lo demás sigue funcionando.",
 ]),
 ("trouble", "Solución de problemas", [
   ("ul", [
     "<b>Sin coincidencia o baja confianza:</b> mira los consejos de fotos de abajo y comprueba que tienes instalado el pack de tu región.",
     "<b>La pestaña Mapa está bloqueada:</b> descarga la región activa en <b>Yo → Cerebro</b>. Necesitas conexión una vez.",
     "<b>El mapa o una descarga falla:</b> revisa tu conexión e inténtalo de nuevo; las descargas interrumpidas se descartan y nunca quedan a medias.",
     "<b>No se detecta la ubicación:</b> permite la ubicación a Critterboard en los Ajustes de iOS o Android y vuelve a abrir la pestaña Mapa.",
     "<b>Cambiar el idioma:</b> <b>Yo → Cerebro → Idioma</b>. Cambia la app, los nombres de especies y las guías.",
   ]),
 ]),
 ("data", "Tus datos", [
   "Todo vive en tu teléfono: tu Dex, avistamientos, fotos y ajustes. No hay cuenta, ni seguimiento publicitario, ni analítica salvo que actives los informes de fallos.",
   ("ul", [
     "<b>Exportar:</b> en <b>Yo → Ayuda</b> puedes exportar tu Dex (JSON), avistamientos (CSV), un archivo de registros listo para GBIF (Darwin Core) o todo a la vez.",
     "<b>Borrar:</b> «Borrar todo» en la misma pantalla elimina tu Dex, avistamientos, ajustes y modelos descargados. También seguidores y entradas de ranking. No hay deshacer.",
     "<b>Fotos y modelos:</b> las fotos de referencia vienen de iNaturalist y las distribuciones de GBIF. Nunca entrenamos con tus fotos.",
   ]),
 ]),
],
}


NAV = {  # footer links + page labels
    "en": dict(support="Support", privacy="Privacy", terms="Terms", more="Still need a hand?", moreText="Tell us your device, operating system and app version, and what happened. Screenshots help. Never send passwords or personal files.", seo="Critterboard"),
    "pl": dict(support="Pomoc", privacy="Prywatność", terms="Warunki", more="Potrzebujesz pomocy?", moreText="Napisz, jakiego urządzenia, systemu i wersji aplikacji używasz oraz co się stało. Zrzuty ekranu pomagają. Nigdy nie wysyłaj haseł ani osobistych plików.", seo="Critterboard"),
    "de": dict(support="Support", privacy="Datenschutz", terms="Bedingungen", more="Noch Hilfe nötig?", moreText="Nenne uns dein Gerät, dein Betriebssystem, die App-Version und was passiert ist. Screenshots helfen. Sende nie Passwörter oder persönliche Dateien.", seo="Critterboard"),
    "es": dict(support="Soporte", privacy="Privacidad", terms="Términos", more="¿Necesitas ayuda?", moreText="Cuéntanos tu dispositivo, sistema operativo, versión de la app y qué pasó. Las capturas ayudan. Nunca envíes contraseñas ni archivos personales.", seo="Critterboard"),
}
EYEBROW = {"en": "A LITTLE HELP TO HUNT", "pl": "TROCHĘ POMOCY NA ŁOWACH", "de": "EIN BISSCHEN HILFE BEIM JAGEN", "es": "UN POCO DE AYUDA PARA CAZAR"}
HEADLINE = {"en": "Happy hunting.", "pl": "Udanych łowów.", "de": "Viel Spaß bei der Jagd.", "es": "Feliz caza."}

# Page-specific styles. The base, header (nav + language menu) and footer styles are lifted
# from the landing page itself (website/public/index.html), so every page stays in sync with it.
PAGE_CSS = """
.eyebrow{font-weight:700;letter-spacing:.14em;font-size:.78rem;margin-top:34px}
h1{font-family:Fredoka,sans-serif;font-size:clamp(2.2rem,7vw,3.2rem);line-height:1.1;margin:6px 0 10px}
.lead{font-size:1.1rem;max-width:560px}.upd{font-size:.9rem;opacity:.75;margin-top:6px}
.card{background:var(--cr);border:var(--bd);border-radius:18px;box-shadow:var(--sh);padding:26px 30px 8px;margin:26px 0;column-width:380px;column-gap:56px}
/* two columns on desktop keep the lines readable at the landing page's width */
.card section{break-inside:avoid;margin-bottom:24px}
h2{font-family:Fredoka,sans-serif;font-size:1.3rem;margin-bottom:8px}
main p{line-height:1.65;margin-bottom:10px}main ul{padding-left:20px;margin-bottom:10px}main li{margin-bottom:6px;line-height:1.6}
main a{color:var(--bl)}
details{border-top:1.5px solid #ecdcae;padding:8px 0}details:first-of-type{border-top:0}
summary{cursor:pointer;font-weight:700}details p{margin:8px 0 2px}
.tip{display:flex;gap:12px;margin-bottom:10px}.tip i{font-style:normal;font-size:1.4rem}
.help{background:var(--gn);color:#fff;border:var(--bd);border-radius:18px;box-shadow:var(--sh);padding:22px 24px;margin:26px 0 40px}
.help a{color:#fff;font-weight:700}.help h2{color:#fff}
.lang-menu a{display:block;width:100%;text-align:left;border-radius:8px;padding:8px 12px;font-family:"DM Sans",sans-serif;font-size:.9rem;color:var(--bk);text-decoration:none}
.lang-menu a:hover,.lang-menu a[aria-current="true"]{background:var(--y)}
.ft-links{flex-wrap:wrap}
@media (max-width:768px){nav .container{max-width:none}.card{padding:22px 20px 4px}.mit{display:none}footer .container{flex-direction:column;align-items:flex-start;gap:10px}}
"""

INDEX = (ROOT / "website/public/index.html").read_text()


def _between(text, start, end):
    a = text.index(start)
    return text[a:text.index(end, a)]


def shared_css():
    base = _between(INDEX, ":root {", "/* ── HERO ── */")                      # vars, reset, body, nav, language switch
    foot = _between(INDEX, "      footer {\n        background", "      footer p {")  # footer rules
    foot_p = foot + _between(INDEX, "      footer p {", "}") + "}"
    return base + foot_p


def landing_strings(lang):
    """The landing page's own header/footer strings for `lang`, read from its I18N table."""
    block = _between(INDEX, f"\n        {lang}: {{\n          _label", "\n        }")
    import re
    return {k: v.replace('\\"', '"') for k, v in re.findall(r'(\w+):\s*"((?:[^"\\]|\\.)*)"', block)}


def shared_nav(page, lang):
    st = landing_strings(lang)
    items = "".join(
        f'<li><a href="{path(page, l)}" hreflang="{l}" data-lang="{l}"{" aria-current=true" if l == lang else ""}>{flag} {nm}</a></li>'
        for l, flag, nm in (("en", "🇬🇧", "English"), ("pl", "🇵🇱", "Polski"), ("es", "🇪🇸", "Español"), ("de", "🇩🇪", "Deutsch")))
    return f"""<nav><div class="container">
<a href="/" class="logo"><div class="logo-icon">🪲</div>Critterboard</a>
<div class="nav-r"><div class="lang-switch">
<button class="lang-btn" id="lang-btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="{html.escape(st.get('lang_label', 'Language'))}"><span>{lang.upper()}</span><span class="lang-caret" aria-hidden="true">▾</span></button>
<ul class="lang-menu" id="lang-menu" role="listbox" hidden>{items}</ul></div>
<a href="https://github.com/krzysztofradomski/critterboard" target="_blank" rel="noopener" class="mit">{html.escape(st['nav_mit'])}</a></div>
</div></nav>"""


def shared_footer(lang):
    st = landing_strings(lang)
    links = "".join(f'<a href="{path(pg, lang)}">{html.escape(st["ft_" + pg])}</a>' for pg in ("support", "privacy", "terms"))
    return f"""<footer><div class="container">
<div class="ft-logo">🪲 Critterboard</div>
<p>{html.escape(st['ft_tag'])}</p>
<div class="ft-links"><a href="https://github.com/krzysztofradomski/critterboard" target="_blank" rel="noopener" class="gh-star">{html.escape(st['gh_star'])}</a><a href="mailto:hello@critterboard.app">{html.escape(st['ft_contact'])}</a>{links}</div>
</div></footer>"""


MENU_JS = """<script>
(function(){var b=document.getElementById('lang-btn'),m=document.getElementById('lang-menu');
function c(){m.hidden=true;b.setAttribute('aria-expanded','false')}
b.addEventListener('click',function(e){e.stopPropagation();var o=m.hidden;m.hidden=!o;b.setAttribute('aria-expanded',String(o))});
document.addEventListener('click',function(e){if(!m.hidden&&!e.target.closest('.lang-switch'))c()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')c()});
m.addEventListener('click',function(e){var a=e.target.closest('[data-lang]');if(a)try{localStorage.setItem('cb-lang',a.dataset.lang)}catch(_){}});
try{localStorage.setItem('cb-lang',document.documentElement.lang)}catch(_){}})();
</script>"""


def block(x):
    return f"<ul>{''.join(f'<li>{i}</li>' for i in x[1])}</ul>" if isinstance(x, tuple) else f"<p>{x}</p>"


def support_sections(lang):
    e = html.escape
    app = json.load(open(ROOT / f"assets/i18n/{lang}.json"))["strings"]
    tips = app["noMatch"]["tip"]
    secs = [(sid, t, "".join(block(b) for b in body)) for sid, t, body in CONTENT[lang]]
    tip_html = "".join(f'<div class="tip"><i>{em}</i><div><b>{e(tips[k + "Title"])}</b><br>{e(tips[k + "Desc"])}</div></div>'
                       for em, k in [("🔆", "light"), ("🔍", "frame"), ("🌿", "backdrop"), ("📐", "profile")])
    faq_html = "".join(f"<details><summary>{e(f['q'])}</summary><p>{e(f['a'])}</p></details>" for f in app["help"]["faq"].values())
    secs.insert(len(secs) - 1, ("photo", UI[lang]["photo"], tip_html))
    secs.insert(len(secs) - 1, ("faq", UI[lang]["faq"], faq_html))
    return secs


def render(page, lang):
    e, n = html.escape, NAV[lang]
    if page == "support":
        eyebrow, headline, lead, upd = EYEBROW[lang], HEADLINE[lang], UI[lang]["sub"], ""
        secs = support_sections(lang)
    else:
        eyebrow, headline, upd, lead, body = (PRIVACY if page == "privacy" else TERMS)[lang]
        secs = [(None, t, "".join(block(b) for b in bs)) for t, bs in body]
    cards = "".join(f'<section{f" id=" + chr(34) + s + chr(34) if s else ""}><h2>{e(t)}</h2>{b}</section>' for s, t, b in secs)
    alts = "".join(f'<link rel="alternate" hreflang="{l}" href="https://critterboard.app{path(page, l)}">' for l in LANGS)
    helpbox = f'<div class="help"><h2>{e(n["more"])}</h2><p>{e(n["moreText"])}</p><p><a href="mailto:hello@critterboard.app">hello@critterboard.app</a></p></div>'
    title = {"support": n["support"], "privacy": n["privacy"], "terms": n["terms"]}[page]
    return f"""<!doctype html>
<html lang="{lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{e(title)} — Critterboard</title><meta name="description" content="{e(lead)}">
<link rel="canonical" href="https://critterboard.app{path(page, lang)}">{alts}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>{SHARED_CSS}{PAGE_CSS}</style></head><body>
{shared_nav(page, lang)}
<main class="container"><p class="eyebrow">{e(eyebrow)}</p><h1>{e(headline)}</h1><p class="lead">{e(lead)}</p>{f'<p class="upd">{e(upd)}</p>' if upd else ''}
<div class="card">{cards}</div>{helpbox if page == "support" else ""}</main>
{shared_footer(lang)}
{MENU_JS}</body></html>"""


import shutil
SHARED_CSS = shared_css()
shutil.rmtree(PUB / "help", ignore_errors=True)  # superseded by /support/ (see _redirects)
for page in ("support", "privacy", "terms"):
    for lang in LANGS:
        d = PUB / page / ("" if lang == "en" else lang)
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(render(page, lang), encoding="utf-8")
(PUB / "_redirects").write_text("/help /support 301\n/help/* /support/:splat 301\n")
print("wrote support, privacy, terms x", list(LANGS))
