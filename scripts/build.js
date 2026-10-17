// Copie les fichiers du jeu dans dist/ (dossier web embarqué dans l'APK par Capacitor).
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
['index.html', 'css', 'js'].forEach(function (item) {
  fs.cpSync(path.join(root, item), path.join(dist, item), { recursive: true });
});
console.log('dist/ prêt');
