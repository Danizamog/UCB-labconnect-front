const fs = require('fs');
let s = fs.readFileSync('src/features/admin/pages/AdminMaterialesPage.jsx', 'utf-8');
let sIdx = s.lastIndexOf('<section className=\"infra-card\">', s.indexOf('<h3>Materiales y reactivos</h3>'));
let eIdx = s.indexOf('<section className=\"infra-card infra-materials-catalog\">');
let repIdx = s.indexOf(') : activeTab === \'reports\' ? (');

let block = s.slice(sIdx, eIdx);
let hBlock = block.slice(block.lastIndexOf('<div className=\"infra-stock-panel\">', block.indexOf('<h3>Historial reciente</h3>')), block.lastIndexOf('</section>'));

hBlock = hBlock.replace('infra-stock-panel', 'infra-stock-panel infra-card-full').trim();
let mov = '      ) : activeTab === \'movements\' ? (\\n        <section className=\"infra-card infra-card-full\">\\n          ' + hBlock + '\\n        </section>\\n';

fs.writeFileSync('src/features/admin/pages/AdminMaterialesPage.jsx', s.slice(0, sIdx) + s.slice(eIdx, repIdx) + mov + s.slice(repIdx), 'utf-8');
console.log('Done!');

