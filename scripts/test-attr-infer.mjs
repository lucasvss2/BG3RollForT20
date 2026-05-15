const TAB = 'D873ACF83001B57342D2A0FACDBFD42A';
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/' + TAB);
let id = 1;
function send(method, params) {
    return new Promise(resolve => {
        const msgId = id++;
        ws.addEventListener('message', function h(ev) {
            const d = JSON.parse(ev.data);
            if (d.id === msgId) { ws.removeEventListener('message', h); resolve(d.result); }
        });
        ws.send(JSON.stringify({ id: msgId, method, params: params || {} }));
    });
}

const ATTR_LABELS = { for: 'Força', des: 'Destreza', con: 'Constituição', int: 'Inteligência', sab: 'Sabedoria', car: 'Carisma' };

ws.addEventListener('open', async () => {
    const r = await send('Runtime.evaluate', {
        expression: `(function(){
            const ATTR_LABELS = ${JSON.stringify(ATTR_LABELS)};

            function inferAttrLabel(msg, card) {
                if (card.dataset.itemId) return '';
                const roll = msg.rolls?.[0];
                if (!roll) return '';
                let foundDie = false, attrBonus = null;
                for (const term of roll.terms ?? []) {
                    if (term.constructor?.name === 'Die') { foundDie = true; continue; }
                    if (foundDie && term.constructor?.name === 'NumericTerm' && term.number !== undefined) {
                        attrBonus = term.number; break;
                    }
                }
                if (attrBonus === null) return '';
                const actorId = msg.speaker?.actor;
                if (!actorId) return '';
                const actor = game.actors?.get(actorId);
                const atributos = actor?.system?.atributos;
                if (!atributos) return '';
                const matches = Object.entries(atributos).filter(([k, v]) => v.value === attrBonus && k in ATTR_LABELS);
                if (matches.length === 1) return ATTR_LABELS[matches[0][0]] ?? '';
                if (matches.length > 1) return 'Teste de Atributo';
                return '';
            }

            // Reset names set by previous manual fix, then re-infer
            const cards = [...document.querySelectorAll('.tormenta20.chat-card.item-card')].filter(c => {
                const name = c.querySelector('.item-name div')?.textContent?.trim();
                return !name || name === 'Ataque';
            });

            const results = [];
            let fixed = 0;
            for (const card of cards) {
                const li = card.closest('[data-message-id]');
                const msg = game.messages?.get(li?.dataset?.messageId);
                if (!msg) continue;
                const label = inferAttrLabel(msg, card);
                const nameDiv = card.querySelector('.item-name div');
                results.push({ was: nameDiv?.textContent, inferred: label, itemId: card.dataset.itemId });
                if (label && nameDiv) { nameDiv.textContent = label; fixed++; }
            }
            return JSON.stringify({ fixed, sample: results.slice(0, 5) });
        })()`,
        returnByValue: true
    });
    console.log(r?.result?.value);
    ws.close();
});
