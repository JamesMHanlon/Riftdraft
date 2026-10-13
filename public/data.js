"use strict";
// Champion data:
// [name, Data Dragon id, roles (main first), early, late, teamfight, damage, frontline, crowd control, class, range]
// class: T tank · F fighter · A assassin · M mage · K marksman · E enchanter    range: m melee · r ranged
const CHAMP_DATA = [
  ["Aatrox","Aatrox","Top",8,6,8,"AD",6,6,"F","m"],
  ["Darius","Darius","Top",9,5,7,"AD",6,4,"F","m"],
  ["Garen","Garen","Top",7,6,6,"AD",6,3,"F","m"],
  ["Malphite","Malphite","Top,Support",4,7,9,"AP",9,9,"T","m"],
  ["Ornn","Ornn","Top",4,8,9,"AD",10,8,"T","m"],
  ["Fiora","Fiora","Top",7,9,4,"AD",3,2,"F","m"],
  ["Camille","Camille","Top",6,8,6,"AD",4,5,"F","m"],
  ["Jax","Jax","Top,Jungle",6,9,6,"AD",4,4,"F","m"],
  ["Sion","Sion","Top",3,8,8,"AD",9,8,"T","m"],
  ["Gwen","Gwen","Top",5,9,7,"AP",4,3,"F","m"],
  ["Renekton","Renekton","Top",9,4,6,"AD",6,5,"F","m"],
  ["Mordekaiser","Mordekaiser","Top",7,7,6,"AP",6,3,"F","m"],
  ["K'Sante","KSante","Top",6,7,8,"AD",9,8,"T","m"],
  ["Teemo","Teemo","Top",7,6,4,"AP",1,3,"M","r"],
  ["Cho'Gath","Chogath","Top,Mid",5,8,7,"AP",9,7,"T","m"],
  ["Shen","Shen","Top,Support",6,6,8,"AP",8,7,"T","m"],
  ["Rumble","Rumble","Top,Mid",7,6,9,"AP",4,4,"M","m"],
  ["Poppy","Poppy","Top,Jungle",6,6,7,"AD",8,8,"T","m"],

  ["Lee Sin","LeeSin","Jungle",10,4,6,"AD",4,6,"F","m"],
  ["Elise","Elise","Jungle",9,3,5,"AP",3,6,"A","r"],
  ["Kha'Zix","Khazix","Jungle",8,7,5,"AD",2,2,"A","m"],
  ["Vi","Vi","Jungle",7,6,7,"AD",5,8,"F","m"],
  ["Sejuani","Sejuani","Jungle",5,7,9,"AP",9,10,"T","m"],
  ["Amumu","Amumu","Jungle,Support",4,7,10,"AP",8,9,"T","m"],
  ["Graves","Graves","Jungle",8,7,6,"AD",4,3,"K","r"],
  ["Hecarim","Hecarim","Jungle",6,7,8,"AD",6,7,"F","m"],
  ["Kindred","Kindred","Jungle",6,9,6,"AD",2,3,"K","r"],
  ["Viego","Viego","Jungle",6,8,7,"AD",3,3,"F","m"],
  ["Nidalee","Nidalee","Jungle",9,4,4,"AP",1,2,"A","r"],
  ["Jarvan IV","JarvanIV","Jungle",8,5,8,"AD",6,8,"F","m"],
  ["Xin Zhao","XinZhao","Jungle",9,5,6,"AD",5,6,"F","m"],
  ["Master Yi","MasterYi","Jungle",4,10,5,"AD",2,1,"A","m"],
  ["Wukong","MonkeyKing","Jungle,Top",6,7,9,"AD",6,7,"F","m"],
  ["Lillia","Lillia","Jungle",6,8,8,"AP",3,6,"M","m"],
  ["Ekko","Ekko","Jungle,Mid",7,7,6,"AP",2,4,"A","m"],
  ["Diana","Diana","Jungle,Mid",6,7,8,"AP",4,6,"A","m"],

  ["Ahri","Ahri","Mid",7,7,7,"AP",2,6,"M","r"],
  ["Syndra","Syndra","Mid",7,8,8,"AP",1,6,"M","r"],
  ["Orianna","Orianna","Mid",5,8,10,"AP",2,8,"M","r"],
  ["Zed","Zed","Mid",8,7,4,"AD",2,2,"A","m"],
  ["Yasuo","Yasuo","Mid,Top",6,8,7,"AD",3,6,"F","m"],
  ["Yone","Yone","Mid,Top",5,9,7,"AD",3,6,"F","m"],
  ["Viktor","Viktor","Mid",5,9,8,"AP",1,5,"M","r"],
  ["LeBlanc","Leblanc","Mid",9,5,5,"AP",1,5,"A","r"],
  ["Azir","Azir","Mid",4,10,8,"AP",2,7,"M","r"],
  ["Katarina","Katarina","Mid",6,8,8,"AP",1,1,"A","m"],
  ["Twisted Fate","TwistedFate","Mid",6,7,6,"AP",1,6,"M","r"],
  ["Galio","Galio","Mid,Support",6,6,9,"AP",7,9,"T","m"],
  ["Vex","Vex","Mid",6,7,8,"AP",2,7,"M","r"],
  ["Akali","Akali","Mid,Top",7,8,6,"AP",2,2,"A","m"],
  ["Kassadin","Kassadin","Mid",2,10,6,"AP",2,3,"A","m"],
  ["Sylas","Sylas","Mid,Jungle",7,7,7,"AP",3,4,"F","m"],
  ["Taliyah","Taliyah","Jungle,Mid",8,6,7,"AP",1,6,"M","r"],

  ["Jinx","Jinx","ADC",4,10,9,"AD",1,4,"K","r"],
  ["Caitlyn","Caitlyn","ADC",9,7,6,"AD",1,4,"K","r"],
  ["Kai'Sa","Kaisa","ADC",5,9,7,"AD",2,2,"K","r"],
  ["Ezreal","Ezreal","ADC",7,7,5,"AD",1,2,"K","r"],
  ["Jhin","Jhin","ADC",7,7,7,"AD",1,5,"K","r"],
  ["Vayne","Vayne","ADC,Top",3,10,6,"AD",1,3,"K","r"],
  ["Draven","Draven","ADC",10,6,6,"AD",1,3,"K","r"],
  ["Miss Fortune","MissFortune","ADC",8,6,9,"AD",1,3,"K","r"],
  ["Ashe","Ashe","ADC,Support",6,7,8,"AD",1,8,"K","r"],
  ["Aphelios","Aphelios","ADC",4,9,9,"AD",1,4,"K","r"],
  ["Xayah","Xayah","ADC",6,8,7,"AD",1,5,"K","r"],
  ["Varus","Varus","ADC,Mid",7,7,8,"AD",1,6,"K","r"],
  ["Lucian","Lucian","ADC,Mid",9,5,5,"AD",1,1,"K","r"],
  ["Zeri","Zeri","ADC",4,9,7,"AD",1,2,"K","r"],
  ["Tristana","Tristana","ADC,Mid",6,9,6,"AD",1,3,"K","r"],

  ["Thresh","Thresh","Support",7,7,8,"AD",5,9,"T","r"],
  ["Leona","Leona","Support",8,5,8,"AD",8,10,"T","m"],
  ["Nautilus","Nautilus","Support",8,6,8,"AP",8,10,"T","m"],
  ["Lulu","Lulu","Support",6,8,7,"AP",2,7,"E","r"],
  ["Janna","Janna","Support",5,8,8,"AP",2,8,"E","r"],
  ["Blitzcrank","Blitzcrank","Support",8,5,6,"AP",6,8,"T","m"],
  ["Rakan","Rakan","Support",6,7,9,"AP",4,9,"E","m"],
  ["Soraka","Soraka","Support",4,8,7,"AP",1,5,"E","r"],
  ["Pyke","Pyke","Support",9,5,6,"AD",3,7,"A","m"],
  ["Braum","Braum","Support",6,7,8,"AD",8,8,"T","m"],
  ["Morgana","Morgana","Support,Mid",5,7,8,"AP",2,9,"M","r"],
  ["Karma","Karma","Support,Mid",8,6,7,"AP",2,6,"E","r"],
  ["Nami","Nami","Support",7,7,8,"AP",2,8,"E","r"],
  ["Senna","Senna","Support,ADC",6,9,7,"AD",1,5,"K","r"],
  ["Bard","Bard","Support",6,7,7,"AP",2,8,"E","r"],
  ["Alistar","Alistar","Support",7,6,8,"AP",9,10,"T","m"],
  ["Rell","Rell","Support",6,6,9,"AP",8,10,"T","m"],
  ["Zyra","Zyra","Support",7,6,7,"AP",1,7,"M","r"],
];

