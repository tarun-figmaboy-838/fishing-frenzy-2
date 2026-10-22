# Builds dev/qa/debug.html + dev/qa/debug-engine.js: the game with a window.__g hook to its instance (QA only, never ship).
import os
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
eng = open(os.path.join(root, 'js', 'game-engine.js')).read()
eng = eng.replace('    this.state = this.fresh(false);', '    this.state = this.fresh(false); window.__g = this;', 1)
open(os.path.join(root, 'dev', 'qa', 'debug-engine.js'), 'w').write(eng)
html = open(os.path.join(root, 'index.html')).read()
html = html.replace('src="js/game-engine.js"', 'src="dev/qa/debug-engine.js"')
html = html.replace('<head>', '<head>\n<base href="../../">', 1)
open(os.path.join(root, 'dev', 'qa', 'debug.html'), 'w').write(html)
print('wrote dev/qa/debug.html')
