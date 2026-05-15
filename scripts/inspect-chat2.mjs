import { WebSocket } from 'ws';

const TAB = '4438ACAC6AFFEB9B66D477FDB510CC22';
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/' + TAB);
let id = 1;
function send(method, params = {}) {
    return new Promise(resolve => {
        const msgId = id++;
        ws.on('message', function h(data) {
            const d = JSON.parse(data);
            if (d.id === msgId) { ws.off('message', h); resolve(d.result); }
        });
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });
}
ws.on('open', async () => {
    const r = await send('Runtime.evaluate', { expression: `
        (function() {
            const msg = document.querySelector('#chat-log .message');
            if (!msg) return 'NO MESSAGE FOUND';
            return msg.outerHTML.slice(0, 4000);
        })()
    `, returnByValue: true });
    console.log(r?.result?.value);
    ws.close();
});
ws.on('error', e => console.error('WS ERROR:', e.message));
