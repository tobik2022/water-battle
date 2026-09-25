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

V režimu **1v1** mohou hrát až dva lidé do 3 vyřazení; při jednom člověku druhou stranu doplní bot. Režim **2v2** vyžaduje přesně čtyři lidi, dva na každé straně, a hraje se do 8 bodů bez botů. Režimy **3v3**, **4v4** a **5v5** podporují 1–5 lidí v místnosti; server při startu doplní chybějící sloty autoritativními boty do plných týmů a hraje se do 12, 16 nebo 20 bodů.

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

#### Apache2 na `https://bicik.net/water_battle/`

Soubor [`deploy/apache2-water-battle.conf`](deploy/apache2-water-battle.conf) obsahuje HTTPS VirtualHost, přesměrování HTTP, Let’s Encrypt challenge a reverse proxy na Node.js. Zkopíruj projekt na server, spusť backend pouze lokálně (`HOST=127.0.0.1 PORT=3000 node server.js`) a nainstaluj konfiguraci:

```sh
sudo apt install apache2 certbot python3-certbot-apache
sudo a2enmod ssl proxy proxy_http headers rewrite
sudo mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
sudo cp deploy/apache2-water-battle.conf /etc/apache2/sites-available/bicik.net.conf
sudo a2ensite bicik.net.conf
# Poprvé certifikát vystav před prvním reloadem SSL vhostu. Pokud certifikát
# ještě neexistuje, dočasně použij pouze HTTP část vhostu nebo `certbot --apache`.
sudo certbot certonly --webroot -w /var/www/letsencrypt -d bicik.net
sudo apache2ctl configtest
sudo systemctl reload apache2
sudo systemctl reload apache2
```

Konfigurace posílá `/water_battle/api/events` přes dlouhé SSE spojení a ostatní požadavky pod `/water_battle/` do Node.js. DNS záznam `bicik.net` musí ukazovat na server a porty 80/443 musí být dostupné z internetu.

## Ovládání

- PC: WASD / šipky pro pohyb, myš pro míření, klik pro střelbu; online lze tlačítko držet.
- Mobil: vlevo je pevný modrý joystick pro pohyb a vpravo pevný oranžový joystick pro střelbu. Táhni prstem z jejich středu směrem, kterým chceš jít nebo střílet; oba ovladače fungují současně. Puštěním prstu ovládání zastavíš.
- **MENU** během online hry opustí místnost.

Po krátkém výpadku se spojení automaticky obnovuje. Server drží hráčovo místo přibližně 15 sekund; obnovení stránky ve stejné kartě zachová identitu. Ovládání bez nových vstupů se zastaví po 400 ms. Po odchodu zakladatele přebírá vedení další hráč. Když během bitvy odejde celý tým, zbývající hráči se vrátí do lobby.

## Trénink bez serveru

Otevři `index.html` přímo v moderním prohlížeči a zvol **TRÉNINK S BOTY**. Režimy 1v1 až 5v5 mají stejné limity jako online hra. Online funkce vyžadují spuštěný backend.

Všech 10 map má rozměry 2400 × 1600 herních jednotek. Překážky blokují hráče a střely. Kamera sleduje hráče a minimapa ukazuje celou arénu.

## Backend a hranice prototypu

- `server.js`: HTTP server, veřejné soubory, JSON API, ověření původu požadavků, omezení velikosti zpráv a počtu připojení.
- `server/rooms.js`: místnosti, relační tokeny, připravenost, oprávnění zakladatele, SSE připojení, úklid a opakování zápasu.
- `server/match.js`: autoritativní simulace 30× za sekundu; server rozhoduje o pohybu, kolizích, střelbě, zásazích, respawnu a skóre.
- `shared/maps.js`: společná definice všech map pro klienta i backend.
- `multiplayer.js`: online lobby, obnovování připojení a plynulé zobrazení serverového stavu. Při nečinnosti se vstupy neposílají; při aktivním ovládání jdou přes kompaktní HTTP endpoint nejvýše 20× za sekundu s keepalive po 200 ms, stav jde přes SSE jen při změně.

API: `POST /api/rooms`, `POST /api/join`, `POST /api/command`, `POST /api/input`, `GET /api/events?token=…`. `POST /api/input` je vyhrazený kompaktní endpoint pro průběžné ovládání; produkční Apache konfigurace ho proto nezapisuje do běžného access logu. Příkazy vyžadují hlavičku `Authorization: Bearer …`; tokeny se ostatním hráčům neposílají. `GET /healthz` vrací stav dostupnosti serveru.

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
