import autocannon from 'autocannon';

export async function runLoadTest({ url, connections = 1000, duration = 30 }) {
    return new Promise((resolve, reject) => {
        autocannon(
            {
                url,
                method: 'POST',
                connections,
                duration,
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    site_id: 'load-test',
                    event_type: 'pageview',
                    url: 'https://example.com'
                })
            },
            (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({
                    latency: result.latency,
                    errors: result.errors,
                    requests: result.requests.total
                });
            }
        );
    });
}

async function main() {
    const result = await runLoadTest({ url: process.env.LOAD_TEST_URL || 'http://127.0.0.1:3000/collect' });
    console.log(JSON.stringify(result, null, 2));
    if (result.latency.p99 >= 100 || result.errors / Math.max(1, result.requests) >= 0.001) {
        process.exit(1);
    }
}

if (process.argv[1] && process.argv[1].endsWith('load-test.js')) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
