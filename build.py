# Inlines data.js into src.html -> index.html (single-file game).
import pathlib
d=pathlib.Path(__file__).parent
src=(d/'src.html').read_text(encoding='utf-8'); data=(d/'data.js').read_text(encoding='utf-8')
(d/'index.html').write_text(src.replace('/*DATA*/',data),encoding='utf-8')
print('built index.html')
