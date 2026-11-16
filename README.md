# WordClass — projekt startowy

Kolorowa, responsywna strona do nauki słówek angielskich.

## Uruchomienie
Otwórz `index.html` w przeglądarce albo opublikuj pliki przez GitHub Pages.

## Konta demonstracyjne
- Administrator: `admin` / `wordclass`
- Uczeń: `uczen1` / `start1`

## Co działa w tej wersji
- kolorowa strona główna i panel,
- demonstracyjne logowanie,
- notes ucznia: do 100 par słówek w formacie `apple - jabłko`,
- zapis zestawów i postępów w pamięci przeglądarki (localStorage),
- quiz wielokrotnego wyboru i zmiana kierunku EN→PL / PL→EN,
- demonstracyjny generator loginów i haseł oraz wydruk do PDF przez okno drukowania.

## Ważne — przed użyciem przez prawdziwą klasę
To jest prototyp front-endowy. Dane zapisują się lokalnie w przeglądarce, a loginy demo są widoczne w kodzie. Nie używaj tej wersji do prawdziwych danych uczniów ani jako bezpiecznego systemu kont. Do wersji publicznej potrzebne jest podłączenie backendu i bazy danych (np. Supabase), prawdziwe uwierzytelnianie, role administrator/uczeń oraz bezpieczne jednorazowe hasła.

## Publikacja przez GitHub Pages
1. Utwórz repozytorium na GitHubie.
2. Wgraj `index.html`, `style.css`, `app.js` i `README.md` do głównego katalogu repozytorium.
3. Wejdź w Settings → Pages.
4. W sekcji Build and deployment wybierz Deploy from a branch.
5. Wybierz branch `main` i folder `/ (root)`, a następnie Save.
6. Po chwili GitHub pokaże publiczny adres strony.
