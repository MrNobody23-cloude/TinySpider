import { Worker } from 'bullmq';

export function createEventWriterWorker({ connection, clickhouse, logger }) {
    const pending = [];
    let timer = null;
    let flushing = false;

    const clearTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const flush = async () => {
        if (flushing || pending.length === 0) return;
        flushing = true;
        clearTimer();

        const batch = pending.splice(0, pending.length);
        const rows = batch.map((item) => item.data);

        try {
            await clickhouse.insert({
                table: 'events',
                values: rows,
                format: 'JSONEachRow'
            });
            for (const item of batch) item.resolve();
        } catch (err) {
            logger.error({ err }, 'Failed writing events batch to ClickHouse');
            for (const item of batch) item.reject(err);
        } finally {
            flushing = false;
            if (pending.length > 0) {
                timer = setTimeout(() => {
                    void flush();
                }, 500);
            }
        }
    };

    const scheduleFlush = () => {
        if (pending.length >= 100) {
            void flush();
            return;
        }
        if (!timer) {
            timer = setTimeout(() => {
                void flush();
            }, 500);
        }
    };

    const worker = new Worker(
        'events',
        (job) =>
            new Promise((resolve, reject) => {
                pending.push({ data: job.data, resolve, reject });
                scheduleFlush();
            }),
        { connection }
    );

    worker.on('error', (err) => {
        logger.error({ err }, 'BullMQ worker error');
    });

    const close = async () => {
        clearTimer();
        await flush();
        await worker.close();
    };

    return { worker, close };
}
