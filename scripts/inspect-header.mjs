const TAB = '4438ACAC6AFFEB9B66D477FDB510CC22';
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/' + TAB);
let id = 1;
function send(method, params = {}) {
    return new Promise(resolve => {
        const msgId = id++;
        ws.addEventListener('message', function handler(ev) {
            const data = JSON.parse(ev.data);
            if (data.id === msgId) { ws.removeEventListener('message', handler); resolve(data.result); }
        });
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });
}
ws.addEventListener('open', async () => {
    const code = `(function() {
    const dlg = Object.values(ui.windows || {}).find(a => a.constructor?.name === 'AbilityUseDialog');
    if (!dlg) return 'no dialog';
    const el = dlg.element?.[0] || dlg._element?.[0] || document.getElementById('app-' + dlg.appId);
    const header = el?.querySelector('.aprimoramentos-list .items-header');
    if (!header) return 'no header';
    const cs = getComputedStyle(header);
    return JSON.stringify({
        border: cs.border,
        borderTop: cs.borderTop,
        borderBottom: cs.borderBottom,
        borderLeft: cs.borderLeft,
        borderRight: cs.borderRight,
        background: cs.background,
        outline: cs.outline,
        boxShadow: cs.boxShadow,
        padding: cs.padding,
        margin: cs.margin,
        display: cs.display,
        classList: Array.from(header.classList),
    }, null, 2);
})()`;
    const r = await send('Runtime.evaluate', { expression: code });
    console.log(r?.result?.value);
    ws.close();
});