const CHAMPS = CHAMP_DATA.map(([name, id, roles, early, late, tf, dmg, front, cc, cls, range]) =>
  ({ name, id, roles: roles.split(","), early, late, tf, dmg, front, cc, cls, range }));

// Hard counters: key champion is strong against every champion in its list.
const COUNTERS = {
  Malphite: ["Yasuo","Yone","MasterYi","Zed","Jax","Tristana","Draven"],
  Teemo: ["Darius","Garen","Renekton","Aatrox","Sion","Mordekaiser"],
  Vayne: ["Ornn","Sion","Chogath","KSante","Malphite","Sejuani","Amumu","Shen"],
  Fiora: ["Ornn","Sion","Chogath","KSante","Garen","Malphite"],
  Gwen: ["Ornn","Sion","KSante","Chogath","Shen"],
  Camille: ["Ornn","Sion","KSante","Malphite"],
  Mordekaiser: ["Sion","Ornn","Shen"],
  Darius: ["Garen","Ornn","Sion"],
  Renekton: ["Gwen","Yone","Yasuo","Akali"],
  Jax: ["Fiora","Camille","Gwen"],
  Poppy: ["Vi","JarvanIV","Camille","LeeSin","Yasuo","Yone","Akali","Hecarim"],
  Vex: ["Kassadin","Yasuo","Yone","Akali","Katarina","Ekko","LeeSin","Camille"],
  Galio: ["Ahri","Syndra","Katarina","Akali","Leblanc","Kassadin","Vex"],
  Kassadin: ["Syndra","Ahri","Viktor","Orianna","Azir","Leblanc","TwistedFate"],
  Lulu: ["Zed","Khazix","Katarina","Pyke","Akali"],
  Janna: ["Hecarim","Amumu","Sejuani","Leona","Nautilus","JarvanIV"],
  Morgana: ["Blitzcrank","Thresh","Pyke","Leona","Nautilus","Rell"],
  Braum: ["Caitlyn","Ezreal","Varus","Jhin","Draven"],
  Yasuo: ["Ezreal","Varus","Syndra","Caitlyn","Jhin","Ashe"],
  Caitlyn: ["Vayne","Kaisa","Aphelios","Jinx","Zeri"],
  Draven: ["Vayne","Kaisa","Aphelios","Jinx","Ezreal"],
  Lucian: ["Jinx","Vayne","Aphelios","Zeri"],
  XinZhao: ["Nidalee","Kindred","Graves"],
  Khazix: ["Kindred","Nidalee"],
  Amumu: ["MasterYi","Viego","Kindred"],
  Sejuani: ["MasterYi","Viego","Graves"],
  Leona: ["Soraka","Senna","Nami","Lulu"],
  Nautilus: ["Soraka","Senna","Zyra"],
  Blitzcrank: ["Soraka","Senna","Zyra","Bard"],
  Alistar: ["Pyke","Rakan","Thresh"],
  Rell: ["Kaisa","Vayne","Zeri"],
  Zed: ["Viktor","Syndra","Azir","TwistedFate","Orianna"],
  Ekko: ["Syndra","Viktor"],
  Diana: ["Yasuo","Yone","Katarina"],
  Ahri: ["Yasuo","Yone","Katarina"],
  Chogath: ["Katarina","Akali","Yasuo"],
};

