"""Privacy and Terms copy for gen_site.py, per language.

Each page is (eyebrow, headline, updated-label, intro, [(title, [paragraph | ("ul", [items])])]).
Facts here must match the code: see docs/modules/backend-adapter.md and the worker schema.
"""
UPDATED = "2 October 2026"

PRIVACY = {
"en": ("YOUR BUGS, YOURS TO KEEP", "Privacy, simply.", f"Last updated: {UPDATED}",
 "Critterboard is a free bug-identification game. It has no accounts, advertising, purchases or analytics. It works fully offline, and your collection is stored on your phone.",
 [
 ("On your phone", ["Your Dex, sightings, photos, settings and chat history are stored on your device. Identifying a bug and chatting with the guides both run on your phone. Photos you take or pick are never uploaded. They stay on your device until you delete them or wipe the app's data. Your phone's own backup settings may also apply."]),
 ("Camera, photos and location", [
   "Critterboard asks for the camera and, if you choose, your photo library to identify a bug. This happens on your phone.",
   "Location is optional. It centres your map and helps prefer nearby species. To show a place name, your phone's system location service may be asked to look up the address of your coordinates; that is handled by Apple under Apple's privacy policy. Your location is not sent to us unless you turn on “Share spotting locations”.",
 ]),
 ("Online features (off by default)", [
   "The network switch is off when you first open the app. Only if you turn it on does Critterboard talk to our server, which runs on Cloudflare. It then handles:",
   ("ul", [
     "A random anonymous ID created on your phone, plus a hash of a private device key (the key itself never leaves your phone).",
     "Your display name, your XP total, whether you appear on the leaderboard, and who you follow.",
     "Your caught species and when you caught them, so friends can see your activity.",
     "A country or region label and an approximate catch location, only if you turn on “Share spotting locations”. Catch locations are blurred by up to about 500 m on your phone before they are sent.",
   ]),
   "Your display name and XP are visible to other players only if you choose to appear on the leaderboard or if they follow you. Names are checked against a basic filter.",
   "For security, we briefly count login attempts by IP address (for about a minute) to limit abuse. Cloudflare, our hosting provider, also processes connection data such as your IP address to deliver the service; see Cloudflare's privacy policy.",
 ]),
 ("Downloads", ["Regional packs, the offline map and the optional chat model are downloaded from hosts such as GitHub and Hugging Face. Like any download, those hosts can see your IP address and the file you request. We do not add any identifier to these requests."]),
 ("Crash reports (off by default)", ["If you turn on crash reports, anonymous diagnostic information about a crash may be sent to our error-reporting provider, Sentry. It does not include your photos. You can turn this off at any time in the app."]),
 ("Deleting your data", [
   "Local data: “Wipe everything” (Me → Help) removes your Dex, sightings, photos, settings and downloaded models from the phone, and gives the app a fresh anonymous ID. Removing the app removes the rest.",
   "Server data: if you used the online features, we also keep the data listed above under your old anonymous ID. To have it deleted, email us from the Help screen's contact address and include your anonymous ID (it is in “Download all my data”). We will delete it and confirm. You do not need an account to ask.",
 ]),
 ("Your rights and contact", ["Depending on where you live, you may have the right to access, correct or delete the data we hold about you, or to object to its use. Email hello@critterboard.app and we will help. Support correspondence is kept while we resolve your request. Please send only what is needed."]),
 ("Changes", ["If this policy changes in a meaningful way, we will update the date above and, where it matters, tell you in the app."]),
 ]),
"pl": ("TWOJE OWADY, TWOJE", "Prywatność, po prostu.", f"Ostatnia aktualizacja: 2 października 2026",
 "Critterboard to darmowa gra do rozpoznawania owadów. Nie ma kont, reklam, zakupów ani analityki. Działa w pełni offline, a twoja kolekcja jest przechowywana na telefonie.",
 [
 ("Na twoim telefonie", ["Twój Dex, obserwacje, zdjęcia, ustawienia i historia czatu są przechowywane na urządzeniu. Rozpoznawanie owadów i rozmowy z przewodnikami odbywają się na telefonie. Zdjęcia, które robisz lub wybierasz, nigdy nie są wysyłane. Pozostają na urządzeniu, dopóki ich nie usuniesz lub nie wymażesz danych aplikacji. Mogą mieć zastosowanie także ustawienia kopii zapasowej twojego telefonu."]),
 ("Aparat, zdjęcia i lokalizacja", [
   "Critterboard prosi o dostęp do aparatu i, jeśli zechcesz, do biblioteki zdjęć, aby rozpoznać owada. Dzieje się to na telefonie.",
   "Lokalizacja jest opcjonalna. Wyśrodkowuje mapę i pomaga wskazać gatunki z okolicy. Aby pokazać nazwę miejsca, system telefonu może zostać poproszony o ustalenie adresu dla twoich współrzędnych; obsługuje to Apple zgodnie z własną polityką prywatności. Lokalizacja nie jest wysyłana do nas, chyba że włączysz „Udostępniaj miejsca obserwacji”.",
 ]),
 ("Funkcje online (domyślnie wyłączone)", [
   "Przełącznik sieci jest wyłączony przy pierwszym uruchomieniu. Dopiero po jego włączeniu Critterboard łączy się z naszym serwerem działającym na Cloudflare. Przetwarza on wtedy:",
   ("ul", [
     "Losowy anonimowy identyfikator utworzony na telefonie oraz skrót prywatnego klucza urządzenia (sam klucz nigdy nie opuszcza telefonu).",
     "Twoją wyświetlaną nazwę, sumę XP, informację, czy pojawiasz się w rankingu, oraz kogo obserwujesz.",
     "Złapane gatunki i czas złapania, aby znajomi mogli widzieć twoją aktywność.",
     "Etykietę kraju lub regionu i przybliżoną lokalizację złapania, wyłącznie jeśli włączysz „Udostępniaj miejsca obserwacji”. Lokalizacje są rozmywane nawet o ok. 500 m na telefonie, zanim zostaną wysłane.",
   ]),
   "Twoja nazwa i XP są widoczne dla innych graczy tylko wtedy, gdy zdecydujesz się pojawiać w rankingu lub gdy cię obserwują. Nazwy przechodzą podstawowy filtr.",
   "Dla bezpieczeństwa na krótko (ok. minuty) liczymy próby logowania według adresu IP, aby ograniczać nadużycia. Cloudflare, nasz dostawca hostingu, przetwarza też dane połączenia, takie jak adres IP, aby dostarczać usługę; zobacz politykę prywatności Cloudflare.",
 ]),
 ("Pobieranie plików", ["Pakiety regionalne, mapa offline i opcjonalny model czatu są pobierane z serwisów takich jak GitHub i Hugging Face. Jak przy każdym pobieraniu, te serwisy widzą twój adres IP i żądany plik. Do tych żądań nie dodajemy żadnego identyfikatora."]),
 ("Raporty o awariach (domyślnie wyłączone)", ["Jeśli włączysz raporty o awariach, anonimowe dane diagnostyczne o awarii mogą zostać wysłane do naszego dostawcy raportów błędów, Sentry. Nie zawierają twoich zdjęć. Możesz je wyłączyć w aplikacji w dowolnej chwili."]),
 ("Usuwanie danych", [
   "Dane lokalne: „Wymaż wszystko” (Ja → Pomoc) usuwa z telefonu dex, obserwacje, zdjęcia, ustawienia i pobrane modele oraz nadaje aplikacji nowy anonimowy identyfikator. Usunięcie aplikacji usuwa resztę.",
   "Dane na serwerze: jeśli korzystałeś z funkcji online, przechowujemy też wymienione wyżej dane pod twoim dawnym anonimowym identyfikatorem. Aby je usunąć, napisz na adres kontaktowy z ekranu Pomoc i podaj swój anonimowy identyfikator (znajdziesz go w „Pobierz wszystkie moje dane”). Usuniemy dane i potwierdzimy to. Nie potrzebujesz konta, by o to poprosić.",
 ]),
 ("Twoje prawa i kontakt", ["W zależności od miejsca zamieszkania możesz mieć prawo dostępu do danych, które o tobie przechowujemy, ich poprawiania, usunięcia lub sprzeciwu wobec ich wykorzystania. Napisz na hello@critterboard.app, a pomożemy. Korespondencję przechowujemy do czasu załatwienia sprawy. Prosimy o przesyłanie tylko tego, co potrzebne."]),
 ("Zmiany", ["Jeśli polityka istotnie się zmieni, zaktualizujemy datę powyżej i, gdy to ważne, poinformujemy cię w aplikacji."]),
 ]),
"de": ("DEINE INSEKTEN, DEINE DATEN", "Datenschutz, einfach erklärt.", "Zuletzt aktualisiert: 2. Oktober 2026",
 "Critterboard ist ein kostenloses Spiel zum Bestimmen von Insekten. Es gibt keine Konten, Werbung, Käufe oder Analysen. Es funktioniert komplett offline, und deine Sammlung liegt auf deinem Telefon.",
 [
 ("Auf deinem Telefon", ["Dein Dex, Sichtungen, Fotos, Einstellungen und Chatverlauf werden auf deinem Gerät gespeichert. Die Bestimmung eines Insekts und der Chat mit den Guides laufen auf deinem Telefon. Fotos, die du aufnimmst oder auswählst, werden nie hochgeladen. Sie bleiben auf deinem Gerät, bis du sie löschst oder die App-Daten löschst. Auch die Backup-Einstellungen deines Telefons können gelten."]),
 ("Kamera, Fotos und Standort", [
   "Critterboard fragt nach der Kamera und, wenn du willst, nach deiner Fotomediathek, um ein Insekt zu bestimmen. Das passiert auf deinem Telefon.",
   "Der Standort ist optional. Er zentriert deine Karte und hilft, Arten in der Nähe zu bevorzugen. Um einen Ortsnamen anzuzeigen, kann der Standortdienst deines Telefons die Adresse zu deinen Koordinaten nachschlagen; das übernimmt Apple nach der eigenen Datenschutzerklärung. Dein Standort wird nicht an uns gesendet, es sei denn, du aktivierst „Sichtungsorte teilen“.",
 ]),
 ("Online-Funktionen (standardmäßig aus)", [
   "Der Netzwerkschalter ist beim ersten Start aus. Erst wenn du ihn einschaltest, verbindet sich Critterboard mit unserem Server, der bei Cloudflare läuft. Er verarbeitet dann:",
   ("ul", [
     "Eine zufällige anonyme ID, die auf deinem Telefon erzeugt wird, sowie einen Hash eines privaten Geräteschlüssels (der Schlüssel selbst verlässt dein Telefon nie).",
     "Deinen Anzeigenamen, deine XP-Summe, ob du in der Rangliste erscheinst, und wem du folgst.",
     "Deine gefangenen Arten und wann du sie gefangen hast, damit Freunde deine Aktivität sehen können.",
     "Ein Länder- oder Regionskennzeichen und einen ungefähren Fangort, nur wenn du „Sichtungsorte teilen“ einschaltest. Fangorte werden auf deinem Telefon um bis zu etwa 500 m verwischt, bevor sie gesendet werden.",
   ]),
   "Dein Anzeigename und deine XP sind für andere Spieler nur sichtbar, wenn du in der Rangliste erscheinen willst oder sie dir folgen. Namen werden mit einem einfachen Filter geprüft.",
   "Zur Sicherheit zählen wir Anmeldeversuche kurz (etwa eine Minute) nach IP-Adresse, um Missbrauch zu begrenzen. Cloudflare, unser Hosting-Anbieter, verarbeitet außerdem Verbindungsdaten wie deine IP-Adresse, um den Dienst auszuliefern; siehe die Datenschutzerklärung von Cloudflare.",
 ]),
 ("Downloads", ["Regionalpakete, die Offline-Karte und das optionale Chat-Modell werden von Hosts wie GitHub und Hugging Face geladen. Wie bei jedem Download sehen diese Hosts deine IP-Adresse und die angeforderte Datei. Wir fügen diesen Anfragen keine Kennung hinzu."]),
 ("Absturzberichte (standardmäßig aus)", ["Wenn du Absturzberichte einschaltest, können anonyme Diagnosedaten zu einem Absturz an unseren Anbieter für Fehlerberichte, Sentry, gesendet werden. Sie enthalten keine Fotos. Du kannst das in der App jederzeit ausschalten."]),
 ("Deine Daten löschen", [
   "Lokale Daten: „Alles löschen“ (Ich → Hilfe) entfernt Dex, Sichtungen, Fotos, Einstellungen und geladene Modelle vom Telefon und gibt der App eine neue anonyme ID. Wenn du die App löschst, verschwindet der Rest.",
   "Serverdaten: Wenn du die Online-Funktionen genutzt hast, speichern wir die oben genannten Daten auch unter deiner alten anonymen ID. Um sie löschen zu lassen, schreibe an die Kontaktadresse im Hilfe-Bildschirm und nenne deine anonyme ID (sie steht in „Alle meine Daten laden“). Wir löschen sie und bestätigen es. Du brauchst dafür kein Konto.",
 ]),
 ("Deine Rechte und Kontakt", ["Je nachdem, wo du lebst, hast du möglicherweise das Recht auf Auskunft, Berichtigung oder Löschung der über dich gespeicherten Daten oder auf Widerspruch gegen ihre Nutzung. Schreibe an hello@critterboard.app, wir helfen dir. Korrespondenz bewahren wir auf, bis dein Anliegen geklärt ist. Bitte sende nur, was nötig ist."]),
 ("Änderungen", ["Wenn sich diese Erklärung wesentlich ändert, aktualisieren wir das Datum oben und informieren dich, wo es wichtig ist, in der App."]),
 ]),
"es": ("TUS BICHOS, TUYOS", "Privacidad, sin rodeos.", "Última actualización: 2 de octubre de 2026",
 "Critterboard es un juego gratuito para identificar bichos. No tiene cuentas, publicidad, compras ni analítica. Funciona totalmente sin conexión y tu colección se guarda en tu teléfono.",
 [
 ("En tu teléfono", ["Tu Dex, avistamientos, fotos, ajustes e historial de chat se guardan en tu dispositivo. Identificar un bicho y charlar con las guías ocurre en tu teléfono. Las fotos que haces o eliges nunca se suben. Permanecen en tu dispositivo hasta que las borres o borres los datos de la app. También pueden aplicarse los ajustes de copia de seguridad de tu teléfono."]),
 ("Cámara, fotos y ubicación", [
   "Critterboard pide acceso a la cámara y, si quieres, a tu fototeca para identificar un bicho. Esto ocurre en tu teléfono.",
   "La ubicación es opcional. Centra tu mapa y ayuda a priorizar especies cercanas. Para mostrar el nombre de un lugar, se puede pedir al servicio de ubicación del sistema que busque la dirección de tus coordenadas; lo gestiona Apple según su política de privacidad. Tu ubicación no se nos envía salvo que actives «Compartir ubicaciones de avistamientos».",
 ]),
 ("Funciones en línea (desactivadas por defecto)", [
   "El interruptor de red está apagado cuando abres la app por primera vez. Solo si lo activas Critterboard se comunica con nuestro servidor, que funciona en Cloudflare. Entonces trata:",
   ("ul", [
     "Un ID anónimo aleatorio creado en tu teléfono y un hash de una clave privada del dispositivo (la clave en sí nunca sale de tu teléfono).",
     "Tu nombre visible, tu total de XP, si apareces en el ranking y a quién sigues.",
     "Las especies que capturas y cuándo, para que tus amigos vean tu actividad.",
     "Una etiqueta de país o región y una ubicación aproximada de la captura, solo si activas «Compartir ubicaciones de avistamientos». Las ubicaciones se difuminan hasta unos 500 m en tu teléfono antes de enviarse.",
   ]),
   "Tu nombre y tu XP solo son visibles para otros jugadores si decides aparecer en el ranking o si te siguen. Los nombres pasan por un filtro básico.",
   "Por seguridad, contamos brevemente (alrededor de un minuto) los intentos de inicio de sesión por dirección IP para limitar abusos. Cloudflare, nuestro proveedor de alojamiento, también procesa datos de conexión como tu dirección IP para prestar el servicio; consulta su política de privacidad.",
 ]),
 ("Descargas", ["Los packs regionales, el mapa sin conexión y el modelo de chat opcional se descargan desde servidores como GitHub y Hugging Face. Como en cualquier descarga, esos servidores ven tu dirección IP y el archivo que pides. No añadimos ningún identificador a esas peticiones."]),
 ("Informes de fallos (desactivados por defecto)", ["Si activas los informes de fallos, se puede enviar información de diagnóstico anónima sobre un fallo a nuestro proveedor de informes de errores, Sentry. No incluye tus fotos. Puedes desactivarlo en la app cuando quieras."]),
 ("Borrar tus datos", [
   "Datos locales: «Borrar todo» (Yo → Ayuda) elimina de tu teléfono el Dex, avistamientos, fotos, ajustes y modelos descargados, y da a la app un ID anónimo nuevo. Al desinstalar la app desaparece el resto.",
   "Datos en el servidor: si usaste las funciones en línea, también guardamos los datos indicados arriba bajo tu antiguo ID anónimo. Para que los borremos, escribe a la dirección de contacto de la pantalla de Ayuda e incluye tu ID anónimo (aparece en «Descargar todos mis datos»). Los eliminaremos y te lo confirmaremos. No necesitas una cuenta para pedirlo.",
 ]),
 ("Tus derechos y contacto", ["Según dónde vivas, puedes tener derecho a acceder a los datos que guardamos sobre ti, corregirlos, borrarlos u oponerte a su uso. Escribe a hello@critterboard.app y te ayudaremos. Conservamos la correspondencia mientras resolvemos tu solicitud. Envía solo lo necesario."]),
 ("Cambios", ["Si esta política cambia de forma importante, actualizaremos la fecha de arriba y, cuando importe, te lo diremos en la app."]),
 ]),
}

