import re
with open('src/features/admin/pages/AdminMaterialesPage.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'(<section className=\"infra-card\">\s*<div className=\"infra-section-head\">\s*<div>\s*<h3>Materiales y reactivos</h3>.*?)(<section className=\"infra-card infra-materials-catalog\">)', text, flags=re.DOTALL)
if match:
    block = match.group(1)
    hist_match = re.search(r'(<div className=\"infra-stock-panel\">\s*<div className=\"infra-section-head\">\s*<div>\s*<h3>Historial reciente</h3>.*?)</section>\s*</section>', block, flags=re.DOTALL)
    if hist_match:
        hblock = hist_match.group(1).replace('infra-stock-panel', 'infra-stock-panel infra-card-full').strip()
        new_text = text[:match.start()] + match.group(2) + text[match.end():]
        rep_idx = new_text.find(\") : activeTab === 'reports' ? (\")
        movements = f\"      ) : activeTab === 'movements' ? (\n        <section className=\\\"infra-card infra-card-full\\\">\n          {hblock}\n        </section>\n\"
        final_text = new_text[:rep_idx] + movements + new_text[rep_idx:]
        with open('src/features/admin/pages/AdminMaterialesPage.jsx', 'w', encoding='utf-8') as f:
            f.write(final_text)
        print('EXITO')
