// Generado por tools/tune.js: bolas y objetivo de cada nivel, con la tasa de victorias medida (jugador casual simulado)
(function (root) {
  const T = {
 "Torre azul": {
  "nb": 3,
  "target": 0.8,
  "win": 100,
  "close": 0
 },
 "La muralla": {
  "nb": 8,
  "target": 0.7,
  "win": 100,
  "close": 0
 },
 "El puente": {
  "nb": 6,
  "target": 0.75,
  "win": 100,
  "close": 0
 },
 "El castillo": {
  "nb": 7,
  "target": 0.78,
  "win": 50,
  "close": 38
 },
 "Dinamita": {
  "nb": 5,
  "target": 0.91,
  "win": 56,
  "close": 38
 },
 "Puentes colgantes": {
  "nb": 9,
  "target": 0.65,
  "win": 88,
  "close": 13
 },
 "Torre del reloj": {
  "nb": 4,
  "target": 0.92,
  "win": 88,
  "close": 13
 },
 "Escalinata": {
  "nb": 9,
  "target": 0.91,
  "win": 75,
  "close": 19
 },
 "Cubitos": {
  "nb": 4,
  "target": 0.87,
  "win": 81,
  "close": 0
 },
 "Témpanos": {
  "nb": 5,
  "target": 0.7,
  "win": 75,
  "close": 13
 },
 "Fortín helado": {
  "nb": 10,
  "target": 0.68,
  "win": 88,
  "close": 13
 },
 "Carámbanos": {
  "nb": 8,
  "target": 0.78,
  "win": 75,
  "close": 19
 },
 "Contenedores": {
  "nb": 8,
  "target": 0.79,
  "win": 75,
  "close": 13
 },
 "Barco": {
  "nb": 8,
  "target": 0.96,
  "win": 81,
  "close": 19
 },
 "Lonja": {
  "nb": 10,
  "target": 0.9,
  "win": 75,
  "close": 13
 },
 "Torres gemelas": {
  "nb": 4,
  "target": 0.8,
  "win": 38,
  "close": 31
 },
 "Cofre del tesoro": {
  "nb": 6,
  "target": 0.9,
  "win": 94,
  "three": 25
 },
 "Mina de oro": {
  "nb": 4,
  "target": 0.92,
  "win": 81,
  "three": 25
 },
 "Cámara real": {
  "nb": 8,
  "target": 0.74,
  "win": 75,
  "three": 25
 },
 "Bicolor": {
  "nb": 7,
  "target": 0.8,
  "win": 100,
  "close": 0
 },
 "La pirámide": {
  "nb": 6,
  "target": 0.91,
  "win": 56,
  "close": 38
 },
 "Piedra": {
  "nb": 7,
  "target": 0.77,
  "win": 56,
  "close": 25
 },
 "Rayas": {
  "nb": 6,
  "target": 0.8,
  "win": 94,
  "close": 6
 },
 "Fortaleza de cristal": {
  "nb": 9,
  "target": 0.9,
  "win": 88,
  "close": 13
 },
 "Caramelo bomba": {
  "nb": 3,
  "target": 0.91,
  "win": 63,
  "close": 25
 },
 "Tiovivo": {
  "nb": 9,
  "target": 0.79,
  "win": 63,
  "close": 25
 },
 "Doble muralla": {
  "nb": 9,
  "target": 0.7,
  "win": 69,
  "close": 19
 },
 "Palacio real": {
  "nb": 3,
  "target": 0.94,
  "win": 75,
  "close": 19
 },
 "Iglú": {
  "nb": 5,
  "target": 0.95,
  "win": 56,
  "close": 38
 },
 "Pista de hielo": {
  "nb": 6,
  "target": 0.91,
  "win": 38,
  "close": 38
 },
 "Nevera": {
  "nb": 7,
  "target": 0.86,
  "win": 69,
  "close": 19
 },
 "Muñecos de nieve": {
  "nb": 8,
  "target": 0.7,
  "win": 63,
  "close": 38
 },
 "Castillo de hielo": {
  "nb": 7,
  "target": 0.89,
  "win": 56,
  "close": 31
 },
 "Muelle": {
  "nb": 8,
  "target": 0.86,
  "win": 69,
  "close": 19
 },
 "Grúa": {
  "nb": 4,
  "target": 0.82,
  "win": 69,
  "close": 19
 },
 "Almacenes": {
  "nb": 3,
  "target": 0.74,
  "win": 69,
  "close": 25
 },
 "Rompeolas": {
  "nb": 10,
  "target": 0.91,
  "win": 31,
  "close": 50
 },
 "Fortaleza del puerto": {
  "nb": 7,
  "target": 0.95,
  "win": 50,
  "close": 38
 },
 "Salón del trono": {
  "nb": 8,
  "target": 0.9,
  "win": 63,
  "close": 19
 },
 "Laberinto": {
  "nb": 10,
  "target": 0.74,
  "win": 81,
  "close": 19
 },
 "Jardín": {
  "nb": 10,
  "target": 0.76,
  "win": 75,
  "close": 19
 },
 "Gran palacio": {
  "nb": 3,
  "target": 0.92,
  "win": 63,
  "close": 31
 },
 "Piñata": {
  "nb": 10,
  "target": 0.78,
  "win": 94,
  "three": 31
 },
 "Tesoro pirata": {
  "nb": 6,
  "target": 0.85,
  "win": 75,
  "three": 25
 },
 "Morado": {
  "nb": 6,
  "target": 0.83,
  "win": 81,
  "close": 13
 },
 "Zigurat": {
  "nb": 6,
  "target": 0.91,
  "win": 88,
  "close": 13
 },
 "Faro": {
  "nb": 7,
  "target": 0.95,
  "win": 75,
  "close": 25
 },
 "Vidriera": {
  "nb": 3,
  "target": 0.91,
  "win": 81,
  "close": 13
 },
 "Columnata": {
  "nb": 10,
  "target": 0.55,
  "win": 81,
  "close": 19
 },
 "Fuegos artificiales": {
  "nb": 6,
  "target": 0.84,
  "win": 63,
  "close": 38
 },
 "Cúpula": {
  "nb": 5,
  "target": 0.93,
  "win": 75,
  "close": 6
 },
 "Cubo mágico": {
  "nb": 10,
  "target": 0.9,
  "win": 31,
  "close": 63
 },
 "Glaciar": {
  "nb": 9,
  "target": 0.7,
  "win": 75,
  "close": 13
 },
 "Barriles": {
  "nb": 7,
  "target": 0.87,
  "win": 94,
  "close": 6
 },
 "Escalera real": {
  "nb": 8,
  "target": 0.78,
  "win": 63,
  "close": 19
 },
 "Castillo de arena": {
  "nb": 5,
  "target": 0.91,
  "win": 94,
  "close": 6
 },
 "Oasis": {
  "nb": 10,
  "target": 0.79,
  "win": 94,
  "close": 6
 },
 "Pirámide de arena": {
  "nb": 6,
  "target": 0.87,
  "win": 63,
  "close": 31
 },
 "Caravana": {
  "nb": 5,
  "target": 0.75,
  "win": 88,
  "close": 13
 },
 "Esfinge": {
  "nb": 6,
  "target": 0.85,
  "win": 62,
  "close": 0
 },
 "Dunas": {
  "nb": 7,
  "target": 0.75,
  "win": 94,
  "close": 6
 },
 "Templo del sol": {
  "nb": 6,
  "target": 0.91,
  "win": 25,
  "close": 0
 },
 "Ruinas": {
  "nb": 6,
  "target": 0.91,
  "win": 94,
  "close": 6
 },
 "Obelisco": {
  "nb": 4,
  "target": 0.91,
  "win": 56,
  "close": 38
 },
 "Gran pirámide": {
  "nb": 7,
  "target": 0.83,
  "win": 69,
  "close": 25
 },
 "Muñeco de nieve": {
  "nb": 6,
  "target": 0.91,
  "win": 69,
  "close": 31
 },
 "Trineo": {
  "nb": 7,
  "target": 0.87,
  "win": 94,
  "close": 6
 },
 "Cueva de hielo": {
  "nb": 6,
  "target": 0.83,
  "win": 69,
  "close": 31
 },
 "Avalancha": {
  "nb": 8,
  "target": 0.93,
  "win": 38,
  "close": 0
 },
 "Pingüinos": {
  "nb": 7,
  "target": 0.75,
  "win": 88,
  "close": 13
 },
 "Telesilla": {
  "nb": 3,
  "target": 0.93,
  "win": 62,
  "close": 0
 },
 "Fortaleza helada": {
  "nb": 11,
  "target": 0.7,
  "win": 63,
  "close": 13
 },
 "Cumbre nevada": {
  "nb": 6,
  "target": 0.75,
  "win": 75,
  "close": 25
 },
 "Camaleón": {
  "nb": 3,
  "target": 0.91,
  "win": 100,
  "close": 0
 },
 "Raíces": {
  "nb": 6,
  "target": 0.91,
  "win": 63,
  "close": 38
 },
 "Ídolo": {
  "nb": 5,
  "target": 0.87,
  "win": 94,
  "close": 6
 },
 "Puente de lianas": {
  "nb": 6,
  "target": 0.79,
  "win": 69,
  "close": 13
 },
 "Escalera maya": {
  "nb": 6,
  "target": 0.87,
  "win": 94,
  "close": 6
 },
 "Selva espesa": {
  "nb": 5,
  "target": 0.91,
  "win": 69,
  "close": 13
 },
 "Cascada": {
  "nb": 5,
  "target": 0.75,
  "win": 94,
  "close": 6
 },
 "Templo perdido": {
  "nb": 8,
  "target": 0.87,
  "win": 38,
  "close": 38
 },
 "Nido": {
  "nb": 8,
  "target": 0.75,
  "win": 75,
  "close": 13
 },
 "Corazón de la selva": {
  "nb": 3,
  "target": 0.93,
  "win": 62,
  "close": 0
 },
 "Roca ardiente": {
  "nb": 5,
  "target": 0.75,
  "win": 88,
  "close": 6
 },
 "Chimenea": {
  "nb": 6,
  "target": 0.91,
  "win": 63,
  "close": 31
 },
 "Coladas": {
  "nb": 5,
  "target": 0.79,
  "win": 94,
  "close": 6
 },
 "Forja": {
  "nb": 6,
  "target": 0.83,
  "win": 69,
  "close": 31
 },
 "Obsidiana": {
  "nb": 5,
  "target": 0.83,
  "win": 88,
  "close": 13
 },
 "Cráter": {
  "nb": 10,
  "target": 0.68,
  "win": 44,
  "close": 19
 },
 "Géiser": {
  "nb": 3,
  "target": 0.91,
  "win": 100,
  "close": 0
 },
 "Fragua": {
  "nb": 7,
  "target": 0.91,
  "win": 69,
  "close": 31
 },
 "Ceniza": {
  "nb": 6,
  "target": 0.79,
  "win": 81,
  "close": 19
 },
 "Corazón del volcán": {
  "nb": 7,
  "target": 0.79,
  "win": 56,
  "close": 31
 },
 "Gravedad cero": {
  "nb": 5,
  "target": 0.87,
  "win": 88,
  "close": 13
 },
 "Satélite": {
  "nb": 9,
  "target": 0.7,
  "win": 63,
  "close": 0
 },
 "Cohete": {
  "nb": 5,
  "target": 0.83,
  "win": 94,
  "close": 6
 },
 "Estación espacial": {
  "nb": 8,
  "target": 0.79,
  "win": 63,
  "close": 38
 },
 "Anillos": {
  "nb": 5,
  "target": 0.75,
  "win": 94,
  "close": 6
 },
 "Asteroides": {
  "nb": 10,
  "target": 0.7,
  "win": 63,
  "close": 25
 },
 "Cráter lunar": {
  "nb": 8,
  "target": 0.75,
  "win": 94,
  "close": 0
 },
 "Nebulosa": {
  "nb": 5,
  "target": 0.75,
  "win": 88,
  "close": 13
 },
 "Agujero negro": {
  "nb": 11,
  "target": 0.6,
  "win": 38,
  "close": 19
 },
 "Galaxia final": {
  "nb": 8,
  "target": 0.95,
  "win": 69,
  "close": 0
 },
 "Tumba del faraón": {
  "nb": 4,
  "target": 0.93,
  "win": 75,
  "close": 0
 },
 "Cueva de cristal": {
  "nb": 4,
  "target": 0.95,
  "win": 100,
  "close": 0
 },
 "Ídolo de oro": {
  "nb": 4,
  "target": 0.9,
  "win": 81,
  "close": 19
 },
 "Forja del dragón": {
  "nb": 4,
  "target": 0.9,
  "win": 88,
  "close": 13
 },
 "Tesoro galáctico": {
  "nb": 8,
  "target": 0.7,
  "win": 81,
  "close": 13
 },
 "Casa de hielo": {
  "nb": 5,
  "target": 0.75,
  "win": 88,
  "close": 0
 },
 "Estalactitas": {
  "nb": 6,
  "target": 0.75,
  "win": 88,
  "close": 13
 }
};
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else root.LevelTuning = T;
})(typeof globalThis !== 'undefined' ? globalThis : this);
