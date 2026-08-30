/* ============================================================
   NO CSBS Fantasy Football League — master data
   Transcribed from ESPN Final Standings, 2008–2025 (18 seasons).
   Edit the raw data below; all-time records are computed at load.
   ============================================================ */
(function () {
  // ---- Managers ---------------------------------------------------
  // Current 10 members (as of 2025). alias = ESPN owner name seen in data.
  const MEMBERS = [
    { id: "casey",    name: "Casey Schannauer",        joined: 2008, team: "Crumpled 4 Christ",      handle: "The Reigning King" },
    { id: "soy",      name: 'Brandon "Soy" Swoyer',    joined: 2008, team: "Fragile P*cks",          handle: "The Godfather" },
    { id: "brent",    name: "Brent Jasperson",         joined: 2008, team: "Krooked Kommish",         handle: "The Commissioner" },
    { id: "josh",     name: "Josh Michalec",           joined: 2008, team: "Dangerous Nights Crew",   handle: "Back-to-Back Josh" },
    { id: "alexLam",  name: "Alex Lam",                joined: 2016, team: "The Pohlads",             handle: "Hurricane" },
    { id: "nick",     name: "Nick Sweeney",            joined: 2018, team: "Say it Aint Sooo",        handle: "Ex-New Guy" },
    { id: "buser",    name: "Jon Buser",               joined: 2019, team: "Bunch of Cucks",          handle: "Draft Dodger" },
    { id: "brandonJ", name: "Brandon Jasperson",       joined: 2008, team: "Mighty Ducks",            handle: "The Crab King" },
    { id: "alexBoone",name: "Alex Boone",              joined: 2023, team: "Pass me the mic",         handle: "The Rookie Champ" },
    { id: "jake",     name: "Jake Wagner",             joined: 2025, team: "Colston LovelsLand",      handle: "The New Guy" }
  ];

  // Former members — the Graveyard.
  const GRAVEYARD = [
    { id: "dahlin",  name: "Andrew Dahlin",            span: "2008 – 2022", lastTeam: "Bilbos Bunch",                epitaph: "Two rings and still ghosted the group chat." },
    { id: "timofey", name: 'Timofey "Dumbass" Summers',span: "2010 – 2025", lastTeam: "CA-YAYAYAYAYA MMMMM NEWTON",  epitaph: "15 seasons, 0 rings. The grind was the punishment." },
    { id: "andyPage",name: "Andy Page",                span: "2009 – 2018", lastTeam: "Golden Taints",               epitaph: "Won it all in 2010, coasted for a decade." },
    { id: "shane",   name: 'Shane "Tubby" Pantila',    span: "2010 – 2017", lastTeam: "Tom Bra-Deez Nuts",           epitaph: "Champ in '15. Vanished before collecting the trophy tears." },
    { id: "dylan",   name: "Dylan Michalec",           span: "2008 – 2015", lastTeam: "Bye Bye Bye Week",            epitaph: "So close, so often. Never touched the trophy." },
    { id: "lorren",  name: "Lorren Barett",            span: "2008 – 2009", lastTeam: "Team barett",                 epitaph: "Blink and you missed him. Two seasons, gone." }
  ];

  // ---- Seasons ----------------------------------------------------
  // rows: [ownerId, teamName, W, L, T, PF, PA]  (rank = array order, 1-based)
  // co = co-owner id (for the Mgroin/Jasperson franchise)
  const SEASONS = [
    { year: 2008, rows: [
      ["dahlin","Team Dahlin",8,5,0,1267,1172],
      ["soy","Soy's Souljas",11,2,0,1363,1125],
      ["brent","ISU Domination",9,4,0,1092,1030],
      ["dylan","Snake Griffin",5,7,1,1113,1089],
      ["josh","St. Olaf Doin' It Live",4,9,0,1070,1144],
      ["casey","These Guys Fuckin Blew It",5,8,0,1089,1262],
      ["lorren","Team barett",4,8,1,1090,1216],
      ["brandonJ","Team Mgroin",5,8,0,1090,1136]
    ]},
    { year: 2009, rows: [
      ["soy","Soys Souljas",7,6,0,1325,1216],
      ["dylan","But it wasn't a rock!",7,5,1,1228,1170],
      ["andyPage","Pants Partiers",9,4,0,1295,1136],
      ["dahlin","Excuse Me",8,5,0,1255,1305],
      ["josh","Romosexual Tendencies",6,7,0,1316,1237],
      ["casey","These Guys Fuckin Blew It",4,8,1,1159,1226],
      ["brent","ISU Domination",4,9,0,1079,1329],
      ["brandonJ","Team Mgroin",6,7,0,1127,1165]
    ]},
    { year: 2010, rows: [
      ["andyPage","Pants Partiers",9,4,0,1154,1076],
      ["shane","Swagville Ragerz Omega",7,5,1,1072,1085],
      ["casey","These Guys Fuckin Blew It",10,3,0,1232,1050],
      ["josh","The Cutler I Shoulda Drafted",7,5,1,1244,1208],
      ["dylan","Dave the barb-Arian",7,6,0,1252,1112],
      ["brent","Team Rodge Podge",6,7,0,1058,1169],
      ["brandonJ","Team Megatron",5,8,0,1020,1074],
      ["timofey","t1mmy w1nt3r5",3,10,0,915,1193],
      ["soy","Soys Souljas",5,8,0,1194,1175],
      ["dahlin","Excuse Me",5,8,0,1170,1169]
    ]},
    { year: 2011, rows: [
      ["soy","Forgetting BrandonMarshall",8,5,0,1243,1193],
      ["casey","Bye Bye Madieu Ya Hee-haw",7,6,0,1217,1073],
      ["shane","Rootin Tootin Cam Newton",8,5,0,1264,1179],
      ["andyPage","She Gives Woodhead",7,5,1,1106,1101],
      ["brandonJ","Team Rook Rook",7,6,0,1192,1165],
      ["josh","Jamaal Charles Was In Charge",6,7,0,1118,1272],
      ["brent","Mr. Rodgers' Neighborhood",5,8,0,1167,1237],
      ["dylan","Flint Michigan Mega Bowe",7,6,0,1156,1128],
      ["timofey","t1mmy w1nt3r5",6,7,0,1111,1163],
      ["dahlin","Excuse Me",3,9,1,1118,1181]
    ]},
    { year: 2012, rows: [
      ["soy","Reaching for a Romo",11,2,0,1361,1126],
      ["josh","Dat Vick Cray",8,5,0,1277,1140],
      ["brent","Tom Brady's Bunch",8,4,1,1185,1166],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",8,5,0,1182,1100],
      ["casey","Get The Deal Done",6,6,1,1156,1155],
      ["dahlin","Lyndale Snufflepuffers",7,6,0,1235,1184],
      ["shane","The Blair Walsh Project",2,11,0,994,1236],
      ["andyPage","Want to Kiss My Lucky Egg?",7,6,0,1210,1169],
      ["dylan","Quick out the Gates",4,9,0,998,1247],
      ["brandonJ","Team Sooo Cheap",3,10,0,1183,1258]
    ]},
    { year: 2013, rows: [
      ["brent","The Lacy Show",9,4,0,1264,1141],
      ["dylan","Chalupa Batman",10,3,0,1278,1097],
      ["soy","RGIII -peat",7,6,0,1180,1180],
      ["brandonJ","Johnson and Johnson",6,6,1,1193,1263],
      ["casey","Jump On The Grenade",6,7,0,1265,1143],
      ["shane","Orange Julius Thomas",6,7,0,1139,1164],
      ["dahlin","Lyndale Snufflepuffers",6,6,1,1141,1174],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",4,9,0,1100,1306],
      ["andyPage","Want to Kiss My Lucky Egg?",4,8,1,1163,1291],
      ["josh","Deztination: PLAYOFFS",5,7,1,1217,1181]
    ]},
    { year: 2014, rows: [
      ["brandonJ","The Tard's Wrath",9,4,0,1334,1179],
      ["soy","Captain Philip",7,6,0,1118,1338],
      ["dylan","Bye Bye Bye Week",9,4,0,1186,1052],
      ["shane","Rodeo Clowney",9,3,1,1303,1154],
      ["dahlin","Stacys Mom Has Got It Goin On",6,6,1,1336,1171],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",5,8,0,1134,1197],
      ["josh","Beggin You For Dezy",6,6,1,1243,1187],
      ["brent","Puff Puff Pass the Drug Test",4,8,1,1120,1242],
      ["andyPage","Want to Kiss My Lucky Egg?",5,8,0,1139,1207],
      ["casey","This Week's A Brees",3,10,0,1020,1206]
    ]},
    { year: 2015, rows: [
      ["shane","Scobee Snacks",9,4,0,1134,1027],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",8,5,0,1307,1222],
      ["brandonJ","The Return of The King Crab",8,5,0,1344,1194],
      ["casey","Just Another Johnson Fest",7,6,0,1165,1189],
      ["dahlin","Bilbo's Bunch",5,8,0,1046,1221],
      ["andyPage","Want to Kiss My Lucky Egg?",6,7,0,1237,1148],
      ["soy","The Luck of the Tard",6,7,0,1190,1196],
      ["brent","Colonel Sanders",6,7,0,1219,1309],
      ["josh","JUH QUEEEE!!!",5,8,0,1204,1196],
      ["dylan","Bye Bye Bye Week",5,8,0,1043,1187]
    ]},
    { year: 2016, rows: [
      ["josh","Mc and Mick",8,4,1,1279,1076],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",10,3,0,1231,1109],
      ["shane","Doug BaldWINNING",9,4,0,1257,1172],
      ["soy","Turd Gurley",7,6,0,1157,1212],
      ["dahlin","Bilbos Bunch",2,11,0,1058,1233],
      ["brent","Steal the Show",6,7,0,1218,1320],
      ["andyPage","The Big A.J. Green",6,6,1,1094,1109],
      ["casey","Pulled Pork Sandwich Makers",4,9,0,1054,1259],
      ["alexLam","Hurricane Dom Dom",6,7,0,1162,1129],
      ["brandonJ","The King Crab Strikes Back",6,7,0,1188,1079]
    ]},
    { year: 2017, rows: [
      ["josh","Game of Jones",9,4,0,1515.82,1266.42],
      ["brent","Saved by the Elliot",8,5,0,1426.14,1273.86],
      ["casey","You Wanna Ride The ZIPPER?",8,5,0,1365.94,1391.34],
      ["brandonJ","A Murder Of Crowells",7,6,0,1294.94,1310.34],
      ["dahlin","Bilbos Bunch",4,9,0,1276.06,1339.76],
      ["andyPage","Fournetflix And Chill",6,7,0,1267.34,1361.34],
      ["shane","Tom Bra-Deez Nuts",4,9,0,1220.74,1355.66],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",7,6,0,1210.32,1222.14],
      ["alexLam","Hurricane Dom Dom",6,7,0,1343.46,1402.68],
      ["soy","I love to kiss TD's",6,7,0,1323.38,1320.6]
    ]},
    { year: 2018, rows: [
      ["casey","Diggs Ain't Shit",10,3,0,1615.34,1357.14],
      ["brent","Good Win Hunting",10,3,0,1649.7,1468.54],
      ["soy","Erryday Im Russellin",6,7,0,1613.86,1582.94],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",6,7,0,1583.3,1456.6],
      ["josh","Elementary, My Deshaun Watson",8,5,0,1503.74,1525.52],
      ["nick","New Guy",7,6,0,1411.26,1487.5],
      ["brandonJ","Return Of The Crab",6,7,0,1504.72,1600.6],
      ["alexLam","Hurricane Dom Dom",5,8,0,1389.52,1428.62],
      ["dahlin","Bilbos Bunch",3,10,0,1312.98,1506.8],
      ["andyPage","Golden Taints",4,9,0,1349.62,1519.78]
    ]},
    { year: 2019, rows: [
      ["soy","Jackson Jacksoff",7,6,0,1810.24,1731.06],
      ["brent","Krooked Komish",10,3,0,1580.2,1429.9],
      ["alexLam","backdoor bandit bb",11,2,0,1743.88,1407.54],
      ["brandonJ","Antonio Empire",8,5,0,1732.86,1668.92],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",5,8,0,1558.32,1588.0],
      ["buser","Material Finding",6,7,0,1424.18,1559.34],
      ["josh","It's DevonTA Not DavanTE",4,9,0,1475.84,1775.44],
      ["dahlin","Bilbos Bunch",5,8,0,1555.44,1445.98],
      ["casey","OH WITTLE KYLER",5,8,0,1438.82,1477.82],
      ["nick","New Guy",4,9,0,1390.2,1625.98]
    ]},
    { year: 2020, rows: [
      ["dahlin","Bilbos Bunch",7,6,0,1554.74,1624.66],
      ["buser","Draft Dodger",8,5,0,1758.28,1491.62],
      ["casey","Crumpled 4 Christ",5,8,0,1717.28,1658.86],
      ["alexLam","backdoor bandit bb",12,1,0,1647.42,1464.14],
      ["brent","Krooked Komish",7,6,0,1706.9,1632.18],
      ["josh","Powered By Watson",8,5,0,1626.4,1401.06],
      ["brandonJ","Zeke and Destroy",6,7,0,1575.18,1712.94],
      ["soy","Jackson Jacksoff Again",5,8,0,1424.0,1536.58],
      ["nick","New Guy",6,7,0,1533.72,1537.58],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",1,12,0,1288.88,1773.18]
    ]},
    { year: 2021, rows: [
      ["brent","Krooked Komish",10,4,0,1885.68,1652.44],
      ["alexLam","I h8 Stefanski :(",8,6,0,1748.32,1711.14],
      ["soy","God Got Us",8,6,0,1712.94,1660.28],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",5,9,0,1725.46,1889.68],
      ["casey","Crumpled 4 Christ",7,7,0,1710.56,1648.58],
      ["brandonJ","Zeke and Destroy",8,6,0,1724.26,1658.48],
      ["buser","Dog Shit",5,9,0,1662.58,1713.3],
      ["nick","The Bad Luck King",7,7,0,1638.06,1620.2],
      ["dahlin","Bilbos Bunch",5,9,0,1625.3,1788.98],
      ["josh","Wittle Wittle Kyler",7,7,0,1540.34,1630.42]
    ]},
    { year: 2022, rows: [
      ["casey","Crumpled 4 Christ",6,8,0,1788.02,1690.42],
      ["buser","They Took Our Jerbs",11,3,0,1768.12,1556.84],
      ["nick","Najee Stinks like Poo",8,6,0,1645.56,1688.08],
      ["brandonJ","Beep Boop WAAAAAAAAAAAAAAW",9,5,0,1683.72,1636.92],
      ["josh","Dangerous Nights Crew",8,6,0,1746.04,1588.76],
      ["alexLam","Najee Harris :(",8,6,0,1809.16,1724.04],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",6,8,0,1589.5,1816.58],
      ["brent","Krooked Kommish",7,7,0,1710.96,1674.0],
      ["soy","Gimme Dak! I'm Joking",5,9,0,1591.4,1627.26],
      ["dahlin","Bilbos Bunch",2,12,0,1499.34,1828.92]
    ]},
    { year: 2023, rows: [
      ["alexBoone","Christian Mingle",10,4,0,1909.5,1573.12],
      ["nick","I Miss My Najee",8,6,0,1711.8,1762.86],
      ["casey","Crumpled 4 Christ",8,6,0,1697.84,1646.84],
      ["josh","Dangerous Nights Crew",8,6,0,1706.46,1610.16],
      ["buser","Ain't He Purdy",6,8,0,1783.72,1804.78],
      ["brandonJ","To Infinity and Bijan",8,6,0,1653.5,1710.2],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",5,9,0,1614.4,1787.5],
      ["soy","Tua Deez Nuts",6,8,0,1637.92,1646.18],
      ["alexLam","The Cripples of MOA",5,9,0,1640.72,1860.42],
      ["brent","Krooked Kommish",6,8,0,1681.22,1635.02]
    ]},
    { year: 2024, rows: [
      ["brandonJ","Mighty Ducks",8,6,0,2041.88,1806.38],
      ["soy","Picken Chooser",10,4,0,1977.9,1711.56],
      ["alexBoone","2-QB Scheme",9,5,0,1975.82,1953.18],
      ["casey","Crumpled 4 Christ",10,4,0,2064.5,1920.18],
      ["alexLam","Lil drummer boy",6,8,0,1918.86,1789.44],
      ["josh","Dangerous Nights Crew",9,5,0,1835.32,1735.66],
      ["nick","Say it Aint Sooo",3,11,0,1839.16,2155.3],
      ["brent","Krooked Kommish",4,10,0,1581.24,1869.86],
      ["buser","1-800-IR",6,8,0,1820.54,1865.06],
      ["timofey","CA-YAYAYAYAYA MMMMM NEWTON",5,9,0,1756.86,2005.46]
    ]},
    { year: 2025, rows: [
      ["casey","Crumpled 4 Christ",6,8,0,1866.2,1931.34],
      ["jake","Colston LovelsLand",11,3,0,1965.26,1841.8],
      ["nick","Say it Aint Sooo",8,6,0,1857.34,1810.6],
      ["brent","Krooked Kommish",10,4,0,2034.08,1673.58],
      ["alexLam","The Pohlads",7,7,0,1807.28,1835.72],
      ["brandonJ","Mighty Ducks",9,5,0,1848.96,1792.48],
      ["buser","Bunch of Cucks",5,9,0,1823.18,1838.4],
      ["alexBoone","Pass me the mic",3,11,0,1678.48,1942.7],
      ["josh","Dangerous Nights Crew",5,9,0,1742.0,1895.48],
      ["soy","Fragile P*cks",6,8,0,1799.34,1860.02]
    ]}
  ];

  // ---- Name lookup ------------------------------------------------
  const NAME = {};
  MEMBERS.forEach(m => NAME[m.id] = m.name);
  GRAVEYARD.forEach(m => NAME[m.id] = m.name);

  // ---- Champions & runners-up ------------------------------------
  const CHAMPIONS = SEASONS.map(s => {
    const champ = s.rows[0], ru = s.rows[1];
    return {
      year: s.year,
      champYear: s.year + 1,
      champId: champ[0], champTeam: champ[1], champRec: rec(champ),
      champCo: champ[7] || null,
      ruId: ru[0], ruTeam: ru[1]
    };
  });

  function rec(r){ return r[2] + "-" + r[3] + (r[4] ? "-" + r[4] : "-0"); }

  // ---- Eras -------------------------------------------------------
  // The league's history is told in three eras. World Championship Era
  // titles came from an 8-team field and are weighted separately.
  const ERAS = [
    { id:"wc", name:"World Championship Era", short:"WC Era", range:"2008 – 2009", start:2008, end:2009, teams:8, draft:"8-team field", accent:"#c9a24a",
      blurb:"The 8-team dawn of the league. A smaller field — these crowns carry an asterisk and don't weigh the same as a 10-team title." },
    { id:"og", name:"OG Era", short:"OG Era", range:"2010 – 2019", start:2010, end:2019, teams:10, draft:"snake draft", accent:"#e8ddc3",
      blurb:"Expansion to 10 teams and the snake-draft decade — the league's classic form." },
    { id:"modern", name:"Modern Era", short:"Modern Era", range:"2020 – Present", start:2020, end:9999, teams:10, draft:"auction draft", accent:"#f2c94c",
      blurb:"The auction era — the league as it stands today." }
  ];
  function eraOf(year){ return ERAS.find(e => year >= e.start && year <= e.end) || ERAS[ERAS.length-1]; }
  CHAMPIONS.forEach(c => { const e = eraOf(c.year); c.eraId = e.id; c.eraName = e.name; c.eraShort = e.short; c.isWC = e.id === "wc"; });

  // ---- All-time aggregation --------------------------------------
  function blank(id){
    return { id, name: NAME[id] || id, w:0,l:0,t:0, pf:0, pa:0, seasons:0,
             titles:0, runnerUps:0, bestFinish:99, sumFinish:0, playoffs:0,
             bestSeasonRec:"", bestSeasonWinPct:-1, topSeasonPF:0, topSeasonPFyr:null };
  }
  const AGG = {};
  function get(id){ return AGG[id] || (AGG[id] = blank(id)); }

  SEASONS.forEach(s => {
    s.rows.forEach((r, i) => {
      const [id, team, w, l, t, pf, pa] = r;
      const a = get(id);
      a.w += w; a.l += l; a.t += t; a.pf += pf; a.pa += pa; a.seasons += 1;
      const finish = i + 1;
      a.sumFinish += finish;
      if (finish < a.bestFinish) a.bestFinish = finish;
      if (finish <= 6) a.playoffs += 1; // top-6 = playoff berth (approx; confirm)
      if (finish === 1) a.titles += 1;
      if (finish === 2) a.runnerUps += 1;
      const g = w + l + t, wp = g ? (w + t*0.5)/g : 0;
      if (wp > a.bestSeasonWinPct){ a.bestSeasonWinPct = wp; a.bestSeasonRec = rec(r) + " (" + s.year + ")"; }
      if (pf > a.topSeasonPF){ a.topSeasonPF = pf; a.topSeasonPFyr = s.year; }
    });
  });

  Object.values(AGG).forEach(a => {
    const g = a.w + a.l + a.t;
    a.games = g;
    a.winPct = g ? (a.w + a.t*0.5)/g : 0;
    a.pfg = g ? a.pf/g : 0;
    a.pag = g ? a.pa/g : 0;
    a.diff = a.pf - a.pa;
    a.avgFinish = a.seasons ? a.sumFinish / a.seasons : 0;
    if (a.bestFinish === 99) a.bestFinish = 0;
  });

  // ordered all-time table (current members first by win%, then others)
  const currentIds = MEMBERS.map(m => m.id);
  const allTime = Object.values(AGG).sort((x,y) => y.winPct - x.winPct);

  // ---- Franchise lineage (team takeovers) -------------------------
  // A franchise is a continuous team; when a manager leaves, the incoming
  // manager INHERITS the franchise. Ordered predecessor list per current owner.
  const FRANCHISE_LINEAGE = {
    casey:    ["casey"],
    soy:      ["soy"],
    brent:    ["brent"],
    josh:     ["josh"],
    brandonJ: ["brandonJ"],                 // formerly "Pat Mgroin" (same person)
    alexLam:  ["dylan", "alexLam"],
    nick:     ["shane", "nick"],
    buser:    ["lorren", "andyPage", "buser"],
    alexBoone:["dahlin", "alexBoone"],
    jake:     ["timofey", "jake"]
  };

  const OWNER_YEARS = {};
  SEASONS.forEach(s => s.rows.forEach(r => { (OWNER_YEARS[r[0]] = OWNER_YEARS[r[0]] || []).push(s.year); }));
  function yearSpan(id){
    const ys = OWNER_YEARS[id]; if(!ys || !ys.length) return "";
    const mn = Math.min(...ys) + 1, mx = Math.max(...ys) + 1;
    return mn === mx ? ("" + mn) : (mn + "–" + mx);
  }
  const recOf = id => { const a = AGG[id]; return a ? (a.w + "-" + a.l + (a.t ? "-" + a.t : "-0")) : "0-0"; };

  const FRANCHISES = Object.keys(FRANCHISE_LINEAGE).map(curId => {
    const lineage = FRANCHISE_LINEAGE[curId];
    const mem = MEMBERS.find(m => m.id === curId) || {};
    const f = { id: curId, name: NAME[curId], team: mem.team || "", handle: mem.handle || "",
                w:0, l:0, t:0, pf:0, pa:0, seasons:0, titles:0, runnerUps:0, sumFinish:0 };
    lineage.forEach(oid => {
      const a = AGG[oid]; if(!a) return;
      f.w += a.w; f.l += a.l; f.t += a.t; f.pf += a.pf; f.pa += a.pa;
      f.seasons += a.seasons; f.titles += a.titles; f.runnerUps += a.runnerUps; f.sumFinish += a.sumFinish;
    });
    const g = f.w + f.l + f.t;
    f.games = g;
    f.winPct = g ? (f.w + f.t*0.5)/g : 0;
    f.pfg = g ? f.pf/g : 0;
    f.pag = g ? f.pa/g : 0;
    f.avgFinish = f.seasons ? f.sumFinish/f.seasons : 0;
    const m = AGG[curId] || {w:0,l:0,t:0,seasons:0,winPct:0,titles:0};
    f.mgr = { w:m.w||0, l:m.l||0, t:m.t||0, seasons:m.seasons||0, winPct:m.winPct||0, titles:m.titles||0,
              record: recOf(curId), since: OWNER_YEARS[curId] ? Math.min(...OWNER_YEARS[curId]) + 1 : null };
    f.record = f.w + "-" + f.l + (f.t ? "-" + f.t : "-0");
    f.inherited = lineage.length > 1;
    f.lineage = lineage.map(oid => ({
      id: oid, name: NAME[oid], span: yearSpan(oid), isCurrent: oid === curId, record: recOf(oid)
    }));
    return f;
  }).sort((a,b) => b.winPct - a.winPct);

  // Records / leaderboards from season data (what standings can support).
  const seasonTeams = [];
  SEASONS.forEach(s => s.rows.forEach((r,i) => seasonTeams.push({
    year:s.year, id:r[0], name:NAME[r[0]], team:r[1], w:r[2], l:r[3], t:r[4],
    pf:r[5], pa:r[6==r.length?null:6]||r[6]!==undefined?r[6]:0, finish:i+1
  })));
  // fix pa
  const flatTeams = [];
  SEASONS.forEach(s => s.rows.forEach((r,i) => flatTeams.push({
    year:s.year, id:r[0], name:NAME[r[0]], team:r[1], w:r[2], l:r[3], t:r[4], pf:r[5], pa:r[6], finish:i+1,
    winPct: (r[2]+r[3]+r[4]) ? (r[2]+r[4]*0.5)/(r[2]+r[3]+r[4]) : 0
  })));

  const games = SEASONS.reduce((n,s)=>n + s.rows.reduce((m,r)=>m+r[2]+r[3]+r[4],0),0)/2;

  window.NOCSBS = {
    members: MEMBERS,
    graveyard: GRAVEYARD,
    seasons: SEASONS,
    champions: CHAMPIONS,
    eras: ERAS,
    eraOf,
    agg: AGG,
    allTime,
    franchises: FRANCHISES,
    lineage: FRANCHISE_LINEAGE,
    ownerYears: OWNER_YEARS,
    currentIds,
    name: NAME,
    flatTeams,
    meta: {
      founded: 2008,
      seasonsPlayed: SEASONS.length,
      totalGames: Math.round(games),
      latestChampion: CHAMPIONS[CHAMPIONS.length-1],
      leagueId: "303458",
      espnUrl: "https://fantasy.espn.com/football/league?leagueId=303458"
    }
  };
})();
