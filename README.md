# WATER BATTLE

Vodní aréna pro prohlížeč s tréninkem proti botům a online multiplayerem. Backend běží v Node.js, bez externích závislostí.

## Spuštění multiplayeru

Potřebuješ **Node.js 22 nebo novější**. Ve složce projektu spusť:

```sh
node server.js
```

Otevři **http://localhost:3000**. Pokud máš npm, funguje i `npm start`; instalace balíčků není potřeba.

1. Klikni na **ZAČÍT → ONLINE S PŘÁTELI**.
2. Vyber tým (v nabídce **HRÁČI** můžeš změnit postavu), mapu, režim a napiš přezdívku.
3. Založ místnost a předej přátelům pozvánku nebo šestimístný kód.
4. Ostatní otevřou stejný server, vyberou postavu, zadají přezdívku a připojí se kódem.
5. Každý potvrdí **JSEM PŘIPRAVEN**. Zakladatel spustí bitvu.

V režimu **1v1** hrají dva lidé do 3 vyřazení. Týmový režim podporuje **2–10 lidí, nejvýše 5 na každé straně**, do 20 vyřazení. Oba týmy musí mít alespoň jednoho hráče a při startu se jejich velikost může lišit nejvýše o jednoho. Volná místa se nedoplňují boty.

V online hře mají všichni 3 životy, stejnou rychlost a stejné zbraně. Zelený kruh po respawnu poskytuje jednu sekundu ochrany; vlastní střelba ji ukončí. Vyřazený hráč se vrátí za 3 sekundy. Lokální upgrady, mince a úkoly platí pouze pro trénink. Po zápase může zakladatel připravit další zápas ve stejné místnosti.

### Více zařízení ve stejné síti

Server standardně poslouchá na `0.0.0.0:3000`. Ostatní otevřou `http://IP-POČÍTAČE:3000` (např. `http://192.168.1.25:3000`). Síť musí povolit přístup na tento port. Místní adresu počítače ve Windows zjistíš příkazem `ipconfig`.

Pozvánka používá adresu aktuální stránky. Pro pozvánky na další zařízení otevři hru přes síťovou IP i na počítači se serverem; odkaz s `localhost` funguje jen na témže počítači. Pro zkoušku na jednom počítači stačí dvě karty prohlížeče.

V PowerShellu lze nastavit jiný port nebo pouze lokální přístup:

```powershell
$env:PORT = '3001'
$env:HOST = '127.0.0.1'
node server.js
```

### Hraní přes internet

Tato větev obsahuje backend a frontend, nikoli nasazení na veřejnou adresu. Nasaď celý projekt na server podporující dlouho běžící proces Node.js a HTTPS. Pouhý statický hosting backend nespustí. Klienti i API musí být na stejném původu. Reverzní proxy musí pro `/api/events` vypnout buffering a povolit dlouhá SSE spojení; server posílá heartbeat každých 5 sekund. Pokud proxy ukládá URL do access logu, vynech u `/api/events` query string obsahující relační token.

## Ovládání

- PC: WASD / šipky pro pohyb, myš pro míření, klik pro střelbu; online lze tlačítko držet.
- Mobil: levá polovina plátna pro pohyb, pravá pro míření a střelbu.
- **MENU** během online hry opustí místnost.

Po krátkém výpadku se spojení automaticky obnovuje. Server drží hráčovo místo přibližně 15 sekund; obnovení stránky ve stejné kartě zachová identitu. Ovládání bez nových vstupů se zastaví po 400 ms. Po odchodu zakladatele přebírá vedení další hráč. Když během bitvy odejde celý tým, zbývající hráči se vrátí do lobby.

## Trénink bez serveru

Otevři `index.html` přímo v moderním prohlížeči a zvol **TRÉNINK S BOTY**. Režim 1v1 se hraje do 3 bodů a 5v5 do 20. Online funkce vyžadují spuštěný backend.

Všech 10 map má rozměry 2400 × 1600 herních jednotek. Překážky blokují hráče a střely. Kamera sleduje hráče a minimapa ukazuje celou arénu.

## Backend a hranice prototypu

- `server.js`: HTTP server, veřejné soubory, JSON API, ověření původu požadavků, omezení velikosti zpráv a počtu připojení.
- `server/rooms.js`: místnosti, relační tokeny, připravenost, oprávnění zakladatele, SSE připojení, úklid a opakování zápasu.
- `server/match.js`: autoritativní simulace 30× za sekundu; server rozhoduje o pohybu, kolizích, střelbě, zásazích, respawnu a skóre.
- `shared/maps.js`: společná definice všech map pro klienta i backend.
- `multiplayer.js`: online lobby, obnovování připojení a plynulé zobrazení serverového stavu. Vstupy jdou přes HTTP nejvýše 20× za sekundu, stav přes SSE 15× za sekundu.

API: `POST /api/rooms`, `POST /api/join`, `POST /api/command`, `GET /api/events?token=…`. Příkazy vyžadují hlavičku `Authorization: Bearer …`; tokeny se ostatním hráčům neposílají. `GET /healthz` vrací stav dostupnosti serveru.

Místnosti a relace jsou pouze v paměti **jednoho procesu**. Restart serveru je zruší. Prázdné místnosti se uklidí automaticky; neaktivní lobby a výsledky po 30 minutách. Limit je 100 současných místností. Nejsou zde účty, databáze, trvalé online statistiky ani koordinace mezi více servery. Přezdívky nejsou ověřené; k připojení stačí znát kód místnosti.

## Testy

```sh
node --test
```

Nebo `npm test`. V prostředí, které blokuje spouštění podprocesů:

```sh
node --test --experimental-test-isolation=none
```

Testy pokrývají mapy a spawn, pohyb a kolize, limity vstupů a střelby, zásahy, ochranu po respawnu, vítězství, kapacity a izolaci místností, práva zakladatele, odpojení, opakované připojení, další zápas a skutečnou HTTP/SSE komunikaci dvou klientů. Každý integrační test spouští vlastní server na náhodném lokálním portu.
