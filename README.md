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


## Poprawka numeracji
W panelu admina widoczna jest liczba wszystkich kont (nie tylko wybranej klasy). Przycisk „Usuń WSZYSTKICH uczniów” po podwójnym potwierdzeniu kasuje wszystkie konta i powiązane dane lokalne, dzięki czemu następne generowanie zaczyna się od uczen1. Usunięcie klasy samo w sobie NIE usuwa uczniów. Uwaga: tej operacji nie można cofnąć.


## Reset hasła ucznia (wersja demonstracyjna)

Na ekranie logowania ucznia kliknij „Nie pamiętam hasła”, podaj login i wyślij prośbę. Administrator w swoim panelu zobaczy prośbę i wygeneruje losowy kod jednorazowy (8 znaków), ważny przez 30 minut. Musi przekazać go uczniowi poza stroną. Uczeń wybiera „Mam jednorazowy kod”, wpisuje login, kod i nowe hasło do 10 znaków. Po użyciu kod jest usuwany. Wygenerowanie nowego kodu unieważnia poprzedni.

UWAGA: GitHub Pages nie zapewnia serwera. Konta, hasła, prośby i kody są przechowywane w localStorage w tej samej przeglądarce i mogą zostać odczytane lub zmienione przez użytkownika urządzenia. Funkcja służy tylko do demonstracji na jednym urządzeniu; nie nadaje się do prawdziwego resetowania haseł uczniów ani ochrony danych osobowych. Do użycia w szkole niezbędny jest backend z bezpiecznym uwierzytelnianiem, autoryzacją i synchronizacją.


## Nowość: kafelki i powrót
Po zalogowaniu administrator i uczeń widzą duże kolorowe kafelki. Po wejściu w funkcję przycisk „← Wróć do kafelków” przywraca menu bez wylogowania.


Poprawka: tabela wygenerowanych kont jest widoczna w kafelku Konta uczniów; wydruk zawiera wyłącznie loginy, hasła startowe i klasy, bez dziennika ocen. Drukuj > Zapisz jako PDF.


## Testy online (nowe)
W kafelku „Testy i PDF” uczeń wybiera ABCD lub zadania otwarte, mieszany kierunek EN↔PL i liczbę pytań. Test losuje słówka z notesu, sprawdza wynik i pokazuje prawidłowe odpowiedzi. Wynik nie jest automatycznie oceną w dzienniku. Drukowanie / PDF nadal dostępne. Wszystko działa lokalnie w przeglądarce (wersja demonstracyjna).

## Poprawka dziennika ocen
W kafelku Oceny uczniów widoczna jest lista uczniów i skrzynka próśb. Nauczyciel może zaakceptować średnią na 24 godziny albo odrzucić prośbę. Uczeń zawsze widzi swoje oceny, ale średnią tylko po akceptacji. Dane lokalne w jednej przeglądarce.

## Osobny kafelek akceptacji średniej
W panelu administratora jest oddzielny kafelek **📨 Akceptacja średniej** z liczbą oczekujących próśb. Uczeń wysyła prośbę w Moje oceny, a administrator zatwierdza na 24 godziny lub odrzuca. Oceny i średnie pozostają w kafelku **📊 Oceny uczniów**. Wersja demonstracyjna zapisuje dane wyłącznie w przeglądarce.


## Automatyczne oceny testów online
Po kliknięciu „Sprawdź wynik” zalogowanemu uczniowi wpisywana jest ocena typu „Egzamin na stronie” (pomarańczowa) do lokalnego dziennika ocen. Skala: 0–29% = 1, 30–49% = 2, 50–69% = 3, 70–84% = 4, 85–94% = 5, 95–100% = 6. Test można sprawdzić tylko raz, by nie zapisywać duplikatów; nowy test pozwala na nową próbę. Administrator nie rozwiązuje testu w swoim panelu w tej wersji. Wszystkie dane są lokalne w przeglądarce; nie jest to bezpieczny dziennik dla prawdziwych uczniów.
