const TAB = '4438ACAC6AFFEB9B66D477FDB510CC22';
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/' + TAB);
let id = 1;
function send(method, params = {}) {
    return new Promise(resolve => {
        const msgId = id++;
        ws.addEventListener('message', function h(ev) {
            const d = JSON.parse(ev.data);
            if (d.id === msgId) { ws.removeEventListener('message', h); resolve(d.result); }
        });
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });
}
ws.addEventListener('open', async () => {
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