const BOT_NAMES = ["Baron Barons","Nexus Ninjas","Gank Squad","Flash Forward","Pentakill Pals","Turret Divers",
  "Ward Wizards","Smite Club","Inhib Hunters","Elder Wolves","River Rats","Herald Heroes","Blue Buff Boys",
  "Recall Royals","Minion Mafia","Dragon Soul Society","Ignite Initiative","Teleport Titans","Scuttle Crew","Jungle Diffs"];

const ROLE_SVG = {
  Top: '<path d="M3 3h14l-4 4H7v6l-4 4z"/><path opacity=".3" d="M21 21H7l4-4h6v-6l4-4zM10 10h4v4h-4z"/>',
  Jungle: '<path d="M6 2c2.5 3.5 3.8 7.6 3.3 12.4L12 22l2.7-7.6C14.2 9.6 15.5 5.5 18 2c-2.6 2-4.6 4.6-6 8-1.4-3.4-3.4-6-6-8z"/><path d="M2.5 8c1.8 1.4 3 3.2 3.6 5.4L7.5 12c-1-2-2.8-3.4-5-4zM21.5 8c-1.8 1.4-3 3.2-3.6 5.4L16.5 12c1-2 2.8-3.4 5-4z"/>',
  Mid: '<path d="M15.5 3H21v5.5L8.5 21H3v-5.5z"/><path opacity=".3" d="M3 3h10l-3 3H6v4l-3 3zM21 21H11l3-3h4v-4l3-3z"/>',
  ADC: '<path d="M21 21H7l4-4h6v-6l4-4z"/><path opacity=".3" d="M3 3h14l-4 4H7v6l-4 4zM10 10h4v4h-4z"/>',
  Support: '<path d="M9 3h6l-1.2 5h-3.6z"/><path d="M2 7.5h6.5l2 3.5-3 2.5zM22 7.5h-6.5l-2 3.5 3 2.5z"/><path d="M10 12.5h4l1.2 4.5L12 21l-3.2-4z"/>',
};
const roleIcon = r => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ROLE_SVG[r] || ""}</svg>`;

const ICONS = {
  solo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/></svg>',
  duel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20c0-3 2.2-5 5-5s5 2 5 5M12 20c0-3 2.2-5 5-5s5 2 5 5"/></svg>',
  host: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="11" r="2"/><path d="M8.5 7.5a5 5 0 0 0 0 7M15.5 7.5a5 5 0 0 1 0 7M5.5 4.5a9.5 9.5 0 0 0 0 13M18.5 4.5a9.5 9.5 0 0 1 0 13M12 13v8"/></svg>',
  join: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h5v16h-5"/><path d="M3 12h11M10 8l4 4-4 4"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10v2h4v3a5 5 0 0 1-4.6 5A5 5 0 0 1 13 14.9V18h3.5v2h-9v-2H11v-3.1A5 5 0 0 1 7.6 12 5 5 0 0 1 3 7V4h4zm0 4H5v1a3 3 0 0 0 2 2.8zm10 0v3.8A3 3 0 0 0 19 7V6z"/><rect x="6" y="21" width="12" height="1.6" rx=".8"/></svg>',
  swords: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/></svg>',
};

const MAP_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><linearGradient id="mapg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0c2a38"/><stop offset=".5" stop-color="#0d1b2c"/><stop offset="1" stop-color="#2a1320"/></linearGradient></defs>
  <rect width="100" height="100" fill="url(#mapg)"/>
  <path d="M18 18L82 82" stroke="#1d7f9c" stroke-width="11" opacity=".3" stroke-linecap="round"/>
  <g fill="none" stroke="#c8aa6e" stroke-opacity=".32" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 90V10h80"/><path d="M10 90h80V10"/><path d="M10 90L90 10"/>
  </g>
  <circle cx="10" cy="90" r="7" fill="#4ea4ff" fill-opacity=".45" stroke="#4ea4ff"/>
  <circle cx="90" cy="10" r="7" fill="#ff5a66" fill-opacity=".45" stroke="#ff5a66"/>
</svg>`;
const MAP_POS = { Top: [14, 16], Jungle: [31, 43], Mid: [50, 50], ADC: [79, 89], Support: [90, 77] };
