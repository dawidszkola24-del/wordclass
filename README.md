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
