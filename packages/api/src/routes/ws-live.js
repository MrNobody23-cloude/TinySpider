export async function registerLiveWsRoute(fastify) {
    fastify.get('/ws/live', { websocket: true }, (connection) => {
        const ws = typeof connection?.send === 'function'
            ? connection
            : connection?.socket && typeof connection.socket.send === 'function'
                ? connection.socket
                : null;

        if (!ws) {
            return;
        }

        let closed = false;
        fastify.liveSockets.add(ws);

        const unsubscribePromise = Promise.resolve(
            fastify.insight.subscribeLive((message) => {
                if (!closed && ws && ws.readyState === 1) {
                    ws.send(message);
                }
            })
        );

        ws.on('close', async () => {
            closed = true;
            fastify.liveSockets.delete(ws);
            const unsubscribe = await unsubscribePromise;
            await unsubscribe();
        });
    });
}