TERMS = {
"en": ("A LITTLE ROOM TO HUNT", "Terms of use.", f"Last updated: {UPDATED}",
 "These terms apply to the Critterboard app and its website. By using them you agree to use them responsibly and in line with the law.",
 [
 ("Using Critterboard", ["Critterboard is free for personal, non-commercial use. Do not try to disrupt the app, its servers or its hosting, cheat the leaderboard, or use it to harm or harass others."]),
 ("Identifications are a best guess", ["The app identifies insects with a model on your phone. Results can be wrong. Do not rely on them for anything that matters, such as deciding whether an insect is safe to touch, eat near or handle, or whether a plant or home is affected by a pest. Keep a safe distance from stinging or biting insects, and respect private property and protected areas when you go looking."]),
 ("Your content and name", ["The display name you choose and the catches you publish are shown to other players when you use the online features. Pick a name that is not offensive or misleading. We may remove names or restrict online access for abuse. You are responsible for any file you export or share."]),
 ("Your data", ["Your collection is stored on your phone. Back up what matters to you; local data can be lost if you wipe or remove the app. See the Privacy page for details."]),
 ("Open source and data sources", ["The app's code is open source under the MIT licence. On-device models, species data and photos come from third parties under their own licences, listed in the app under Me → Brains (credits and open-source libraries)."]),
 ("The App Store version", ["Unless the App Store listing provides a custom agreement, the iOS app is licensed to you under Apple's standard end-user licence agreement."]),
 ("Availability and changes", ["We may update, pause or retire features, packs, the online service or these terms as the project develops. Continuing to use the app after an update means you accept the updated terms."]),
 ("No warranty", ["The app is provided as available. To the fullest extent permitted by law, we give no guarantee that it will always be available, error-free or suitable for a particular purpose, and we are not liable for losses arising from its use, including from an incorrect identification."]),
 ("Questions", ["Email hello@critterboard.app with questions about these terms or the app."]),
 ]),
"pl": ("TROCHĘ MIEJSCA NA ŁOWY", "Warunki korzystania.", "Ostatnia aktualizacja: 2 października 2026",
 "Te warunki dotyczą aplikacji Critterboard i jej strony internetowej. Korzystając z nich, zgadzasz się używać ich odpowiedzialnie i zgodnie z prawem.",
 [
 ("Korzystanie z Critterboard", ["Critterboard jest darmowy do użytku osobistego i niekomercyjnego. Nie próbuj zakłócać działania aplikacji, jej serwerów ani hostingu, oszukiwać w rankingu ani używać jej do krzywdzenia lub nękania innych."]),
 ("Rozpoznanie to najlepsze przypuszczenie", ["Aplikacja rozpoznaje owady modelem działającym na telefonie. Wyniki mogą być błędne. Nie polegaj na nich w sprawach, które mają znaczenie, np. przy ocenie, czy owada można bezpiecznie dotykać, czy zagraża roślinom lub domowi. Zachowuj bezpieczną odległość od owadów żądlących lub gryzących oraz szanuj teren prywatny i obszary chronione podczas poszukiwań."]),
 ("Twoje treści i nazwa", ["Wybrana przez ciebie nazwa i publikowane złapania są widoczne dla innych graczy, gdy korzystasz z funkcji online. Wybierz nazwę, która nie jest obraźliwa ani wprowadzająca w błąd. Możemy usuwać nazwy lub ograniczać dostęp online w razie nadużyć. Odpowiadasz za każdy plik, który eksportujesz lub udostępniasz."]),
 ("Twoje dane", ["Twoja kolekcja jest przechowywana na telefonie. Rób kopie tego, co ważne; dane lokalne mogą zniknąć po wymazaniu lub usunięciu aplikacji. Szczegóły na stronie Prywatność."]),
 ("Otwarte oprogramowanie i źródła danych", ["Kod aplikacji jest otwarty na licencji MIT. Modele na urządzeniu, dane o gatunkach i zdjęcia pochodzą od podmiotów trzecich na ich licencjach, wymienionych w aplikacji w Ja → Mózg (twórcy i biblioteki open source)."]),
 ("Wersja z App Store", ["O ile oferta w App Store nie przewiduje odrębnej umowy, aplikacja na iOS jest licencjonowana na standardowej umowie licencyjnej użytkownika końcowego Apple."]),
 ("Dostępność i zmiany", ["Możemy aktualizować, wstrzymywać lub wycofywać funkcje, pakiety, usługę online albo te warunki wraz z rozwojem projektu. Dalsze korzystanie z aplikacji po aktualizacji oznacza akceptację zmienionych warunków."]),
 ("Brak gwarancji", ["Aplikacja jest udostępniana w stanie, w jakim jest. W najszerszym zakresie dozwolonym przez prawo nie gwarantujemy, że będzie zawsze dostępna, wolna od błędów ani odpowiednia do konkretnego celu, i nie odpowiadamy za straty wynikające z jej używania, w tym z błędnego rozpoznania."]),
 ("Pytania", ["Pytania o te warunki lub aplikację wysyłaj na hello@critterboard.app."]),
 ]),
"de": ("PLATZ ZUM ENTDECKEN", "Nutzungsbedingungen.", "Zuletzt aktualisiert: 2. Oktober 2026",
 "Diese Bedingungen gelten für die App Critterboard und ihre Website. Mit der Nutzung erklärst du dich einverstanden, sie verantwortungsvoll und im Einklang mit dem Gesetz zu nutzen.",
 [
 ("Critterboard nutzen", ["Critterboard ist kostenlos für den persönlichen, nichtkommerziellen Gebrauch. Versuche nicht, die App, ihre Server oder ihr Hosting zu stören, die Rangliste zu manipulieren oder die App zu nutzen, um andere zu schädigen oder zu belästigen."]),
 ("Bestimmungen sind Schätzungen", ["Die App bestimmt Insekten mit einem Modell auf deinem Telefon. Ergebnisse können falsch sein. Verlasse dich nicht darauf, wenn es darauf ankommt, etwa bei der Frage, ob ein Insekt gefahrlos berührt werden kann oder ob eine Pflanze oder ein Haus von einem Schädling betroffen ist. Halte Abstand zu stechenden oder beißenden Insekten und respektiere Privatgrundstücke und Schutzgebiete bei der Suche."]),
 ("Deine Inhalte und dein Name", ["Der von dir gewählte Anzeigename und die von dir veröffentlichten Fänge sind für andere Spieler sichtbar, wenn du die Online-Funktionen nutzt. Wähle einen Namen, der nicht beleidigend oder irreführend ist. Bei Missbrauch können wir Namen entfernen oder den Online-Zugang einschränken. Für Dateien, die du exportierst oder teilst, bist du selbst verantwortlich."]),
 ("Deine Daten", ["Deine Sammlung liegt auf deinem Telefon. Sichere, was dir wichtig ist; lokale Daten können verloren gehen, wenn du sie löschst oder die App entfernst. Details stehen auf der Seite Datenschutz."]),
 ("Open Source und Datenquellen", ["Der Code der App ist Open Source unter der MIT-Lizenz. Modelle auf dem Gerät, Artendaten und Fotos stammen von Dritten unter deren eigenen Lizenzen, die in der App unter Ich → Hirn (Credits und Open-Source-Bibliotheken) aufgeführt sind."]),
 ("Die App-Store-Version", ["Sofern die App-Store-Seite keine eigene Vereinbarung enthält, wird dir die iOS-App unter Apples standardmäßigem Endnutzer-Lizenzvertrag lizenziert."]),
 ("Verfügbarkeit und Änderungen", ["Wir können Funktionen, Pakete, den Online-Dienst oder diese Bedingungen im Lauf des Projekts aktualisieren, pausieren oder einstellen. Wenn du die App nach einer Aktualisierung weiter nutzt, akzeptierst du die geänderten Bedingungen."]),
 ("Keine Gewährleistung", ["Die App wird so bereitgestellt, wie sie verfügbar ist. Soweit gesetzlich zulässig, übernehmen wir keine Garantie dafür, dass sie immer verfügbar, fehlerfrei oder für einen bestimmten Zweck geeignet ist, und haften nicht für Verluste aus ihrer Nutzung, auch nicht aus einer falschen Bestimmung."]),
 ("Fragen", ["Fragen zu diesen Bedingungen oder zur App schickst du an hello@critterboard.app."]),
 ]),
"es": ("UN POCO DE ESPACIO PARA CAZAR", "Términos de uso.", "Última actualización: 2 de octubre de 2026",
 "Estos términos se aplican a la app Critterboard y a su sitio web. Al usarlos aceptas hacerlo con responsabilidad y conforme a la ley.",
 [
 ("Usar Critterboard", ["Critterboard es gratuito para uso personal y no comercial. No intentes perturbar la app, sus servidores o su alojamiento, hacer trampas en el ranking ni usarla para dañar o acosar a otros."]),
 ("Las identificaciones son una estimación", ["La app identifica insectos con un modelo en tu teléfono. Los resultados pueden ser erróneos. No te fíes de ellos para nada importante, como decidir si un insecto es seguro de tocar o si una planta o una casa están afectadas por una plaga. Mantén la distancia con insectos que pican o muerden, y respeta la propiedad privada y las zonas protegidas cuando salgas a buscar."]),
 ("Tu contenido y tu nombre", ["El nombre visible que elijas y las capturas que publiques se muestran a otros jugadores cuando usas las funciones en línea. Elige un nombre que no sea ofensivo ni engañoso. Podemos eliminar nombres o restringir el acceso en línea por abuso. Eres responsable de cualquier archivo que exportes o compartas."]),
 ("Tus datos", ["Tu colección se guarda en tu teléfono. Haz copias de lo que te importe; los datos locales pueden perderse si borras o desinstalas la app. Consulta la página de Privacidad para más detalles."]),
 ("Código abierto y fuentes de datos", ["El código de la app es de código abierto con licencia MIT. Los modelos del dispositivo, los datos de especies y las fotos proceden de terceros con sus propias licencias, que aparecen en la app en Yo → Cerebro (créditos y bibliotecas de código abierto)."]),
 ("La versión de App Store", ["Salvo que la ficha de App Store incluya un acuerdo propio, la app para iOS se licencia bajo el contrato de licencia de usuario final estándar de Apple."]),
 ("Disponibilidad y cambios", ["Podemos actualizar, pausar o retirar funciones, packs, el servicio en línea o estos términos a medida que avanza el proyecto. Seguir usando la app tras una actualización significa que aceptas los términos actualizados."]),
 ("Sin garantía", ["La app se ofrece tal como está disponible. En la máxima medida que permita la ley, no garantizamos que esté siempre disponible, libre de errores o sea adecuada para un fin concreto, y no respondemos de pérdidas derivadas de su uso, incluidas las causadas por una identificación incorrecta."]),
 ("Preguntas", ["Escribe a hello@critterboard.app con preguntas sobre estos términos o la app."]),
 ]),
}
