"""Captions from the voice timing (vo/timeline.json -> cues.js + cues.json).

Each spoken line is split into caption chunks; a chunk gets a share of the line's time proportional to the length of
what is said in it, so the words pop in step with the voice. Markers: *yellow (numbers, key nouns), ~blue (tech words),
!red (danger words). Re-run after every change to the voice, then re-render the video.
"""
import json

T, SPEAK = 30.0, 0.92            # SPEAK: the words of a chunk finish popping at 92% of its spoken time
CHUNKS = {                       # (caption text, exactly what the voice says)
    'l1': [("GERMANY’S ARMY JUST", "Germany's army just"), ("!GROUNDED ITS *RECON *DRONES", "grounded its recon drones.")],
    'l2': [("BECAUSE OF *ONE ~UPDATE.", "Because of one update.")],
    'l3': [("HACKERS BROKE INTO", "Hackers broke into"), ("~QUANTUM ~SYSTEMS,", "Quantum Systems,"),
           ("A *€7 *BILLION DRONE MAKER,", "a seven billion euro drone maker,"), ("AND HID !MALWARE", "and hid malware"),
           ("IN A ROUTINE ~SOFTWARE ~UPDATE", "in a routine software update.")],
    'l4': [("THE FAKE UPDATE REACHED", "The fake update reached"), ("*ARMY *SERVERS.", "army servers."),
           ("NOT THE DRONES.", "Not the drones.")],
    'l5': [("THE ARMY GROUNDED THEM ANYWAY.", "The army grounded them anyway."), ("THEY EVEN SAT OUT", "They even sat out"),
           ("A *MILITARY *EXERCISE.", "a military exercise.")],
    'l6': [("THEY’RE ~FLYING ~AGAIN NOW.", "They're flying again now."), ("BUT *ONE !POISONED UPDATE", "But one poisoned update"),
           ("CAN REACH *EVERY *CUSTOMER", "can reach every customer"), ("AT ONCE.", "at once.")],
    'l7': [("SO THE NEXT TIME", "So the next time"), ("AN ~UPDATE POPS UP", "an update pops up"),
           ("ON YOUR PHONE, REMEMBER—", "on your phone, remember.")],
}

cues = []
for ln in json.load(open('vo/timeline.json')):
    parts = CHUNKS[ln['id']]
    said = ' '.join(s for _, s in parts)
    assert said == ln['text'], f"{ln['id']}: chunks say {said!r} but the voice says {ln['text']!r}"
    w = [len(s) + 1 for _, s in parts]
    acc = 0
    for (cap, _), wi in zip(parts, w):
        cues.append([ln['start'] + ln['dur'] * acc / sum(w), None, cap, SPEAK * ln['dur'] * wi / sum(w)])
        acc += wi
cues[0][0] = 0.0                 # the first word is on screen at frame 0 (thumbnail + loop target)
for j, c in enumerate(cues):
    c[1] = cues[j + 1][0] if j + 1 < len(cues) else T
cues = [[round(a, 2), round(b, 2), txt, round(s, 2)] for a, b, txt, s in cues]
json.dump(cues, open('cues.json', 'w'), ensure_ascii=False)
open('cues.js', 'w').write('window.CUES = ' + json.dumps(cues, ensure_ascii=False) + ';\n')
print(f'{len(cues)} cues -> cues.js')
