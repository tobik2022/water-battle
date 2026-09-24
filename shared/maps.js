// Shared map geometry for the browser and authoritative server.
(function (root) {
const maps = [
  {name:'Zatopený přístav', icon:'⚓', tint:'#28d7ff', obstacles:[[.30,.12,.12,.22,'pier'],[.58,.66,.12,.22,'pier'],[.30,.66,.12,.22,'pier'],[.58,.12,.12,.22,'pier'],[.46,.40,.08,.20,'island'],[.12,.24,.07,.09,'crate'],[.81,.67,.07,.09,'crate']]},
  {name:'Korálové bludiště', icon:'🪸', tint:'#ff75c3', obstacles:[[.16,.18,.10,.12,'island'],[.38,.10,.10,.25,'island'],[.62,.65,.10,.25,'island'],[.74,.28,.10,.12,'island'],[.40,.44,.20,.10,'island'],[.14,.66,.12,.10,'crate']]},
  {name:'Ledová zátoka', icon:'❄️', tint:'#b8f4ff', obstacles:[[.22,.16,.18,.10,'island'],[.60,.16,.18,.10,'island'],[.22,.74,.18,.10,'island'],[.60,.74,.18,.10,'island'],[.45,.30,.10,.40,'pier'],[.08,.43,.12,.08,'crate'],[.80,.49,.12,.08,'crate']]},
  {name:'Pirátův ostrov', icon:'☠️', tint:'#ffd166', obstacles:[[.40,.16,.20,.18,'island'],[.18,.47,.18,.12,'pier'],[.64,.47,.18,.12,'pier'],[.42,.62,.16,.16,'crate'],[.08,.18,.08,.12,'crate'],[.84,.70,.08,.12,'crate']]},
  {name:'Bouřkový průliv', icon:'⚡', tint:'#9b8cff', obstacles:[[.14,.10,.08,.30,'pier'],[.78,.60,.08,.30,'pier'],[.34,.36,.32,.08,'pier'],[.34,.56,.32,.08,'pier'],[.46,.18,.08,.14,'crate'],[.46,.68,.08,.14,'crate']]},
  {name:'Laguna', icon:'🌴', tint:'#65e6a7', obstacles:[[.12,.16,.14,.14,'island'],[.74,.16,.14,.14,'island'],[.12,.70,.14,.14,'island'],[.74,.70,.14,.14,'island'],[.40,.40,.20,.20,'island'],[.30,.12,.08,.08,'crate'],[.62,.80,.08,.08,'crate']]},
  {name:'Vodní aréna', icon:'✦', tint:'#ff6b9d', obstacles:[[.12,.12,.18,.08,'pier'],[.70,.12,.18,.08,'pier'],[.12,.80,.18,.08,'pier'],[.70,.80,.18,.08,'pier'],[.42,.30,.16,.08,'crate'],[.42,.62,.16,.08,'crate'],[.42,.44,.16,.12,'island']]},
  {name:'Rozbitá přehrada', icon:'▥', tint:'#ff9f43', obstacles:[[.28,.08,.12,.30,'pier'],[.60,.62,.12,.30,'pier'],[.28,.62,.12,.30,'pier'],[.60,.08,.12,.30,'pier'],[.44,.44,.12,.12,'crate'],[.10,.42,.12,.16,'island'],[.78,.42,.12,.16,'island']]},
  {name:'Měsíční záliv', icon:'☾', tint:'#c2a7ff', obstacles:[[.20,.22,.12,.12,'island'],[.68,.22,.12,.12,'island'],[.20,.66,.12,.12,'island'],[.68,.66,.12,.12,'island'],[.42,.18,.16,.08,'crate'],[.42,.74,.16,.08,'crate'],[.44,.40,.12,.20,'pier']]},
  {name:'Tajný kanál', icon:'〰', tint:'#54e0d0', obstacles:[[.10,.30,.26,.08,'pier'],[.64,.30,.26,.08,'pier'],[.10,.62,.26,.08,'pier'],[.64,.62,.26,.08,'pier'],[.42,.28,.16,.08,'island'],[.42,.64,.16,.08,'island'],[.08,.12,.08,.10,'crate'],[.84,.78,.08,.10,'crate']]}
];
const mapMissions=[
  ['Přístavní nájezd',3,'Získej 3 vyřazení'],['Korálový lov',4,'Získej 4 vyřazení'],['Ledová výprava',2,'Získej 2 vyřazení'],['Poklad kapitána',5,'Získej 5 vyřazení'],['Bouřková hlídka',3,'Získej 3 vyřazení bez prohry'],['Ostrovní převaha',4,'Získej 4 vyřazení'],['Arénový šampion',6,'Získej 6 vyřazení'],['Přehradní průlom',3,'Získej 3 vyřazení'],['Měsíční lovec',2,'Získej 2 vyřazení'],['Tichý průchod',5,'Získej 5 vyřazení']
];
maps.forEach((m,i)=>{m.mission=mapMissions[i][0];m.goal=mapMissions[i][1];m.missionText=mapMissions[i][2]});

if (typeof module !== 'undefined' && module.exports) module.exports = maps;
else root.WaterBattleMaps = maps;
})(typeof globalThis !== 'undefined' ? globalThis : this);
