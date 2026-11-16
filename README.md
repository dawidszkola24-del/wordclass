# WordClass — kolorowa wersja demonstracyjna

## Uruchomienie
Otwórz `index.html` lub wgraj cztery pliki (`index.html`, `app.js`, `style.css`, `README.md`) do głównego katalogu repozytorium GitHub Pages.

## Logowanie
Na stronie głównej są dwa osobne przyciski: Administrator i Uczeń.

- Administrator DEMO: `admin` / `wordclass`.
- Konta uczniów tworzy administrator; każde ma losowe 5-znakowe hasło startowe.
- Przy pierwszym logowaniu uczeń podaje imię, nazwisko i własne hasło (do 10 znaków).
- Uczniowie mają notes (maks. 100 par), ćwiczenia EN↔PL i test do wydruku/PDF.

**Uwaga:** To tylko demonstracja. Dane są zapisywane w `localStorage` w przeglądarce i **nie synchronizują się** między urządzeniami. Hasło administratora znajduje się w publicznym kodzie. Nie używaj prawdziwych danych uczniów. Aby uruchomić prawdziwą klasę z kontami na różnych urządzeniach, potrzebne są backend, baza danych i bezpieczne uwierzytelnianie.

## Zapisywanie PDF
Użyj przycisku drukowania, a w oknie drukowania wybierz „Zapisz jako PDF”.


## Klasy (wersja 3)
Administrator może utworzyć do 10 klas, przypisywać do nich nowe konta uczniów i filtrować/drukować listy dla wybranej klasy. Usunięcie klasy nie usuwa kont uczniów — konta pozostają bez klasy. Zapis działa w localStorage tylko na bieżącym urządzeniu.

UWAGA: To prototyp demonstracyjny. Hasła są przechowywane w przeglądarce, a hasło administratora jest w kodzie. Nie używać jako prawdziwego systemu kont uczniów ani do przechowywania danych osobowych. Do bezpiecznego działania między urządzeniami potrzebny jest backend i uwierzytelnianie.

## Nowe w tej wersji
- Numery loginów `uczen1`, `uczen2` itd. są wybierane jako pierwsze wolne. Po usunięciu wszystkich uczniów nowy login to `uczen1`.
- Osobna zakładka „3 formy czasowników”: wpisywanie `go - went - gone - iść`, ćwiczenie II i III formy, test oraz druk/PDF.
- Dane nadal są zapisywane tylko w localStorage przeglądarki. To demonstracja, nie bezpieczny system wielourządzeniowy.


## Dziennik ocen (nowość)
- Administrator: przy uczniu kliknij „📊 Oceny”, wybierz ocenę (1, 1+, 2-, 2, 2+, ... 6+) i rodzaj: sprawdzian (żółty), kartkówka (czerwony), odpowiedź ustna (niebieski), egzamin na stronie (pomarańczowy). Oceny można usuwać.
- Średnia to średnia arytmetyczna, każda ocena ma tę samą wagę. Dla obliczeń minus = -0,25, plus = +0,25 (wartości ograniczone do zakresu 1–6). To umowny sposób liczenia, można go zmienić zgodnie z zasadami szkoły.
- Uczeń widzi oceny, ale nie widzi średniej. Może wysłać prośbę; administrator zatwierdza ją na 24 godziny lub odrzuca. Dostęp wygasa według czasu urządzenia.
- **WAŻNE:** Całość jest DEMO działającym wyłącznie w localStorage jednej przeglądarki. Prośby, oceny, konta i hasła nie synchronizują się między urządzeniami. Kod nie zapewnia bezpiecznego logowania ani ochrony danych osobowych. Nie używaj do rzeczywistych ocen uczniów ani do przechowywania ich danych bez wdrożenia backendu, uwierzytelniania i kontroli uprawnień.
